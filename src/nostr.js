import { NPool, NRelay1, NCache } from "@nostrify/nostrify";
import { EventStore } from "applesauce-core/event-store";

export const RELAYS = [
  "wss://relay.damus.io",
  "wss://nos.lol",
  "wss://relay.nostr.band",
  "wss://relay.primal.net",
];

// Custom kind for BodAds listings (NIP-99 classified)
export const BODADS_KIND = 30402;
export const BODADS_TAG = "bodads";

export const pool = new NPool({
  open(url) {
    return new NRelay1(url);
  },
  reqRouter: async (filters) => {
    return new Map(RELAYS.map((url) => [url, filters]));
  },
  eventRouter: async () => RELAYS,
});

export const eventStore = new EventStore();

export function buildListingEvent({ title, bodyPart, size, location, description, priceSats, pubkey }) {
  const dTag = `bodads-${Date.now()}`;
  return {
    kind: BODADS_KIND,
    content: description,
    tags: [
      ["d", dTag],
      ["title", title],
      ["t", BODADS_TAG],
      ["body_part", bodyPart],
      ["size", size],
      ["location", location],
      ["price", priceSats.toString(), "sats"],
      ["summary", `${size} ad space on ${bodyPart} for ${priceSats} sats`],
    ],
    created_at: Math.floor(Date.now() / 1000),
    pubkey,
  };
}

export function parseListingEvent(event) {
  const get = (tag) => event.tags.find((t) => t[0] === tag)?.[1] ?? "";
  return {
    id: event.id,
    pubkey: event.pubkey,
    title: get("title"),
    bodyPart: get("body_part"),
    size: get("size"),
    location: get("location"),
    description: event.content,
    priceSats: parseInt(get("price")) || 0,
    createdAt: event.created_at,
    event,
  };
}
