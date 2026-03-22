import { useState } from "react";
import { Search, CheckCircle, AlertCircle } from "lucide-react";
import { pool } from "../nostr";
import { nip19 } from "nostr-tools";

export function CoordinatorPicker({ value, onChange }) {
  const [input, setInput] = useState(value?.npub || "");
  const [profile, setProfile] = useState(value?.profile || null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function lookupCoordinator() {
    setError(""); setProfile(null);
    let pubkey;
    try {
      if (input.startsWith("npub")) {
        pubkey = nip19.decode(input).data;
      } else if (input.length === 64 && /^[0-9a-f]+$/.test(input)) {
        pubkey = input;
      } else {
        setError("Enter a valid npub or hex pubkey.");
        return;
      }
    } catch {
      setError("Invalid npub format.");
      return;
    }

    setLoading(true);
    try {
      let found = null;
      for await (const msg of pool.req(
        [{ kinds: [0], authors: [pubkey], limit: 1 }],
        { signal: AbortSignal.timeout(5000) }
      )) {
        if (msg[0] === "EVENT") {
          found = JSON.parse(msg[2].content);
          found.pubkey = pubkey;
        }
        if (msg[0] === "EOSE") break;
      }
      if (!found) {
        setError("Profile not found on relays.");
        return;
      }
      if (!found.lud16 && !found.lud06) {
        setError("This profile has no Lightning address — they can't receive coordinator funds.");
        return;
      }
      setProfile(found);
      onChange({ pubkey, npub: input.startsWith("npub") ? input : nip19.npubEncode(pubkey), profile: found });
    } catch {
      setError("Failed to fetch profile.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="coordinator-picker">
      <div className="coord-input-row">
        <input
          value={input}
          onChange={(e) => { setInput(e.target.value); setProfile(null); onChange(null); }}
          placeholder="npub1... or hex pubkey"
          onKeyDown={(e) => e.key === "Enter" && lookupCoordinator()}
        />
        <button className="icon-btn" onClick={lookupCoordinator} disabled={loading}>
          <Search size={15} />
        </button>
      </div>

      {loading && <div className="coord-status dim">Looking up profile…</div>}
      {error && (
        <div className="coord-status error">
          <AlertCircle size={13} /> {error}
        </div>
      )}
      {profile && (
        <div className="coord-profile">
          {profile.picture && <img src={profile.picture} alt="" className="avatar" />}
          <div className="coord-profile-info">
            <span className="coord-name">{profile.display_name || profile.name || "Unknown"}</span>
            <span className="coord-lud">⚡ {profile.lud16 || "Has Lightning address"}</span>
          </div>
          <CheckCircle size={16} color="#39ff14" />
        </div>
      )}
    </div>
  );
}
