import { useState, useEffect, useCallback } from "react";
import { pool, BODADS_KIND, BODADS_TAG, parseListingEvent } from "../nostr";

export function useListings() {
  const [listings, setListings] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchListings = useCallback(async () => {
    setLoading(true);
    const seen = new Map();
    try {
      const signal = AbortSignal.timeout(8000);
      for await (const msg of pool.req(
        [{ kinds: [BODADS_KIND], "#t": [BODADS_TAG], limit: 50 }],
        { signal }
      )) {
        if (msg[0] === "EVENT") {
          const event = msg[2];
          const key = `${event.pubkey}:${event.tags.find(t => t[0] === "d")?.[1]}`;
          if (!seen.has(key) || seen.get(key).created_at < event.created_at) {
            seen.set(key, event);
          }
        }
        if (msg[0] === "EOSE") break;
      }
    } catch {
      // timeout or done
    }
    const parsed = [...seen.values()]
      .map(parseListingEvent)
      .filter((l) => l.title)
      .sort((a, b) => b.createdAt - a.createdAt);
    setListings(parsed);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchListings();
  }, [fetchListings]);

  return { listings, loading, refetch: fetchListings };
}
