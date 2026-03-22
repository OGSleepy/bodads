import { useState } from "react";
import { MapPin, User, ChevronRight, X } from "lucide-react";
import { pool } from "../nostr";
import { buildCloseListingEvent } from "../nostr";
import { useProfile } from "../hooks/useProfile";
import { ClaimModal } from "./ClaimModal";

const SIZE_LABELS = {
  small: "Small < 5cm",
  medium: "Medium 5–15cm",
  large: "Large 15–30cm",
  xlarge: "XL 30cm+",
};

const SIZE_COLORS = {
  small: "#39ff14",
  medium: "#00d4ff",
  large: "#ff6b35",
  xlarge: "#ff2d55",
};

const BODY_PART_EMOJIS = {
  Forearm: "💪", "Upper Arm": "💪", Bicep: "💪", Wrist: "⌚",
  Hand: "🤚", Neck: "🧣", Chest: "🫁", "Back (Upper)": "🔙",
  "Back (Lower)": "🔙", Shoulder: "🤷", Calf: "🦵", Thigh: "🦵",
  Ankle: "🦶", Ribs: "🦴", "Behind Ear": "👂", Finger: "☝️", Other: "✨",
};

export function ListingCard({ listing, user, onRefetch }) {
  const profile = useProfile(listing.pubkey);
  const [showClaim, setShowClaim] = useState(false);
  const [closing, setClosing] = useState(false);

  async function handleClose() {
    if (!window.confirm("Close this listing? It will be removed from the feed.")) return;
    setClosing(true);
    try {
      const unsigned = buildCloseListingEvent(listing);
      const signed = await user.signer.signEvent(unsigned);
      await pool.event(signed);
      onRefetch?.();
    } catch (e) {
      alert("Failed to close: " + e.message);
    } finally {
      setClosing(false);
    }
  }

  const displayName = profile?.display_name || profile?.name || listing.pubkey.slice(0, 8) + "…";
  const avatar = profile?.picture;
  const bodyEmoji = BODY_PART_EMOJIS[listing.bodyPart] || "✨";
  const sizeColor = SIZE_COLORS[listing.size] || "#39ff14";

  const isOwnListing = user?.pubkey === listing.pubkey;

  return (
    <>
      <div className="listing-card">
        <div className="card-accent" style={{ background: sizeColor }} />

        <div className="card-header">
          <div className="avatar-row">
            {avatar ? (
              <img src={avatar} alt={displayName} className="avatar" />
            ) : (
              <div className="avatar avatar-placeholder">
                <User size={14} />
              </div>
            )}
            <span className="display-name">{displayName}</span>
          </div>
          <div className="size-badge" style={{ color: sizeColor, borderColor: sizeColor }}>
            {SIZE_LABELS[listing.size] || listing.size}
          </div>
        </div>

        <h3 className="card-title">{listing.title}</h3>

        <div className="card-meta">
          <span className="body-part-tag">
            {bodyEmoji} {listing.bodyPart}
          </span>
          {listing.location && (
            <span className="location-tag">
              <MapPin size={11} /> {listing.location}
            </span>
          )}
        </div>

        {listing.description && (
          <p className="card-desc">{listing.description}</p>
        )}

        <div className="card-footer">
          <div className="price">
            <span className="price-lightning">⚡</span>
            <span className="price-amount">{listing.priceSats.toLocaleString()}</span>
            <span className="price-unit">sats</span>
          </div>

          {isOwnListing ? (
            <div className="own-listing-actions">
              <div className="own-listing-badge">Your listing</div>
              <button className="close-listing-btn" onClick={handleClose} disabled={closing} title="Close listing">
                <X size={12} /> {closing ? "…" : "Close"}
              </button>
            </div>
          ) : (
            <button
              className="claim-btn"
              onClick={() => setShowClaim(true)}
            >
              Claim Space <ChevronRight size={13} />
            </button>
          )}
        </div>
      </div>

      {showClaim && (
        <ClaimModal
          listing={listing}
          user={user}
          onClose={() => setShowClaim(false)}
          onDealProposed={() => setShowClaim(false)}
        />
      )}
    </>
  );
}
