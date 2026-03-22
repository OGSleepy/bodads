import { useState, useEffect, useCallback } from "react";
import { pool } from "../nostr";
import { DEAL_PROPOSAL_KIND, DEAL_ACCEPTANCE_KIND, DEAL_PROOF_KIND, DEAL_RELEASE_KIND, parseDealEvent } from "../deals";

const DEAL_KINDS = [DEAL_PROPOSAL_KIND, DEAL_ACCEPTANCE_KIND, DEAL_PROOF_KIND, DEAL_RELEASE_KIND];

export function useDeals(pubkey) {
  const [deals, setDeals] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchDeals = useCallback(async () => {
    if (!pubkey) return;
    setLoading(true);
    const seen = new Map();
    try {
      for await (const msg of pool.req(
        [
          // Deals I proposed (as advertiser)
          { kinds: DEAL_KINDS, authors: [pubkey], "#t": ["bodads-deal"], limit: 50 },
          // Deals where I'm tagged (as body person or coordinator)
          { kinds: DEAL_KINDS, "#p": [pubkey], "#t": ["bodads-deal"], limit: 50 },
        ],
        { signal: AbortSignal.timeout(8000) }
      )) {
        if (msg[0] === "EVENT") {
          const ev = msg[2];
          if (!seen.has(ev.id)) seen.set(ev.id, ev);
        }
        if (msg[0] === "EOSE") break;
      }
    } catch {}

    const parsed = [...seen.values()]
      .map(parseDealEvent)
      .sort((a, b) => b.createdAt - a.createdAt);

    // Group by deal thread — link proposals to their responses
    const threads = groupDealThreads(parsed, pubkey);
    setDeals(threads);
    setLoading(false);
  }, [pubkey]);

  useEffect(() => { fetchDeals(); }, [fetchDeals]);

  return { deals, loading, refetch: fetchDeals };
}

function groupDealThreads(events, myPubkey) {
  const proposals = events.filter(e => e.event.kind === DEAL_PROPOSAL_KIND);
  const responses = events.filter(e => e.event.kind !== DEAL_PROPOSAL_KIND);

  return proposals.map(proposal => {
    const linked = responses.filter(r =>
      r.dealEventId === proposal.id || r.event.tags.some(t => t[0] === "e" && t[1] === proposal.id)
    );
    const acceptance = linked.find(r => r.event.kind === DEAL_ACCEPTANCE_KIND);
    const proof = linked.find(r => r.event.kind === DEAL_PROOF_KIND);
    const release = linked.find(r => r.event.kind === DEAL_RELEASE_KIND);

    const myRole =
      proposal.pubkey === myPubkey ? "advertiser" :
      proposal.bodyPersonPubkey === myPubkey ? "seller" :
      proposal.coordinatorPubkey === myPubkey ? "coordinator" : "observer";

    const status =
      release ? "completed" :
      proof ? "proof_submitted" :
      acceptance ? "accepted" :
      "proposed";

    return { proposal, acceptance, proof, release, myRole, status };
  });
}
