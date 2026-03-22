import { useState } from "react";
import { Zap, X } from "lucide-react";

export function Login({ onLogin, onClose }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleLogin() {
    if (!window.nostr) {
      setError("No Nostr extension found. Install Alby, nos2x, or similar.");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const pubkey = await window.nostr.getPublicKey();
      onLogin({ pubkey, signer: window.nostr });
    } catch {
      setError("Login cancelled or failed.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="login-screen" onClick={onClose}>
      <div className="login-card" onClick={(e) => e.stopPropagation()}>
        <div className="login-icon">
          <Zap size={28} />
        </div>
        <h2>Connect Nostr Identity</h2>
        <p>Use your Nostr browser extension to log in and start posting or browsing body ad listings.</p>
        {error && <div className="error-msg">{error}</div>}
        <button className="btn-primary full" onClick={handleLogin} disabled={loading}>
          {loading ? "Connecting…" : "Login with Extension"}
        </button>
        <p className="hint">Works with Alby, nos2x, Flamingo &amp; more</p>
        {onClose && (
          <button className="icon-btn" onClick={onClose} style={{ marginTop: "0.5rem" }}>
            <X size={16} />
          </button>
        )}
      </div>
    </div>
  );
}
