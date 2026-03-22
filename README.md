# ⚡ BodAds

> The most degenerate advertising marketplace ever conceived.

**BodAds** is a Nostr-native marketplace where people list ad space on their body — tattoos, temporary ink, whatever — and get paid in Bitcoin sats. Built with [Nostrify](https://nostrify.dev) and [Applesauce](https://github.com/hzrd149/applesauce).

*#KeepNostrWeird*

Live at **[bodads.pages.dev](https://bodads.pages.dev)**

---

## 🗂 File Structure

```
bodads/
├── public/
│   ├── favicon.svg
│   ├── og-image.png              # Open Graph preview image for Nostr link previews
│   └── _redirects                # Cloudflare Pages SPA routing
│
├── src/
│   ├── components/
│   │   ├── App.jsx               # Root — layout, login state, modals
│   │   ├── ClaimModal.jsx        # Multi-step flow for advertisers to claim ad space
│   │   ├── CoordinatorPicker.jsx # npub input that resolves Nostr profile + Lightning address
│   │   ├── CreateListing.jsx     # Form to publish a body ad listing
│   │   ├── DealInbox.jsx         # Collapsible inbox showing all deals with action badge
│   │   ├── DealThread.jsx        # Full deal lifecycle UI for all parties
│   │   ├── ImageUpload.jsx       # Blossom upload with NIP-98 auth + camera roll support
│   │   ├── ListingCard.jsx       # Card UI with Claim button and close listing option
│   │   └── Login.jsx             # NIP-07 extension, Amber (Android), read-only browse
│   │
│   ├── hooks/
│   │   ├── useDeals.js           # Fetches and groups deal threads for a pubkey
│   │   ├── useListings.js        # Fetches active listings from relays
│   │   └── useProfile.js         # Fetches NIP-01 profile metadata with cache
│   │
│   ├── cashu.js                  # Cashu P2PK escrow: invoices, polling, locking, redemption
│   ├── deals.js                  # Nostr event builders and parsers for all deal kinds
│   ├── nostr.js                  # NPool relay setup, listing event builders
│   ├── main.jsx                  # React entry point
│   └── index.css                 # Global styles — dark cyberpunk tattoo parlor aesthetic
│
├── index.html                    # HTML shell with OG meta tags
├── vite.config.js
├── package.json
└── README.md
```

---

## 🛠 Tech Stack

| Layer | Library |
|---|---|
| Framework | React 18 + Vite |
| Nostr relay pool | [@nostrify/nostrify](https://nostrify.dev) — `NPool` + `NRelay1` |
| Nostr signing | [applesauce-signers](https://github.com/hzrd149/applesauce) — NIP-07, Amber, ReadOnly |
| Cashu escrow | [@cashu/cashu-ts](https://github.com/cashubtc/cashu-ts) v3 — P2PK NUT-11 |
| Image uploads | Blossom (BUD-02) with NIP-98 auth |
| Icons | [lucide-react](https://lucide.dev) |

---

## 🔌 Relays

Events are published to and fetched from:

- `wss://relay.damus.io`
- `wss://nos.lol`
- `wss://relay.primal.net`

To change relays, edit the `RELAYS` array in `src/nostr.js`.

---

## 📦 Nostr Event Kinds

### Listings (NIP-99 Classified)

| Kind | Description |
|---|---|
| `30402` | Body ad space listing — parameterized replaceable, `d` tag = unique listing ID |

### Deals

| Kind | Description |
|---|---|
| `30403` | Deal proposal — advertiser → body person |
| `30404` | Deal acceptance — body person accepts |
| `30405` | Proof submission — body person posts tattoo photo |
| `30406` | Deal release — payment confirmed/released |
| `30407` | Escrow funded — Cashu token locked or coordinator confirmed receipt |
| `30408` | Deal cancelled — either party cancels |

All deal events use `["d", dealEventId]` so they are proper parameterized replaceable events — relays keep the latest per pubkey per deal.

### Listing event tags

```json
{
  "kind": 30402,
  "tags": [
    ["d", "bodads-<timestamp>"],
    ["title", "Bitcoin logo on my forearm"],
    ["t", "bodads"],
    ["body_part", "Forearm"],
    ["size", "medium"],
    ["location", "Miami, FL"],
    ["price", "500000", "sats"],
    ["status", "open"]
  ]
}
```

---

## 💸 Escrow Flows

### Cashu Escrow (Trustless)

1. Advertiser picks a Cashu mint — app checks it supports NUT-11 (P2PK)
2. Advertiser gets a Lightning invoice, pays it
3. App polls the mint until paid, then locks tokens to body person's Nostr pubkey using P2PK spending condition with a 7-day timelock refund
4. Locked token is NIP-04 encrypted to body person and published as a `30407` funded event
5. Body person gets tattoo, uploads photo proof via Blossom
6. Advertiser verifies proof and publishes the encrypted token as a `30406` release event
7. Body person enters their nsec (in-memory only, never stored) to redeem the tokens from the mint
8. If advertiser ghosts after proof, body person can claim unilaterally after the 7-day timelock

### Coordinator Escrow (Simple)

1. Both parties agree on a coordinator — any Nostr user with a Lightning address (`lud16`)
2. Advertiser pays the coordinator's Lightning address directly
3. Coordinator confirms receipt by publishing a `30407` funded event
4. Body person gets tattoo and submits photo proof
5. Coordinator verifies and publishes a `30406` release event
6. Coordinator pays the body person's Lightning address

---

## 📸 Image Uploads

Proof photos are uploaded to Blossom (BUD-02) using NIP-98 HTTP Auth. The upload is signed with the user's Nostr key. Three servers are tried in order:

1. `blossom.primal.net`
2. `blossom.band`
3. `cdn.satellite.earth`

Users can also paste a direct image URL as a fallback.

---

## 🔐 Login Methods

- **NIP-07 Extension** — Alby, nos2x, Flamingo (desktop)
- **Amber** — Android clipboard signer
- **Read-only** — Enter any npub to browse listings without signing

---

## 🚀 Local Development

```bash
git clone https://github.com/OGSleepy/bodads.git
cd bodads
npm install
npm run dev
```

You'll need a NIP-07 browser extension or Amber to log in and post listings.

---

## ☁️ Deploy on Cloudflare Pages

1. Push to GitHub
2. Go to [Cloudflare Pages](https://pages.cloudflare.com) → Create project → Connect to Git
3. Set build settings:

| Setting | Value |
|---|---|
| Build command | `npm run build` |
| Output directory | `dist` |
| Node.js version | `18` |

The `public/_redirects` file handles SPA client-side routing automatically.

---

## 🔮 Roadmap (Post-V1)

- [ ] NIP-57 Lightning zaps on listings
- [ ] Dispute resolution flow
- [ ] Push notifications via NIP-59 (gift wrap)
- [ ] Multiple proof photos per deal
- [ ] Search and filter by location/price
- [ ] Profile page with listing history and deal reputation

---

## ⚖️ License

MIT — do whatever you want with it. #KeepNostrWeird
