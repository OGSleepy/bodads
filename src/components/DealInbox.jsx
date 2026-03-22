import { useState } from "react";
import { Inbox, ChevronDown, ChevronUp, RefreshCw } from "lucide-react";
import { useDeals } from "../hooks/useDeals";
import { DealThread } from "./DealThread";

export function DealInbox({ user }) {
  const { deals, loading, refetch } = useDeals(user?.pubkey);
  const [open, setOpen] = useState(false);

  const pending = deals.filter(d => {
    if (d.myRole === "seller") {
      return d.status === "proposed" || d.status === "funded";
    }
    if (d.myRole === "advertiser") {
      return d.status === "accepted" || d.status === "proof_submitted";
    }
    if (d.myRole === "coordinator") {
      return d.status === "accepted" || d.status === "proof_submitted";
    }
    return false;
  }).length;

  if (!user) return null;

  return (
    <div className="inbox-wrapper">
      <button className="inbox-toggle" onClick={() => setOpen(o => !o)}>
        <Inbox size={15} />
        <span>Deal Inbox</span>
        {pending > 0 && <span className="inbox-badge">{pending}</span>}
        {loading
          ? <RefreshCw size={13} className="spinning" />
          : open ? <ChevronUp size={14} /> : <ChevronDown size={14} />
        }
      </button>

      {open && (
        <div className="inbox-panel">
          <div className="inbox-header">
            <span>{deals.length} deal{deals.length !== 1 ? "s" : ""}</span>
            <button className="icon-btn" onClick={refetch}>
              <RefreshCw size={13} className={loading ? "spinning" : ""} />
            </button>
          </div>

          {deals.length === 0 && !loading && (
            <div className="inbox-empty">
              No deals yet. List your body space or claim someone else's.
            </div>
          )}

          {deals.map((thread) => (
            <DealThread
              key={thread.proposal.id}
              thread={thread}
              user={user}
              onAction={refetch}
            />
          ))}
        </div>
      )}
    </div>
  );
}
