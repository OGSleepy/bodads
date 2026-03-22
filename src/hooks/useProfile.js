import { useState, useEffect } from "react";
import { pool } from "../nostr";

const profileCache = new Map();

export function useProfile(pubkey) {
  const [profile, setProfile] = useState(profileCache.get(pubkey) ?? null);

  useEffect(() => {
    if (!pubkey || profileCache.has(pubkey)) return;
    const ctrl = new AbortController();
    (async () => {
      try {
        for await (const msg of pool.req(
          [{ kinds: [0], authors: [pubkey], limit: 1 }],
          { signal: AbortSignal.timeout(5000) }
        )) {
          if (msg[0] === "EVENT") {
            try {
              const meta = JSON.parse(msg[2].content);
              profileCache.set(pubkey, meta);
              setProfile(meta);
            } catch {}
          }
          if (msg[0] === "EOSE") break;
        }
      } catch {}
    })();
    return () => ctrl.abort();
  }, [pubkey]);

  return profile;
}
