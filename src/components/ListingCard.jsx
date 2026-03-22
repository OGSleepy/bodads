import { useState } from "react";
import { Zap, MapPin, User } from "lucide-react";
import { useProfile } from "../hooks/useProfile";

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

export function ListingCard({ listing }) {
  const profile = useProfile(listing.pubkey);
  const [zapping, setZapping] = useState(false);
  const [zapped, setZapped] = useState(false);

  const displayName = profile?.display_name || profile?.name || listing.pubkey.slice(0, 8) + "…";
  const avatar = profile?.picture;
  const bodyEmoji = BODY_PART_EMOJIS[listing.bodyPart] || "✨";
  const sizeColor = SIZE_COLORS[listing.size] || "#39ff14";

  async function handleZap() {
    if (!window.nostr) {
      alert("Install a Nostr extension to zap!");
      return;
    }
    setZapping(true);
    // In production, this would trigger a real lightning zap via NIP-57
    // For now, show a fun simulation
    await new Promise((r) => setTimeout(r, 1200));
    setZapping(false);
    setZapped(true);
    setTimeout(() => setZapped(false), 3000);
  }

  return (
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
        <button
          className={`zap-btn ${zapping ? "zapping" : ""} ${zapped ? "zapped" : ""}`}
          onClick={handleZap}
          disabled={zapping}
        >
          <Zap size={14} />
          {zapped ? "Zapped! ⚡" : zapping ? "Zapping…" : "Zap to Claim"}
        </button>
      </div>
    </div>
  );
}
