// Nostr event kinds for BodAds deals
export const DEAL_PROPOSAL_KIND  = 30403;
export const DEAL_ACCEPTANCE_KIND = 30404;
export const DEAL_FUNDED_KIND    = 30407; // escrow funded — separate from acceptance
export const DEAL_PROOF_KIND     = 30405;
export const DEAL_RELEASE_KIND   = 30406;
export const DEAL_CANCEL_KIND    = 30408;

export const DEAL_STATUS = {
  PROPOSED:        "proposed",
  ACCEPTED:        "accepted",
  FUNDED:          "funded",
  PROOF_SUBMITTED: "proof_submitted",
  COMPLETED:       "completed",
  DISPUTED:        "disputed",
  CANCELLED:       "cancelled",
};

export function buildDealProposal({
  listingEventId, bodyPersonPubkey, coordinatorPubkey,
  escrowType, mintUrl, priceSats, pubkey,
}) {
  const dTag = `deal-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  const tags = [
    ["d", dTag],
    ["e", listingEventId, "", "listing"],
    ["p", bodyPersonPubkey, "", "seller"],
    ["escrow", escrowType],
    ["price", priceSats.toString(), "sats"],
    ["status", DEAL_STATUS.PROPOSED],
    ["t", "bodads-deal"],
  ];
  if (coordinatorPubkey) tags.push(["p", coordinatorPubkey, "", "coordinator"]);
  if (escrowType === "cashu" && mintUrl) tags.push(["mint", mintUrl]);
  return { kind: DEAL_PROPOSAL_KIND, content: "", tags, created_at: Math.floor(Date.now() / 1000), pubkey };
}

export function buildDealAcceptance({ dealEventId, advertiserPubkey, coordinatorPubkey, pubkey }) {
  return {
    kind: DEAL_ACCEPTANCE_KIND, content: "",
    tags: [
      ["e", dealEventId, "", "deal"],
      ["p", advertiserPubkey, "", "buyer"],
      ...(coordinatorPubkey ? [["p", coordinatorPubkey, "", "coordinator"]] : []),
      ["status", DEAL_STATUS.ACCEPTED],
      ["t", "bodads-deal"],
    ],
    created_at: Math.floor(Date.now() / 1000), pubkey,
  };
}

// Published by advertiser after Cashu invoice is paid
// Encrypted token sent via NIP-04 to body person's pubkey
export function buildFundedEvent({ dealEventId, bodyPersonPubkey, encryptedToken, mintUrl, locktimeTs, pubkey }) {
  return {
    kind: DEAL_FUNDED_KIND, content: encryptedToken,
    tags: [
      ["e", dealEventId, "", "deal"],
      ["p", bodyPersonPubkey, "", "seller"],
      ["mint", mintUrl],
      ["locktime", locktimeTs.toString()],
      ["status", DEAL_STATUS.FUNDED],
      ["t", "bodads-deal"],
    ],
    created_at: Math.floor(Date.now() / 1000), pubkey,
  };
}

// Coordinator confirms they received sats (coordinator escrow path)
export function buildCoordinatorFundedEvent({ dealEventId, bodyPersonPubkey, advertiserPubkey, pubkey }) {
  return {
    kind: DEAL_FUNDED_KIND, content: "",
    tags: [
      ["e", dealEventId, "", "deal"],
      ["p", bodyPersonPubkey, "", "seller"],
      ["p", advertiserPubkey, "", "buyer"],
      ["status", DEAL_STATUS.FUNDED],
      ["t", "bodads-deal"],
    ],
    created_at: Math.floor(Date.now() / 1000), pubkey,
  };
}

export function buildProofEvent({ dealEventId, advertiserPubkey, imageUrl, note, pubkey }) {
  return {
    kind: DEAL_PROOF_KIND, content: note || "",
    tags: [
      ["e", dealEventId, "", "deal"],
      ["p", advertiserPubkey, "", "buyer"],
      ["image", imageUrl],
      ["status", DEAL_STATUS.PROOF_SUBMITTED],
      ["t", "bodads-deal"],
    ],
    created_at: Math.floor(Date.now() / 1000), pubkey,
  };
}

// For Cashu: advertiser NIP-04 encrypts the token to body person, publishes as release
// Body person decrypts and redeems with their key
export function buildCashuReleaseEvent({ dealEventId, bodyPersonPubkey, encryptedToken, mintUrl, pubkey }) {
  return {
    kind: DEAL_RELEASE_KIND, content: encryptedToken,
    tags: [
      ["e", dealEventId, "", "deal"],
      ["p", bodyPersonPubkey, "", "seller"],
      ["mint", mintUrl],
      ["escrow", "cashu"],
      ["status", DEAL_STATUS.COMPLETED],
      ["t", "bodads-deal"],
    ],
    created_at: Math.floor(Date.now() / 1000), pubkey,
  };
}

// For coordinator: just publishes confirmation
export function buildDealRelease({ dealEventId, bodyPersonPubkey, pubkey }) {
  return {
    kind: DEAL_RELEASE_KIND, content: "",
    tags: [
      ["e", dealEventId, "", "deal"],
      ["p", bodyPersonPubkey, "", "seller"],
      ["status", DEAL_STATUS.COMPLETED],
      ["t", "bodads-deal"],
    ],
    created_at: Math.floor(Date.now() / 1000), pubkey,
  };
}

export function buildCancelEvent({ dealEventId, otherPubkey, pubkey }) {
  return {
    kind: DEAL_CANCEL_KIND, content: "",
    tags: [
      ["e", dealEventId, "", "deal"],
      ["p", otherPubkey],
      ["status", DEAL_STATUS.CANCELLED],
      ["t", "bodads-deal"],
    ],
    created_at: Math.floor(Date.now() / 1000), pubkey,
  };
}

export function parseDealEvent(event) {
  const get = (tag) => event.tags.find((t) => t[0] === tag)?.[1] ?? "";
  const getRole = (role) => event.tags.find((t) => t[0] === "p" && t[3] === role)?.[1] ?? "";
  return {
    id: event.id,
    dTag: get("d"),
    pubkey: event.pubkey,
    listingEventId: event.tags.find((t) => t[0] === "e" && t[3] === "listing")?.[1] ?? "",
    dealEventId: event.tags.find((t) => t[0] === "e" && t[3] === "deal")?.[1] ?? "",
    bodyPersonPubkey: getRole("seller"),
    advertiserPubkey: getRole("buyer"),
    coordinatorPubkey: getRole("coordinator"),
    escrowType: get("escrow"),
    mintUrl: get("mint"),
    locktimeTs: parseInt(get("locktime")) || 0,
    priceSats: parseInt(get("price")) || 0,
    status: get("status"),
    imageUrl: get("image"),
    encryptedToken: event.content || "",
    createdAt: event.created_at,
    event,
  };
}
