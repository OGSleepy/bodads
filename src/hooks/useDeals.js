import { useState, useEffect, useCallback } from "react";
import { pool } from "../nostr";
import {
  DEAL_PROPOSAL_KIND, DEAL_ACCEPTANCE_KIND, DEAL_FUNDED_KIND,
  DEAL_PROOF_KIND, DEAL_RELEASE_KIND, DEAL_CANCEL_KIND,
  parseDealEvent
} from "../deals";

const DEAL_KINDS = [
  DEAL_PROPOSAL_KIND, DEAL_ACCEPTANCE_KIND, DEAL_FUNDED_KIND,
  DEAL_PROOF_KIND, DEAL_RELEASE_KIND, DEAL_CANCEL_KIND,
];

export function useDeals(pubkey) {
  const [deals, setDeals] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchDeals = useCallback(async () => {
    if (!pubkey) { setLoading(false); return; }
    setLoading(true);
    const seen = new Map();
    try {
      for await (const msg of pool.req(
        [
          { kinds: DEAL_KINDS, authors: [pubkey], "#t": ["bodads-deal"], limit: 100 },
          { kinds: DEAL_KINDS, "#p": [pubkey], "#t": ["bodads-deal"], limit: 100 },
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

  return proposals
    .filter(p => p.status !== "cancelled")
    .map(proposal => {
      const linked = responses.filter(r =>
        r.dealEventId === proposal.id ||
        r.event.tags.some(t => t[0] === "e" && t[1] === proposal.id)
      );

      const acceptance = linked.find(r => r.event.kind === DEAL_ACCEPTANCE_KIND);
      const funded     = linked.find(r => r.event.kind === DEAL_FUNDED_KIND);
      const proof      = linked.find(r => r.event.kind === DEAL_PROOF_KIND);
      const release    = linked.find(r => r.event.kind === DEAL_RELEASE_KIND);
      const cancel     = linked.find(r => r.event.kind === DEAL_CANCEL_KIND);

      const myRole =
        proposal.pubkey === myPubkey           ? "advertiser" :
        proposal.bodyPersonPubkey === myPubkey  ? "seller" :
        proposal.coordinatorPubkey === myPubkey ? "coordinator" : "observer";

      const status =
        cancel   ? "cancelled"       :
        release  ? "completed"       :
        proof    ? "proof_submitted" :
        funded   ? "funded"          :
        acceptance ? "accepted"      : "proposed";

      return { proposal, acceptance, funded, proof, release, cancel, myRole, status };
    })
    .filter(t => t.status !== "cancelled");
}
