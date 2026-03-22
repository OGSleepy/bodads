import { useState } from "react";
import { Plus, RefreshCw, LogOut, Zap, Wifi } from "lucide-react";
import { Login } from "./components/Login";
import { DealInbox } from "./components/DealInbox";
import { CreateListing } from "./components/CreateListing";
import { ListingCard } from "./components/ListingCard";
import { useListings } from "./hooks/useListings";

const FILTERS = ["All", "Forearm", "Chest", "Back (Upper)", "Neck", "Hand", "Other"];

function Header({ user, onLogout, onNew, onLogin }) {
  return (
    <header className="app-header">
      <div className="header-brand">
        <div className="brand-icon">⚡</div>
        <div className="brand-text">
          <span className="brand-name">BodAds</span>
          <span className="brand-sub">Body Ad Space on Nostr</span>
        </div>
      </div>
      <nav className="header-nav">
        {user ? (
          <>
            {!user.readonly && (
              <button className="btn-primary" onClick={onNew}>
                <Plus size={15} /> List My Space
              </button>
            )}
            <button className="icon-btn dim" onClick={onLogout} title="Logout">
              <LogOut size={16} />
            </button>
          </>
        ) : (
          <button className="btn-primary" onClick={onLogin}>
            Login
          </button>
        )}
      </nav>
    </header>
  );
}

function Hero({ onNew }) {
  return (
    <section className="hero">
      <div className="hero-noise" />
      <div className="hero-content">
        <div className="hero-tag">#KeepNostrWeird</div>
        <h1 className="hero-title">
          Sell Ad Space<br />
          <span className="hero-accent">On Your Body</span>
        </h1>
        <p className="hero-desc">
          The most degenerate advertising marketplace ever conceived.
          Get zapped in sats to permanently ink a brand logo on your skin.
          Powered by Bitcoin &amp; Nostr.
        </p>
        <div className="hero-stats">
          <div className="stat"><Zap size={14} /> Paid in Sats</div>
          <div className="stat"><Wifi size={14} /> Nostr Native</div>
          <div className="stat">🔥 Censorship Resistant</div>
        </div>
        <button className="btn-hero" onClick={onNew}>
          <Plus size={16} /> List My Body Space
        </button>
      </div>
      <div className="hero-visual">
        <div className="tattoo-ring" />
        <div className="tattoo-ring ring2" />
        <div className="tattoo-ring ring3" />
        <div className="center-glyph">⚡</div>
      </div>
    </section>
  );
}

export default function App() {
  const [user, setUser] = useState(null);
  const [showLogin, setShowLogin] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [filter, setFilter] = useState("All");
  const { listings, loading, refetch } = useListings();

  function handleNew() {
    if (!user) { setShowLogin(true); return; }
    if (user.readonly) { alert("Log in with a signing key to list your body space."); return; }
    setShowCreate(true);
  }

  const filtered = filter === "All"
    ? listings
    : listings.filter((l) => l.bodyPart === filter);

  return (
    <div className="app">
      <Header user={user} onLogout={() => setUser(null)} onNew={handleNew} onLogin={() => setShowLogin(true)} />
      <DealInbox user={user} />
      <Hero onNew={handleNew} />

      <main className="main-content">
        <div className="section-header">
          <h2 className="section-title">Available Ad Space</h2>
          <button className="icon-btn" onClick={refetch} title="Refresh">
            <RefreshCw size={15} className={loading ? "spinning" : ""} />
          </button>
        </div>

        <div className="filter-bar">
          {FILTERS.map((f) => (
            <button
              key={f}
              className={`filter-chip ${filter === f ? "active" : ""}`}
              onClick={() => setFilter(f)}
            >
              {f}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="loading-state">
            <div className="pulse-dot" />
            <span>Scanning Nostr relays…</span>
          </div>
        ) : filtered.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">🫀</div>
            <h3>No listings yet</h3>
            <p>Be the first degenerate to list your body as ad space.</p>
            <button className="btn-primary" onClick={handleNew}>
              <Plus size={14} /> List My Body
            </button>
          </div>
        ) : (
          <div className="listings-grid">
            {filtered.map((l) => (
              <ListingCard key={l.id} listing={l} user={user} onRefetch={refetch} />
            ))}
          </div>
        )}
      </main>

      {showLogin && (
        <Login
          onLogin={(u) => { setUser(u); setShowLogin(false); }}
          onClose={() => setShowLogin(false)}
        />
      )}

      {showCreate && user && (
        <CreateListing
          pubkey={user.pubkey}
          signer={user.signer}
          onClose={() => setShowCreate(false)}
          onPublished={refetch}
        />
      )}

      <footer className="app-footer">
        <span>Built on Nostr · Paid in Sats · #KeepNostrWeird</span>
      </footer>
    </div>
  );
}
