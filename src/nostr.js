import { NPool, NRelay1 } from "@nostrify/nostrify";

export const RELAYS = [
  "wss://relay.damus.io",
  "wss://nos.lol",
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

// Publish a "closed" version of a listing to remove it from the feed
export function buildCloseListingEvent(listing) {
  return {
    kind: BODADS_KIND,
    content: listing.event.content,
    tags: [
      ...listing.event.tags.filter(t => t[0] !== "status"),
      ["status", "closed"],
    ],
    created_at: Math.floor(Date.now() / 1000),
    pubkey: listing.pubkey,
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
    status: get("status"),
    createdAt: event.created_at,
    event,
  };
}
