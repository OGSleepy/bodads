import { useState } from "react";
import { X, Shield, Users, ChevronRight, AlertTriangle, Copy, Check } from "lucide-react";
import { CoordinatorPicker } from "./CoordinatorPicker";
import { pool } from "../nostr";
import { buildDealProposal, DEAL_STATUS } from "../deals";
import { DEFAULT_MINT, checkMintP2PKSupport } from "../cashu";

const STEPS = { ESCROW_CHOICE: 0, COORDINATOR: 1, CASHU_SETUP: 2, CONFIRM: 3, DONE: 4 };

const ESCROW_EXPLANATIONS = {
  cashu: {
    title: "Cashu Escrow",
    subtitle: "Trustless — no middleman ever",
    color: "#39ff14",
    icon: <Shield size={22} />,
    howItWorks: [
      "You fund a Cashu mint with a Lightning invoice — the tokens are cryptographically locked to the body person's Nostr key",
      "The body person gets the tattoo done and submits a photo as proof on Nostr",
      "You verify the proof and release the token — encrypted via NIP-04 directly to the body person",
      "The body person redeems the token using their key — sats land in their Cashu wallet",
      "If you ghost after proof is posted, the body person can claim the tokens unilaterally after 7 days",
    ],
    pros: ["Fully trustless", "Open source & verifiable", "No third party can rug"],
    cons: ["Requires a compatible Cashu mint", "Slightly more steps to set up"],
  },
  coordinator: {
    title: "Coordinator Escrow",
    subtitle: "Simple — trust a person you both agree on",
    color: "#00d4ff",
    icon: <Users size={22} />,
    howItWorks: [
      "Both parties agree on a coordinator — a trusted Nostr user with a Lightning address",
      "You pay the agreed sats to the coordinator's Lightning address",
      "The body person gets the tattoo and posts proof",
      "The coordinator verifies the proof and releases payment to the body person",
      "If there's a dispute, the coordinator decides — their reputation is on the line publicly on Nostr",
    ],
    pros: ["Works with any Lightning wallet today", "Simple UX", "Anyone can be coordinator"],
    cons: ["Requires trusting the coordinator", "Coordinator could potentially rug"],
  },
};

export function ClaimModal({ listing, user, onClose, onDealProposed }) {
  const [step, setStep] = useState(STEPS.ESCROW_CHOICE);
  const [escrowType, setEscrowType] = useState(null);
  const [coordinator, setCoordinator] = useState(null);
  const [mintUrl, setMintUrl] = useState(DEFAULT_MINT);
  const [publishing, setPublishing] = useState(false);
  const [error, setError] = useState("");
  const [dealEvent, setDealEvent] = useState(null);
  const [copied, setCopied] = useState(false);
  const [mintChecking, setMintChecking] = useState(false);
  const [mintError, setMintError] = useState("");

  async function handleProposeDeal() {
    setPublishing(true);
    setError("");
    try {
      const unsigned = buildDealProposal({
        listingEventId: listing.id,
        bodyPersonPubkey: listing.pubkey,
        coordinatorPubkey: coordinator?.pubkey || null,
        escrowType,
        mintUrl: escrowType === "cashu" ? mintUrl : null,
        priceSats: listing.priceSats,
        pubkey: user.pubkey,
      });
      const signed = await user.signer.signEvent(unsigned);
      await pool.event(signed);
      setDealEvent(signed);
      setStep(STEPS.DONE);
      onDealProposed?.(signed);
    } catch (e) {
      setError("Failed to publish deal: " + e.message);
    } finally {
      setPublishing(false);
    }
  }

  function copyDealId() {
    navigator.clipboard.writeText(dealEvent?.id || "");
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  const info = escrowType ? ESCROW_EXPLANATIONS[escrowType] : null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal claim-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Claim This Ad Space</h2>
          <button className="icon-btn" onClick={onClose}><X size={20} /></button>
        </div>

        {/* Listing summary */}
        <div className="claim-listing-summary">
          <span className="body-part-tag">🎯 {listing.bodyPart}</span>
          <span className="price-tag">⚡ {listing.priceSats.toLocaleString()} sats</span>
        </div>

        {/* READONLY GUARD */}
        {user?.readonly && (
          <div className="form-body">
            <div className="error-msg">You're browsing read-only. Log in with a signing key to claim ad space.</div>
          </div>
        )}

        {/* STEPS — only shown when not readonly */}
        {!user?.readonly && <>

        {/* STEP 0: Choose escrow type */}
        {step === STEPS.ESCROW_CHOICE && (
          <div className="form-body">
            <p className="step-intro">Choose how the payment will be held while the tattoo is done. Both parties are protected either way.</p>
            <div className="escrow-cards">
              {Object.entries(ESCROW_EXPLANATIONS).map(([type, info]) => (
                <div
                  key={type}
                  className={`escrow-card ${escrowType === type ? "active" : ""}`}
                  style={{ "--card-color": info.color }}
                  onClick={() => setEscrowType(type)}
                >
                  <div className="escrow-card-header">
                    <div className="escrow-icon" style={{ color: info.color }}>{info.icon}</div>
                    <div>
                      <div className="escrow-title" style={{ color: info.color }}>{info.title}</div>
                      <div className="escrow-subtitle">{info.subtitle}</div>
                    </div>
                  </div>

                  <div className="escrow-steps">
                    {info.howItWorks.map((step, i) => (
                      <div key={i} className="escrow-step">
                        <span className="step-num" style={{ color: info.color }}>{i + 1}</span>
                        <span>{step}</span>
                      </div>
                    ))}
                  </div>

                  <div className="escrow-proscons">
                    <div className="pros">
                      {info.pros.map((p, i) => <div key={i} className="pro">✓ {p}</div>)}
                    </div>
                    <div className="cons">
                      {info.cons.map((c, i) => <div key={i} className="con">✗ {c}</div>)}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <button
              className="btn-primary full"
              disabled={!escrowType}
              onClick={() => setStep(escrowType === "cashu" ? STEPS.CASHU_SETUP : STEPS.COORDINATOR)}
            >
              Continue with {escrowType ? ESCROW_EXPLANATIONS[escrowType].title : "…"} <ChevronRight size={14} />
            </button>
          </div>
        )}

        {/* STEP 1: Coordinator selection */}
        {step === STEPS.COORDINATOR && (
          <div className="form-body">
            <div className="step-header">
              <button className="back-btn" onClick={() => setStep(STEPS.ESCROW_CHOICE)}>← Back</button>
              <h3>Choose a Coordinator</h3>
            </div>
            <p className="step-intro">
              Enter the npub of someone you both trust. They'll hold the sats and release on proof. Their reputation is publicly on the line on Nostr.
            </p>
            <label>
              <span>Coordinator npub</span>
              <CoordinatorPicker value={coordinator} onChange={setCoordinator} />
            </label>
            <div className="coord-note">
              <AlertTriangle size={13} />
              <span>The body person must agree to this coordinator when they accept your deal.</span>
            </div>
            <button
              className="btn-primary full"
              disabled={!coordinator}
              onClick={() => setStep(STEPS.CONFIRM)}
            >
              Continue <ChevronRight size={14} />
            </button>
          </div>
        )}

        {/* STEP 2: Cashu mint setup */}
        {step === STEPS.CASHU_SETUP && (
          <div className="form-body">
            <div className="step-header">
              <button className="back-btn" onClick={() => setStep(STEPS.ESCROW_CHOICE)}>← Back</button>
              <h3>Cashu Mint</h3>
            </div>
            <p className="step-intro">
              Choose which Cashu mint will hold the escrowed sats. The body person must trust this mint too.
              <br /><br />
              After the deal is accepted, you'll receive a Lightning invoice to fund the escrow.
            </p>
            <label>
              <span>Mint URL</span>
              <input
                value={mintUrl}
                onChange={(e) => setMintUrl(e.target.value)}
                placeholder="https://mint.minibits.cash/Bitcoin"
              />
            </label>
            <div className="mint-note">
              <span className="mint-chip">✓ mint.minibits.cash</span>
              <span className="mint-chip">✓ stablenut.umint.cash</span>
            </div>
            {mintError && <div className="error-msg">{mintError}</div>}
            <button
              className="btn-primary full"
              disabled={!mintUrl || mintChecking}
              onClick={async () => {
                setMintChecking(true); setMintError("");
                const { supported, error } = await checkMintP2PKSupport(mintUrl);
                setMintChecking(false);
                if (!supported) {
                  setMintError(error || "This mint doesn\'t support P2PK (NUT-11). Try mint.minibits.cash instead.");
                  return;
                }
                setStep(STEPS.CONFIRM);
              }}
            >
              {mintChecking ? "Checking mint…" : <>Verify &amp; Continue <ChevronRight size={14} /></>}
            </button>
          </div>
        )}

        {/* STEP 3: Confirm & publish */}
        {step === STEPS.CONFIRM && (
          <div className="form-body">
            <div className="step-header">
              <button className="back-btn" onClick={() => setStep(escrowType === "cashu" ? STEPS.CASHU_SETUP : STEPS.COORDINATOR)}>← Back</button>
              <h3>Review Deal</h3>
            </div>

            <div className="deal-summary">
              <div className="deal-row">
                <span>Listing</span>
                <span>{listing.title}</span>
              </div>
              <div className="deal-row">
                <span>Price</span>
                <span>⚡ {listing.priceSats.toLocaleString()} sats</span>
              </div>
              <div className="deal-row">
                <span>Escrow</span>
                <span style={{ color: info.color }}>{info.title}</span>
              </div>
              {escrowType === "coordinator" && coordinator && (
                <div className="deal-row">
                  <span>Coordinator</span>
                  <span>{coordinator.profile?.display_name || coordinator.profile?.name || coordinator.npub?.slice(0, 12) + "…"}</span>
                </div>
              )}
              {escrowType === "cashu" && (
                <div className="deal-row">
                  <span>Mint</span>
                  <span>{mintUrl.replace("https://", "")}</span>
                </div>
              )}
            </div>

            <p className="step-intro">This will publish a deal proposal to Nostr. The body person will see it and can accept or reject.</p>

            {error && <div className="error-msg">{error}</div>}

            <button className="btn-primary full" onClick={handleProposeDeal} disabled={publishing}>
              {publishing ? "Publishing to Nostr…" : "Publish Deal Proposal ⚡"}
            </button>
          </div>
        )}

        {/* STEP 4: Done */}
        {step === STEPS.DONE && (
          <div className="form-body done-state">
            <div className="done-icon">⚡</div>
            <h3>Deal Proposed!</h3>
            <p>Your deal proposal is live on Nostr. The body person will see it and can accept or reject. Once accepted, you'll get instructions to fund the escrow.</p>
            {dealEvent && (
              <div className="deal-id-row">
                <span className="deal-id-label">Deal ID</span>
                <code className="deal-id">{dealEvent.id.slice(0, 16)}…</code>
                <button className="icon-btn" onClick={copyDealId}>
                  {copied ? <Check size={13} color="#39ff14" /> : <Copy size={13} />}
                </button>
              </div>
            )}
            <button className="btn-primary full" onClick={onClose}>Done</button>
          </div>
        )}

        </> /* end !readonly */}
      </div>
    </div>
  );
}
