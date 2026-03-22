import { useState } from "react";
import { Shield, Users, CheckCircle, Clock, ImagePlus, Zap, XCircle, ChevronDown, ChevronUp } from "lucide-react";
import { pool } from "../nostr";
import { buildDealAcceptance, buildProofEvent, buildDealRelease } from "../deals";
import { useProfile } from "../hooks/useProfile";
import { Wallet } from "@cashu/cashu-ts";

const STATUS_LABELS = {
  proposed:        { label: "Awaiting Acceptance", color: "#ffd700" },
  accepted:        { label: "Accepted — Fund Escrow", color: "#00d4ff" },
  proof_submitted: { label: "Proof Submitted", color: "#ff6b35" },
  completed:       { label: "Completed ✓", color: "#39ff14" },
  disputed:        { label: "Disputed", color: "#ff2d55" },
};

const ROLE_LABELS = {
  advertiser:  "You're the Advertiser",
  seller:      "You're the Body Person",
  coordinator: "You're the Coordinator",
};

export function DealThread({ thread, user, onAction }) {
  const { proposal, acceptance, proof, release, myRole, status } = thread;
  const [expanded, setExpanded] = useState(status === "proposed" && myRole === "seller");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [proofUrl, setProofUrl] = useState("");
  const [proofNote, setProofNote] = useState("");
  const [lightningInvoice, setLightningInvoice] = useState("");
  const [fundingStep, setFundingStep] = useState(false);

  const advertiserProfile = useProfile(proposal.pubkey);
  const sellerProfile = useProfile(proposal.bodyPersonPubkey);
  const coordProfile = useProfile(proposal.coordinatorPubkey);

  const statusInfo = STATUS_LABELS[status] || STATUS_LABELS.proposed;

  // ── ACCEPT DEAL (body person) ─────────────────────────
  async function handleAccept() {
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
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  // ── REJECT DEAL (body person) ─────────────────────────
  async function handleReject() {
    setBusy(true); setError("");
    try {
      const unsigned = {
        kind: proposal.event.kind,
        content: "rejected",
        tags: [
          ["e", proposal.id, "", "deal"],
          ["p", proposal.pubkey, "", "buyer"],
          ["status", "rejected"],
          ["t", "bodads-deal"],
        ],
        created_at: Math.floor(Date.now() / 1000),
        pubkey: user.pubkey,
      };
      const signed = await user.signer.signEvent(unsigned);
      await pool.event(signed);
      onAction();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  // ── FUND CASHU ESCROW (advertiser, after acceptance) ──
  async function handleFundCashu() {
    setBusy(true); setError("");
    try {
      const wallet = new Wallet(proposal.mintUrl);
      await wallet.loadMint();
      const quote = await wallet.mintQuote(proposal.priceSats);
      setLightningInvoice(quote.request);
      setFundingStep(true);
    } catch (e) {
      setError("Failed to get invoice from mint: " + e.message);
    } finally {
      setBusy(false);
    }
  }

  // ── SUBMIT PROOF (body person) ────────────────────────
  async function handleSubmitProof() {
    if (!proofUrl) { setError("Please enter a proof image URL."); return; }
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
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  // ── RELEASE PAYMENT (advertiser or coordinator) ───────
  async function handleRelease() {
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
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  const escrowColor = proposal.escrowType === "cashu" ? "#39ff14" : "#00d4ff";
  const escrowLabel = proposal.escrowType === "cashu" ? "Cashu Escrow" : "Coordinator Escrow";

  return (
    <div className="deal-thread">
      {/* Thread header */}
      <div className="deal-thread-header" onClick={() => setExpanded(e => !e)}>
        <div className="deal-thread-left">
          <div className="deal-status-dot" style={{ background: statusInfo.color }} />
          <div className="deal-thread-info">
            <span className="deal-thread-title">
              {myRole === "advertiser"
                ? `To: ${sellerProfile?.display_name || sellerProfile?.name || proposal.bodyPersonPubkey.slice(0, 8) + "…"}`
                : `From: ${advertiserProfile?.display_name || advertiserProfile?.name || proposal.pubkey.slice(0, 8) + "…"}`}
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

      {/* Thread body */}
      {expanded && (
        <div className="deal-thread-body">
          {/* Role badge */}
          <div className="role-badge">{ROLE_LABELS[myRole]}</div>

          {/* Parties */}
          <div className="deal-parties">
            <PartyRow label="Advertiser" profile={advertiserProfile} pubkey={proposal.pubkey} />
            <PartyRow label="Body Person" profile={sellerProfile} pubkey={proposal.bodyPersonPubkey} />
            {proposal.coordinatorPubkey && (
              <PartyRow label="Coordinator" profile={coordProfile} pubkey={proposal.coordinatorPubkey} />
            )}
          </div>

          {/* Escrow details */}
          <div className="deal-escrow-info">
            <span style={{ color: escrowColor }}>{proposal.escrowType === "cashu" ? <Shield size={13} /> : <Users size={13} />}</span>
            <span>{escrowLabel}</span>
            {proposal.mintUrl && <span className="dim">· {proposal.mintUrl.replace("https://", "")}</span>}
          </div>

          {error && <div className="error-msg">{error}</div>}

          {/* ── SELLER ACTIONS: Proposed ── */}
          {myRole === "seller" && status === "proposed" && (
            <div className="deal-actions">
              <p className="deal-action-desc">
                This advertiser wants to buy ad space on your body. Review the terms above and accept or reject.
              </p>
              <div className="deal-btn-row">
                <button className="btn-primary" onClick={handleAccept} disabled={busy}>
                  <CheckCircle size={14} /> {busy ? "Publishing…" : "Accept Deal"}
                </button>
                <button className="btn-danger" onClick={handleReject} disabled={busy}>
                  <XCircle size={14} /> Reject
                </button>
              </div>
            </div>
          )}

          {/* ── ADVERTISER ACTIONS: Accepted, fund escrow ── */}
          {myRole === "advertiser" && status === "accepted" && !fundingStep && (
            <div className="deal-actions">
              <p className="deal-action-desc">
                {proposal.escrowType === "cashu"
                  ? "The body person accepted. Now fund the Cashu escrow — you'll get a Lightning invoice to pay."
                  : `The body person accepted. Now send ⚡ ${proposal.priceSats.toLocaleString()} sats to the coordinator's Lightning address: ${coordProfile?.lud16 || "…"}`}
              </p>
              {proposal.escrowType === "cashu" ? (
                <button className="btn-primary" onClick={handleFundCashu} disabled={busy}>
                  <Zap size={14} /> {busy ? "Getting invoice…" : "Fund Cashu Escrow"}
                </button>
              ) : (
                <div className="coordinator-pay-info">
                  <div className="lud-address">
                    <Zap size={14} color="#ffd700" />
                    <span>{coordProfile?.lud16 || "Coordinator has no Lightning address on record"}</span>
                  </div>
                  <p className="dim-small">Pay this Lightning address from any wallet. Once paid, notify the body person to proceed.</p>
                  <button className="btn-primary" onClick={handleRelease} disabled={busy}>
                    {busy ? "Publishing…" : "Mark as Funded"}
                  </button>
                </div>
              )}
            </div>
          )}

          {/* ── CASHU INVOICE ── */}
          {myRole === "advertiser" && fundingStep && lightningInvoice && (
            <div className="deal-actions">
              <p className="deal-action-desc">Pay this Lightning invoice to lock the sats in escrow:</p>
              <div className="invoice-box">
                <code className="invoice-text">{lightningInvoice.slice(0, 40)}…</code>
                <button className="btn-primary" onClick={() => navigator.clipboard.writeText(lightningInvoice)}>
                  Copy Invoice
                </button>
              </div>
              <p className="dim-small">After paying, the sats are locked. Neither party can touch them without both signatures until the 7-day timelock expires.</p>
            </div>
          )}

          {/* ── SELLER ACTIONS: Accepted, submit proof ── */}
          {myRole === "seller" && status === "accepted" && (
            <div className="deal-actions">
              <p className="deal-action-desc">
                Deal is funded! Get the tattoo done, then post a photo as proof. The advertiser will release payment once they verify.
              </p>
              <label>
                <span>Proof Image URL</span>
                <input
                  value={proofUrl}
                  onChange={e => setProofUrl(e.target.value)}
                  placeholder="https://… (nostr.build, imgur, etc.)"
                />
              </label>
              <label>
                <span>Note (optional)</span>
                <input
                  value={proofNote}
                  onChange={e => setProofNote(e.target.value)}
                  placeholder="Any notes about the tattoo"
                />
              </label>
              <button className="btn-primary" onClick={handleSubmitProof} disabled={busy}>
                <ImagePlus size={14} /> {busy ? "Publishing…" : "Submit Proof"}
              </button>
            </div>
          )}

          {/* ── PROOF SUBMITTED: show image + release for advertiser/coordinator ── */}
          {status === "proof_submitted" && proof && (
            <div className="deal-actions">
              <p className="deal-action-desc" style={{ color: "#ff6b35" }}>
                ⚡ Proof submitted — tattoo is done!
              </p>
              {proof.imageUrl && (
                <a href={proof.imageUrl} target="_blank" rel="noreferrer" className="proof-image-link">
                  <img src={proof.imageUrl} alt="Proof" className="proof-img" />
                </a>
              )}
              {proof.event.content && <p className="dim-small">"{proof.event.content}"</p>}

              {(myRole === "advertiser" || myRole === "coordinator") && (
                <>
                  <p className="deal-action-desc">Verify the proof above then release payment.</p>
                  <button className="btn-primary" onClick={handleRelease} disabled={busy}>
                    <CheckCircle size={14} /> {busy ? "Releasing…" : "Release Payment ⚡"}
                  </button>
                </>
              )}

              {myRole === "seller" && (
                <div className="timelock-notice">
                  <Clock size={13} />
                  <span>Waiting for advertiser to release. If they don't respond within 7 days of your proof, you can claim the sats automatically.</span>
                </div>
              )}
            </div>
          )}

          {/* ── COMPLETED ── */}
          {status === "completed" && (
            <div className="deal-actions">
              <div className="completed-banner">
                <CheckCircle size={18} color="#39ff14" />
                <span>Deal complete! Payment released. #KeepNostrWeird ⚡</span>
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
        <span>{profile?.display_name || profile?.name || pubkey?.slice(0, 12) + "…"}</span>
        {profile?.lud16 && <span className="party-lud">⚡ {profile.lud16}</span>}
      </div>
    </div>
  );
}
