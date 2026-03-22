import { useState } from "react";
import { X } from "lucide-react";
import { pool, buildListingEvent } from "../nostr";

const BODY_PARTS = [
  "Forearm", "Upper Arm", "Bicep", "Wrist", "Hand", "Neck",
  "Chest", "Back (Upper)", "Back (Lower)", "Shoulder", "Calf",
  "Thigh", "Ankle", "Ribs", "Behind Ear", "Finger", "Other"
];

const SIZES = [
  { value: "small", label: "Small (< 5cm)", emoji: "🔹" },
  { value: "medium", label: "Medium (5–15cm)", emoji: "🔷" },
  { value: "large", label: "Large (15–30cm)", emoji: "🟦" },
  { value: "xlarge", label: "XL (30cm+)", emoji: "🔵" },
];

export function CreateListing({ pubkey, signer, onClose, onPublished }) {
  const [form, setForm] = useState({
    title: "",
    bodyPart: "",
    size: "",
    location: "",
    description: "",
    priceSats: "",
  });
  const [publishing, setPublishing] = useState(false);
  const [error, setError] = useState("");

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  async function handleSubmit() {
    if (!form.title || !form.bodyPart || !form.size || !form.priceSats) {
      setError("Please fill in all required fields.");
      return;
    }
    setPublishing(true);
    setError("");
    try {
      const unsigned = buildListingEvent({ ...form, priceSats: parseInt(form.priceSats), pubkey });
      const signed = await signer.signEvent(unsigned);
      await pool.event(signed);
      onPublished();
      onClose();
    } catch (e) {
      setError("Failed to publish: " + e.message);
    } finally {
      setPublishing(false);
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>List Your Ad Space</h2>
          <button className="icon-btn" onClick={onClose}><X size={20} /></button>
        </div>

        <div className="form-body">
          <label>
            <span>Listing Title *</span>
            <input
              value={form.title}
              onChange={set("title")}
              placeholder="e.g. Bitcoin logo on my forearm"
            />
          </label>

          <label>
            <span>Body Part *</span>
            <select value={form.bodyPart} onChange={set("bodyPart")}>
              <option value="">Select body part…</option>
              {BODY_PARTS.map((p) => <option key={p} value={p}>{p}</option>)}
            </select>
          </label>

          <label>
            <span>Size *</span>
            <div className="size-grid">
              {SIZES.map((s) => (
                <button
                  key={s.value}
                  className={`size-btn ${form.size === s.value ? "active" : ""}`}
                  onClick={() => setForm((f) => ({ ...f, size: s.value }))}
                  type="button"
                >
                  {s.emoji} {s.label}
                </button>
              ))}
            </div>
          </label>

          <label>
            <span>Your Location (optional)</span>
            <input
              value={form.location}
              onChange={set("location")}
              placeholder="e.g. Miami, FL"
            />
          </label>

          <label>
            <span>Description</span>
            <textarea
              value={form.description}
              onChange={set("description")}
              rows={3}
              placeholder="Any additional details, skin tone, placement, willingness to travel…"
            />
          </label>

          <label>
            <span>Price (sats) *</span>
            <div className="input-prefix-wrap">
              <span className="prefix">⚡</span>
              <input
                type="number"
                min="1000"
                value={form.priceSats}
                onChange={set("priceSats")}
                placeholder="e.g. 500000"
              />
            </div>
          </label>

          {error && <div className="error-msg">{error}</div>}

          <button className="btn-primary full" onClick={handleSubmit} disabled={publishing}>
            {publishing ? "Publishing to Nostr…" : "Publish Listing ⚡"}
          </button>
        </div>
      </div>
    </div>
  );
}
