import { Wallet, P2PKBuilder, getEncodedToken } from "@cashu/cashu-ts";

export const DEFAULT_MINT = "https://mint.minibits.cash/Bitcoin";
const ESCROW_LOCKTIME_SECS = 7 * 24 * 60 * 60;

/**
 * Check if a mint supports NUT-11 (P2PK spending conditions).
 * Returns { supported: bool, info }
 */
export async function checkMintP2PKSupport(mintUrl) {
  try {
    const wallet = new Wallet(mintUrl);
    await wallet.loadMint();
    const nuts = wallet.mint.mintInfo?.nuts ?? {};
    return { supported: !!nuts["11"], info: wallet.mint.mintInfo };
  } catch (e) {
    return { supported: false, error: e.message };
  }
}

/**
 * Get a Lightning invoice from a Cashu mint to fund escrow.
 * Locks tokens to body person's pubkey with a 7-day timelock refund.
 * Returns { quote, wallet, locktimeTs }
 */
export async function getEscrowInvoice({ mintUrl, amountSats, bodyPersonPubkey }) {
  const wallet = new Wallet(mintUrl);
  await wallet.loadMint();

  const nuts = wallet.mint.mintInfo?.nuts ?? {};
  if (!nuts["11"]) {
    throw new Error(`This mint doesn't support P2PK (NUT-11). Choose a different mint.`);
  }

  const quote = await wallet.mintQuote(amountSats);
  const locktimeTs = Math.floor(Date.now() / 1000) + ESCROW_LOCKTIME_SECS;

  return { quote, wallet, locktimeTs, mintUrl };
}

/**
 * Poll mint until invoice is paid, then lock tokens to body person's pubkey.
 * Calls onPaid(token, locktimeTs), onError(err)
 */
export function pollAndLockEscrow({
  wallet, quote, amountSats, bodyPersonPubkey, locktimeTs,
  onPaid, onError, intervalMs = 3000, timeoutMs = 600000,
}) {
  const p2pk = new P2PKBuilder()
    .addLockPubkey(bodyPersonPubkey)        // lock to body person only
    .requireLockSignatures(1)               // 1-of-1: body person redeems
    .addRefundPubkey(bodyPersonPubkey)      // refund also to body person after locktime
    .lockUntil(locktimeTs);

  const deadline = Date.now() + timeoutMs;

  async function attempt() {
    if (Date.now() > deadline) {
      onError(new Error("Invoice timed out. Please start a new escrow."));
      return;
    }
    try {
      const proofs = await wallet.mintProofs(
        amountSats,
        quote.quote,
        {},                                          // config (empty)
        { type: "p2pk", options: p2pk.toOptions() } // outputType (4th param)
      );
      const token = getEncodedToken({ mint: wallet.mint.mintUrl, proofs });
      onPaid(token, locktimeTs);
    } catch (e) {
      const msg = e.message?.toLowerCase() ?? "";
      if (msg.includes("not paid") || msg.includes("unpaid") || msg.includes("pending") || msg.includes("issued")) {
        setTimeout(attempt, intervalMs);
      } else {
        onError(e);
      }
    }
  }

  attempt();
}

/**
 * Redeem a P2PK locked Cashu token using the holder's private key (nsec hex).
 * This is called by the body person after they decrypt the token.
 */
export async function redeemEscrowToken({ mintUrl, token, privkeyHex }) {
  const wallet = new Wallet(mintUrl);
  await wallet.loadMint();
  const proofs = await wallet.receive(token, { privkey: privkeyHex });
  return proofs;
}

export function isTimelockExpired(locktimeTs) {
  return locktimeTs > 0 && Math.floor(Date.now() / 1000) > locktimeTs;
}

export function getLocktimeDisplay(locktimeTs) {
  if (!locktimeTs) return "";
  return new Date(locktimeTs * 1000).toLocaleDateString("en-US", {
    month: "short", day: "numeric", year: "numeric",
  });
}
