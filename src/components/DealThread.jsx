import { useState } from "react";
import { Shield, Users, CheckCircle, Clock, ImagePlus, Zap, XCircle, ChevronDown, ChevronUp, Key } from "lucide-react";
import { pool } from "../nostr";
import {
  buildDealAcceptance, buildProofEvent, buildDealRelease,
  buildCancelEvent, buildFundedEvent, buildCashuReleaseEvent,
  buildCoordinatorFundedEvent,
} from "../deals";
import { useProfile } from "../hooks/useProfile";
import { Wallet } from "@cashu/cashu-ts";
import { getEscrowInvoice, pollAndLockEscrow, redeemEscrowToken, getLocktimeDisplay, isTimelockExpired } from "../cashu";
import { ImageUpload } from "./ImageUpload";

const STATUS_LABELS = {
  proposed:        { label: "Awaiting Your Response", color: "#ffd700" },
  accepted:        { label: "Accepted — Awaiting Funding", color: "#00d4ff" },
  funded:          { label: "Funded — Get the Tattoo!", color: "#39ff14" },
  proof_submitted: { label: "Proof Submitted", color: "#ff6b35" },
  completed:       { label: "Completed ✓", color: "#39ff14" },
};

const ROLE_LABELS = {
  advertiser:  "You're the Advertiser",
  seller:      "You're the Body Person",
  coordinator: "You're the Coordinator",
};

export function DealThread({ thread, user, onAction }) {
  const { proposal, acceptance, funded, proof, release, myRole, status } = thread;
  const [expanded, setExpanded] = useState(
    (status === "proposed" && myRole === "seller") ||
    (status === "accepted" && myRole === "advertiser") ||
    (status === "funded" && myRole === "seller") ||
    (status === "proof_submitted" && (myRole === "advertiser" || myRole === "coordinator"))
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  // Proof submission
  const [proofUrl, setProofUrl] = useState("");
  const [proofNote, setProofNote] = useState("");

  // Cashu funding
  const [invoice, setInvoice] = useState("");
  const [polling, setPolling] = useState(false);
  const [escrowLocked, setEscrowLocked] = useState(false);
  const [lockError, setLockError] = useState("");

  // Cashu redemption (body person enters nsec)
  const [showNsecInput, setShowNsecInput] = useState(false);
  const [nsecInput, setNsecInput] = useState("");
  const [redeeming, setRedeeming] = useState(false);

  const advertiserProfile  = useProfile(proposal.pubkey);
  const sellerProfile      = useProfile(proposal.bodyPersonPubkey);
  const coordProfile       = useProfile(proposal.coordinatorPubkey);

  const isCashu = proposal.escrowType === "cashu";
  const statusInfo = STATUS_LABELS[status] || STATUS_LABELS.proposed;
  const escrowColor = isCashu ? "#39ff14" : "#00d4ff";
  const escrowLabel = isCashu ? "Cashu Escrow" : "Coordinator Escrow";

  // ── ACCEPT ───────────────────────────────────────────
  async function handleAccept() {
    if (user.readonly) { setError("Log in with a signing key to accept deals."); return; }
    setBusy(true); setError("");
    try {
      const unsigned = buildDealAcceptance({
        dealEventId: proposal.id,
        advertiserPubkey: proposal.pubkey,
        coordinatorPubkey: proposal.coordinatorPubkey || null,
        pubkey: user.pubkey,
      });
      const signed = await user.signer.signEvent(unsigned);
      await pool.event(signed);
      onAction();
    } catch (e) { setError(e.message); }
    finally { setBusy(false); }
  }

  // ── REJECT ───────────────────────────────────────────
  async function handleReject() {
    if (user.readonly) return;
    if (!window.confirm("Reject this deal proposal?")) return;
    setBusy(true); setError("");
    try {
      const unsigned = buildCancelEvent({
        dealEventId: proposal.id,
        otherPubkey: proposal.pubkey,
        pubkey: user.pubkey,
      });
      const signed = await user.signer.signEvent(unsigned);
      await pool.event(signed);
      onAction();
    } catch (e) { setError(e.message); }
    finally { setBusy(false); }
  }

  // ── CANCEL (advertiser) ───────────────────────────────
  async function handleCancel() {
    if (user.readonly) return;
    if (!window.confirm("Cancel this deal proposal?")) return;
    setBusy(true); setError("");
    try {
      const unsigned = buildCancelEvent({
        dealEventId: proposal.id,
        otherPubkey: proposal.bodyPersonPubkey,
        pubkey: user.pubkey,
      });
      const signed = await user.signer.signEvent(unsigned);
      await pool.event(signed);
      onAction();
    } catch (e) { setError(e.message); }
    finally { setBusy(false); }
  }

  // ── FUND CASHU ESCROW ─────────────────────────────────
  async function handleFundCashu() {
    if (user.readonly) { setError("Log in with a signing key to fund escrow."); return; }
    setBusy(true); setError(""); setLockError("");
    try {
      const { quote, wallet, locktimeTs, mintUrl } = await getEscrowInvoice({
        mintUrl: proposal.mintUrl,
        amountSats: proposal.priceSats,
        bodyPersonPubkey: proposal.bodyPersonPubkey,
      });
      setInvoice(quote.request);
      setPolling(true);

      pollAndLockEscrow({
        wallet, quote, amountSats: proposal.priceSats,
        bodyPersonPubkey: proposal.bodyPersonPubkey, locktimeTs,
        onPaid: async (token, locktimeTs) => {
          setPolling(false);
          try {
            // NIP-04 encrypt the token to body person
            const encrypted = await user.signer.nip04.encrypt(proposal.bodyPersonPubkey, token);
            const unsigned = buildFundedEvent({
              dealEventId: proposal.id,
              bodyPersonPubkey: proposal.bodyPersonPubkey,
              encryptedToken: encrypted,
              mintUrl: proposal.mintUrl,
              locktimeTs,
              pubkey: user.pubkey,
            });
            const signed = await user.signer.signEvent(unsigned);
            await pool.event(signed);
            setEscrowLocked(true);
            onAction();
          } catch (e) {
            setLockError("Sats locked but failed to publish: " + e.message);
          }
        },
        onError: (e) => { setPolling(false); setLockError(e.message); },
      });
    } catch (e) { setError(e.message); }
    finally { setBusy(false); }
  }

  // ── COORDINATOR CONFIRMS RECEIVED ────────────────────
  async function handleCoordFunded() {
    if (user.readonly) return;
    setBusy(true); setError("");
    try {
      const unsigned = buildCoordinatorFundedEvent({
        dealEventId: proposal.id,
        bodyPersonPubkey: proposal.bodyPersonPubkey,
        advertiserPubkey: proposal.pubkey,
        pubkey: user.pubkey,
      });
      const signed = await user.signer.signEvent(unsigned);
      await pool.event(signed);
      onAction();
    } catch (e) { setError(e.message); }
    finally { setBusy(false); }
  }

  // ── SUBMIT PROOF ──────────────────────────────────────
  async function handleSubmitProof() {
    if (!proofUrl) { setError("Upload a photo first."); return; }
    if (user.readonly) { setError("Log in with a signing key to submit proof."); return; }
    setBusy(true); setError("");
    try {
      const unsigned = buildProofEvent({
        dealEventId: proposal.id,
        advertiserPubkey: proposal.pubkey,
        imageUrl: proofUrl,
        note: proofNote,
        pubkey: user.pubkey,
      });
      const signed = await user.signer.signEvent(unsigned);
      await pool.event(signed);
      onAction();
    } catch (e) { setError(e.message); }
    finally { setBusy(false); }
  }

  // ── RELEASE: Coordinator path ─────────────────────────
  async function handleRelease() {
    if (user.readonly) return;
    setBusy(true); setError("");
    try {
      const unsigned = buildDealRelease({
        dealEventId: proposal.id,
        bodyPersonPubkey: proposal.bodyPersonPubkey,
        pubkey: user.pubkey,
      });
      const signed = await user.signer.signEvent(unsigned);
      await pool.event(signed);
      onAction();
    } catch (e) { setError(e.message); }
    finally { setBusy(false); }
  }

  // ── RELEASE: Cashu path (advertiser NIP-04 encrypts token to body person) ─
  async function handleCashuRelease() {
    if (user.readonly) return;
    if (!funded?.encryptedToken) { setError("No funded escrow token found."); return; }
    setBusy(true); setError("");
    try {
      // Decrypt the token (advertiser already holds it encrypted to body person)
      // Re-encrypt to body person as the "release" — body person redeems with nsec
      const unsigned = buildCashuReleaseEvent({
        dealEventId: proposal.id,
        bodyPersonPubkey: proposal.bodyPersonPubkey,
        encryptedToken: funded.encryptedToken, // already encrypted to body person
        mintUrl: funded.mintUrl || proposal.mintUrl,
        pubkey: user.pubkey,
      });
      const signed = await user.signer.signEvent(unsigned);
      await pool.event(signed);
      onAction();
    } catch (e) { setError(e.message); }
    finally { setBusy(false); }
  }

  // ── REDEEM Cashu token (body person, needs nsec) ──────
  async function handleRedeem() {
    if (!nsecInput.trim()) { setError("Enter your nsec to redeem."); return; }
    setRedeeming(true); setError("");
    try {
      let privkeyHex = nsecInput.trim();
      if (privkeyHex.startsWith("nsec")) {
        const { nip19 } = await import("nostr-tools");
        privkeyHex = nip19.decode(privkeyHex).data;
      }
      // Decrypt token
      const encryptedToken = release?.encryptedToken || funded?.encryptedToken;
      if (!encryptedToken) throw new Error("No token found in deal events.");
      const token = await user.signer.nip04.decrypt(proposal.pubkey, encryptedToken);
      const mintUrl = release?.mintUrl || funded?.mintUrl || proposal.mintUrl;
      await redeemEscrowToken({ mintUrl, token, privkeyHex });
      setNsecInput(""); // clear immediately after use
      alert("✅ Sats redeemed successfully!");
      onAction();
    } catch (e) { setError("Redemption failed: " + e.message); }
    finally { setRedeeming(false); }
  }

  return (
    <div className="deal-thread">
      <div className="deal-thread-header" onClick={() => setExpanded(e => !e)}>
        <div className="deal-thread-left">
          <div className="deal-status-dot" style={{ background: statusInfo.color }} />
          <div className="deal-thread-info">
            <span className="deal-thread-title">
              {myRole === "advertiser"
                ? `→ ${sellerProfile?.display_name || sellerProfile?.name || proposal.bodyPersonPubkey.slice(0,8)+"…"}`
                : `← ${advertiserProfile?.display_name || advertiserProfile?.name || proposal.pubkey.slice(0,8)+"…"}`}
            </span>
            <span className="deal-thread-meta">
              <span style={{ color: escrowColor }}>{escrowLabel}</span>
              {" · "}⚡ {proposal.priceSats.toLocaleString()} sats
              {" · "}<span style={{ color: statusInfo.color }}>{statusInfo.label}</span>
            </span>
          </div>
        </div>
        {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
      </div>

      {expanded && (
        <div className="deal-thread-body">
          <div className="role-badge">{ROLE_LABELS[myRole]}</div>

          <div className="deal-parties">
            <PartyRow label="Advertiser" profile={advertiserProfile} pubkey={proposal.pubkey} />
            <PartyRow label="Body Person" profile={sellerProfile} pubkey={proposal.bodyPersonPubkey} />
            {proposal.coordinatorPubkey && (
              <PartyRow label="Coordinator" profile={coordProfile} pubkey={proposal.coordinatorPubkey} />
            )}
          </div>

          <div className="deal-escrow-info">
            <span style={{ color: escrowColor }}>{isCashu ? <Shield size={13} /> : <Users size={13} />}</span>
            <span>{escrowLabel}</span>
            {proposal.mintUrl && <span className="dim">· {proposal.mintUrl.replace("https://","")}</span>}
            {funded?.locktimeTs > 0 && (
              <span className="dim">· unlocks {getLocktimeDisplay(funded.locktimeTs)}</span>
            )}
          </div>

          {error && <div className="error-msg">{error}</div>}

          {/* ── SELLER: Accept/Reject ── */}
          {myRole === "seller" && status === "proposed" && (
            <div className="deal-actions">
              <p className="deal-action-desc">
                An advertiser wants ad space on your body. Review the terms and accept or reject.
              </p>
              <div className="deal-btn-row">
                <button className="btn-primary" onClick={handleAccept} disabled={busy}>
                  <CheckCircle size={14} /> {busy ? "…" : "Accept Deal"}
                </button>
                <button className="btn-danger" onClick={handleReject} disabled={busy}>
                  <XCircle size={14} /> Reject
                </button>
              </div>
            </div>
          )}

          {/* ── ADVERTISER: Cancel when proposed ── */}
          {myRole === "advertiser" && status === "proposed" && (
            <div className="deal-actions">
              <p className="deal-action-desc">Waiting for the body person to accept your proposal.</p>
              <button className="btn-danger" onClick={handleCancel} disabled={busy}>
                <XCircle size={14} /> Cancel Proposal
              </button>
            </div>
          )}

          {/* ── ADVERTISER: Fund Cashu escrow after acceptance ── */}
          {myRole === "advertiser" && status === "accepted" && isCashu && !invoice && (
            <div className="deal-actions">
              <p className="deal-action-desc">
                Accepted! Fund the Cashu escrow — you'll get a Lightning invoice. The sats will be locked to the body person's key and only released after you verify the tattoo proof.
              </p>
              <button className="btn-primary" onClick={handleFundCashu} disabled={busy}>
                <Zap size={14} /> {busy ? "Getting invoice…" : "Fund Cashu Escrow"}
              </button>
            </div>
          )}

          {/* ── CASHU INVOICE + POLLING ── */}
          {myRole === "advertiser" && invoice && (
            <div className="deal-actions">
              {!escrowLocked ? (
                <>
                  <p className="deal-action-desc">Pay this Lightning invoice to lock sats in escrow:</p>
                  <div className="invoice-box">
                    <code className="invoice-text">{invoice.slice(0, 64)}…</code>
                    <div className="invoice-actions">
                      <button className="btn-primary" onClick={() => navigator.clipboard.writeText(invoice)}>
                        Copy Invoice
                      </button>
                      <a className="btn-primary" href={`lightning:${invoice}`}>Open in Wallet</a>
                    </div>
                  </div>
                  {polling && (
                    <div className="polling-status">
                      <div className="pulse-dot" />
                      <span>Watching for payment…</span>
                    </div>
                  )}
                  {lockError && <div className="error-msg">{lockError}</div>}
                  <p className="dim-small">Sats lock automatically when paid. Neither party can move them until you release after verifying proof.</p>
                </>
              ) : (
                <div className="escrow-locked-banner">
                  <Shield size={16} color="#39ff14" />
                  <span>Escrow locked! Body person can now proceed. ⚡</span>
                </div>
              )}
            </div>
          )}

          {/* ── ADVERTISER: Pay coordinator ── */}
          {myRole === "advertiser" && status === "accepted" && !isCashu && (
            <div className="deal-actions">
              <p className="deal-action-desc">
                Send ⚡ {proposal.priceSats.toLocaleString()} sats to the coordinator's Lightning address. They'll hold it and release on proof.
              </p>
              <div className="lud-address">
                <Zap size={14} color="#ffd700" />
                <span>{coordProfile?.lud16 || "Coordinator has no Lightning address set"}</span>
              </div>
              <p className="dim-small">Once you've paid, the coordinator will confirm receipt and notify the body person to proceed.</p>
              <button className="btn-danger" onClick={handleCancel} disabled={busy}>
                <XCircle size={14} /> Cancel Deal
              </button>
            </div>
          )}

          {/* ── COORDINATOR: Confirm receipt ── */}
          {myRole === "coordinator" && status === "accepted" && (
            <div className="deal-actions">
              <p className="deal-action-desc">
                Confirm you've received ⚡ {proposal.priceSats.toLocaleString()} sats from the advertiser. This will notify the body person to proceed with the tattoo.
              </p>
              <button className="btn-primary" onClick={handleCoordFunded} disabled={busy}>
                <CheckCircle size={14} /> {busy ? "…" : "Confirm Receipt of Sats"}
              </button>
            </div>
          )}

          {/* ── SELLER: Submit proof (after funded) ── */}
          {myRole === "seller" && status === "funded" && (
            <div className="deal-actions">
              <p className="deal-action-desc" style={{ color: "#39ff14" }}>
                ⚡ Escrow is funded! Get the tattoo done, then submit photo proof below.
              </p>
              <ImageUpload
                label="Photo of the completed tattoo"
                onUpload={url => setProofUrl(url)}
                signer={user.signer}
              />
              <label>
                <span>Note (optional)</span>
                <input value={proofNote} onChange={e => setProofNote(e.target.value)} placeholder="Any notes…" />
              </label>
              <button className="btn-primary" onClick={handleSubmitProof} disabled={busy || !proofUrl}>
                <ImagePlus size={14} /> {busy ? "Publishing…" : "Submit Proof"}
              </button>
            </div>
          )}

          {/* ── PROOF SUBMITTED ── */}
          {status === "proof_submitted" && proof && (
            <div className="deal-actions">
              <p className="deal-action-desc" style={{ color: "#ff6b35" }}>
                Tattoo proof submitted!
              </p>
              {proof.imageUrl && (
                <a href={proof.imageUrl} target="_blank" rel="noreferrer" className="proof-image-link">
                  <img src={proof.imageUrl} alt="Proof" className="proof-img" />
                </a>
              )}
              {proof.event.content && <p className="dim-small">"{proof.event.content}"</p>}

              {/* Advertiser releases */}
              {myRole === "advertiser" && (
                <>
                  <p className="deal-action-desc">Verify the tattoo, then release payment.</p>
                  {isCashu ? (
                    <button className="btn-primary" onClick={handleCashuRelease} disabled={busy}>
                      <CheckCircle size={14} /> {busy ? "…" : "Release Cashu Token ⚡"}
                    </button>
                  ) : (
                    <button className="btn-primary" onClick={handleRelease} disabled={busy}>
                      <CheckCircle size={14} /> {busy ? "…" : "Confirm Payment Released ⚡"}
                    </button>
                  )}
                </>
              )}

              {/* Coordinator releases */}
              {myRole === "coordinator" && (
                <>
                  <p className="deal-action-desc">Verify the proof, then release the sats to the body person.</p>
                  <button className="btn-primary" onClick={handleRelease} disabled={busy}>
                    <CheckCircle size={14} /> {busy ? "…" : "Release Payment ⚡"}
                  </button>
                </>
              )}

              {/* Seller waiting */}
              {myRole === "seller" && (
                <>
                  {isCashu && funded?.locktimeTs > 0 && isTimelockExpired(funded.locktimeTs) ? (
                    <div className="deal-actions">
                      <p className="deal-action-desc" style={{ color: "#39ff14" }}>
                        ⏰ Timelock expired — you can now claim the sats unilaterally.
                      </p>
                      {!showNsecInput ? (
                        <button className="btn-primary" onClick={() => setShowNsecInput(true)}>
                          <Key size={14} /> Claim Sats Now (requires nsec)
                        </button>
                      ) : (
                        <>
                          <div className="nsec-warning">
                            ⚠️ Your nsec is used only in memory to sign the Cashu redemption and is never stored or transmitted.
                          </div>
                          <label>
                            <span>Your nsec or hex private key</span>
                            <input
                              type="password"
                              value={nsecInput}
                              onChange={e => setNsecInput(e.target.value)}
                              placeholder="nsec1… or hex"
                              autoComplete="off"
                            />
                          </label>
                          <button className="btn-primary" onClick={handleRedeem} disabled={redeeming}>
                            {redeeming ? "Claiming…" : "Claim ⚡"}
                          </button>
                        </>
                      )}
                    </div>
                  ) : (
                    <div className="timelock-notice">
                      <Clock size={13} />
                      <span>
                        Waiting for {isCashu ? "the advertiser" : "the coordinator"} to release.
                        {isCashu && funded?.locktimeTs > 0 && ` If they don't respond by ${getLocktimeDisplay(funded.locktimeTs)}, you can claim unilaterally.`}
                      </span>
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          {/* ── SELLER: Redeem Cashu token ── */}
          {myRole === "seller" && status === "completed" && isCashu && release?.encryptedToken && (
            <div className="deal-actions">
              <div className="completed-banner">
                <CheckCircle size={18} color="#39ff14" />
                <span>Payment released! Redeem your Cashu tokens below.</span>
              </div>
              {!showNsecInput ? (
                <button className="btn-primary" onClick={() => setShowNsecInput(true)}>
                  <Key size={14} /> Redeem Sats (requires nsec)
                </button>
              ) : (
                <>
                  <div className="nsec-warning">
                    ⚠️ Your nsec is used only in memory to sign the Cashu redemption and is never stored or transmitted.
                  </div>
                  <label>
                    <span>Your nsec or hex private key</span>
                    <input
                      type="password"
                      value={nsecInput}
                      onChange={e => setNsecInput(e.target.value)}
                      placeholder="nsec1… or hex"
                      autoComplete="off"
                    />
                  </label>
                  <button className="btn-primary" onClick={handleRedeem} disabled={redeeming}>
                    {redeeming ? "Redeeming…" : "Redeem ⚡"}
                  </button>
                </>
              )}
            </div>
          )}

          {/* ── COMPLETED (non-cashu or already redeemed) ── */}
          {status === "completed" && (!isCashu || myRole !== "seller" || !release?.encryptedToken) && (
            <div className="deal-actions">
              <div className="completed-banner">
                <CheckCircle size={18} color="#39ff14" />
                <span>Deal complete! #KeepNostrWeird ⚡</span>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function PartyRow({ label, profile, pubkey }) {
  return (
    <div className="party-row">
      <span className="party-label">{label}</span>
      <div className="party-identity">
        {profile?.picture && <img src={profile.picture} alt="" className="avatar-sm" />}
        <span>{profile?.display_name || profile?.name || pubkey?.slice(0,12)+"…"}</span>
        {profile?.lud16 && <span className="party-lud">⚡ {profile.lud16}</span>}
      </div>
    </div>
  );
}
