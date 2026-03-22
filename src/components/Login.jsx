import { useState } from "react";
import { Zap, X, Eye, Smartphone } from "lucide-react";
import { AmberClipboardSigner } from "applesauce-signers/signers/amber-clipboard-signer";
import { ReadonlySigner } from "applesauce-signers/signers/readonly-signer";
import { nip19 } from "nostr-tools";

const isAndroid = typeof navigator !== "undefined" && navigator.userAgent.includes("Android");
const isAmberSupported = AmberClipboardSigner.SUPPORTED;

export function Login({ onLogin, onClose }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [showReadonly, setShowReadonly] = useState(false);
  const [npubInput, setNpubInput] = useState("");

  // NIP-07 extension (desktop)
  async function handleExtension() {
    if (!window.nostr) {
      setError("No Nostr extension found. Install Alby or nos2x.");
      return;
    }
    setLoading(true); setError("");
    try {
      const pubkey = await window.nostr.getPublicKey();
      onLogin({ pubkey, signer: window.nostr });
    } catch {
      setError("Login cancelled.");
    } finally {
      setLoading(false);
    }
  }

  // Amber (Android)
  async function handleAmber() {
    setLoading(true); setError("");
    try {
      const signer = new AmberClipboardSigner();
      const pubkey = await signer.getPublicKey();
      onLogin({ pubkey, signer });
    } catch (e) {
      setError("Amber login failed: " + e.message);
    } finally {
      setLoading(false);
    }
  }

  // Read-only via npub (browse without signing)
  async function handleReadonly() {
    if (!npubInput.trim()) { setError("Enter your npub."); return; }
    setLoading(true); setError("");
    try {
      let pubkey;
      if (npubInput.startsWith("npub")) {
        pubkey = nip19.decode(npubInput.trim()).data;
      } else if (/^[0-9a-f]{64}$/.test(npubInput.trim())) {
        pubkey = npubInput.trim();
      } else {
        setError("Invalid npub or hex pubkey."); setLoading(false); return;
      }
      const signer = new ReadonlySigner(pubkey);
      onLogin({ pubkey, signer, readonly: true });
    } catch {
      setError("Invalid npub format.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="login-screen" onClick={onClose}>
      <div className="login-card" onClick={(e) => e.stopPropagation()}>
        <div className="login-icon"><Zap size={28} /></div>
        <h2>Connect Your Identity</h2>
        <p>Log in with your Nostr identity to list your body space or claim someone else's.</p>

        {error && <div className="error-msg">{error}</div>}

        <div className="login-methods">
          {/* Amber — show first on Android */}
          {isAndroid && (
            <button className="login-method-btn amber" onClick={handleAmber} disabled={loading}>
              <Smartphone size={16} />
              <div className="login-method-text">
                <span className="lm-title">Login with Amber</span>
                <span className="lm-sub">Android · Recommended</span>
              </div>
            </button>
          )}

          {/* NIP-07 Extension */}
          <button className="login-method-btn extension" onClick={handleExtension} disabled={loading}>
            <Zap size={16} />
            <div className="login-method-text">
              <span className="lm-title">
                {loading ? "Connecting…" : "Login with Extension"}
              </span>
              <span className="lm-sub">Alby, nos2x, Flamingo · Desktop</span>
            </div>
          </button>

          {/* Amber — show on non-Android too as fallback */}
          {!isAndroid && (
            <button className="login-method-btn amber" onClick={handleAmber} disabled={loading}>
              <Smartphone size={16} />
              <div className="login-method-text">
                <span className="lm-title">Login with Amber</span>
                <span className="lm-sub">Android clipboard signer</span>
              </div>
            </button>
          )}

          {/* Read-only */}
          {!showReadonly ? (
            <button className="login-method-btn readonly" onClick={() => setShowReadonly(true)}>
              <Eye size={16} />
              <div className="login-method-text">
                <span className="lm-title">Browse Read-Only</span>
                <span className="lm-sub">Enter npub · Can't post or claim</span>
              </div>
            </button>
          ) : (
            <div className="readonly-input-wrap">
              <input
                value={npubInput}
                onChange={e => setNpubInput(e.target.value)}
                placeholder="npub1…"
                autoFocus
                onKeyDown={e => e.key === "Enter" && handleReadonly()}
              />
              <button className="btn-primary" onClick={handleReadonly} disabled={loading}>
                {loading ? "…" : "Browse"}
              </button>
            </div>
          )}
        </div>

        {onClose && (
          <button className="icon-btn login-close" onClick={onClose}>
            <X size={16} />
          </button>
        )}
      </div>
    </div>
  );
}
