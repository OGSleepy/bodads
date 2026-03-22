import { Wallet, P2PKBuilder } from "@cashu/cashu-ts";

export const DEFAULT_MINT = "https://mint.minibits.cash/Bitcoin";

// 7 days in seconds
const ESCROW_LOCKTIME_SECS = 7 * 24 * 60 * 60;

/**
 * Lock sats into a Cashu token that requires:
 * - BOTH advertiser + body person to sign to release immediately, OR
 * - body person alone after 7 days (timelock)
 *
 * Returns the serialized Cashu token string to publish in the deal event.
 */
export async function lockEscrow({ mintUrl, amountSats, advertiserPubkey, bodyPersonPubkey }) {
  const wallet = new Wallet(mintUrl);
  await wallet.loadMint();

  // Check mint supports NUT-11 (P2PK)
  const mintInfo = wallet.mint.mintInfo;
  const nuts = mintInfo?.nuts ?? {};
  if (!nuts["11"]) {
    throw new Error(`Mint ${mintUrl} does not support P2PK spending conditions (NUT-11). Please choose a different mint.`);
  }

  // Get a Lightning invoice to fund the escrow
  const quote = await wallet.mintQuote(amountSats);

  // Build P2PK spending condition:
  // - Primary: 2-of-2 (both must sign)
  // - Refund: body person alone, after 7 days
  const locktimeTs = Math.floor(Date.now() / 1000) + ESCROW_LOCKTIME_SECS;
  const p2pk = new P2PKBuilder()
    .addLockPubkey([advertiserPubkey, bodyPersonPubkey])
    .requireLockSignatures(2)
    .addRefundPubkey(bodyPersonPubkey)
    .lockUntil(locktimeTs);

  return {
    quote,
    p2pk,
    wallet,
    mintUrl,
  };
}

/**
 * After the Lightning invoice is paid, finalize and get the locked token string.
 */
export async function finalizeEscrow({ wallet, quote, p2pk, amountSats }) {
  const proofs = await wallet.mintProofs(amountSats, quote.quote, {
    outputOptions: { type: "p2pk", options: p2pk.toOptions() },
  });
  const token = wallet.export(proofs);
  return token;
}

/**
 * Release escrowed tokens — both parties sign.
 * privkeys should be the hex private keys of both signers.
 */
export async function releaseEscrow({ mintUrl, cashuToken, recipientPubkey, privkeys }) {
  const wallet = new Wallet(mintUrl);
  await wallet.loadMint();
  const proofs = wallet.import(cashuToken);
  const received = await wallet.receive(proofs, { privkey: privkeys });
  return received;
}

/**
 * Check if the timelock has expired (body person can claim unilaterally).
 */
export function isTimelockExpired(locktimeTs) {
  return Math.floor(Date.now() / 1000) > locktimeTs;
}

export function getLocktimeDisplay(locktimeTs) {
  const d = new Date(locktimeTs * 1000);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

/**
 * Poll a mint until a Lightning invoice is paid, then lock tokens with P2PK.
 * Calls onPaid(tokenString) when funded, onError(err) if it times out.
 */
export async function pollAndLockEscrow({
  mintUrl,
  quote,
  amountSats,
  advertiserPubkey,
  bodyPersonPubkey,
  onPaid,
  onError,
  intervalMs = 3000,
  timeoutMs = 600000, // 10 min
}) {
  const wallet = new Wallet(mintUrl);
  await wallet.loadMint();

  const locktimeTs = Math.floor(Date.now() / 1000) + ESCROW_LOCKTIME_SECS;
  const p2pk = new P2PKBuilder()
    .addLockPubkey([advertiserPubkey, bodyPersonPubkey])
    .requireLockSignatures(2)
    .addRefundPubkey(bodyPersonPubkey)
    .lockUntil(locktimeTs);

  const deadline = Date.now() + timeoutMs;

  async function attempt() {
    if (Date.now() > deadline) {
      onError(new Error("Invoice expired — please start a new escrow."));
      return;
    }
    try {
      const proofs = await wallet.mintProofs(amountSats, quote.quote, {
        outputOptions: { type: "p2pk", options: p2pk.toOptions() },
      });
      const token = wallet.export(proofs);
      onPaid(token, locktimeTs);
    } catch (e) {
      // Not paid yet — keep polling
      if (e.message?.includes("not paid") || e.message?.includes("UNPAID") || e.message?.includes("pending")) {
        setTimeout(attempt, intervalMs);
      } else {
        onError(e);
      }
    }
  }

  attempt();
}
