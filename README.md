# ⚡ BodAds

> The most degenerate advertising marketplace ever conceived.

**BodAds** is a Nostr-native marketplace where people list ad space on their body — tattoos, temporary ink, whatever — and get paid in Bitcoin sats via Lightning zaps. Built with [Nostrify](https://nostrify.dev) and [Applesauce](https://github.com/hzrd149/applesauce).

*#KeepNostrWeird*

---

## 🗂 Repo Structure

```
bodads/
├── public/
│   ├── favicon.svg            # App icon
│   └── _redirects             # Cloudflare Pages SPA routing rule
│
├── src/
│   ├── components/
│   │   ├── CreateListing.jsx  # Form to publish a new body ad listing
│   │   ├── ListingCard.jsx    # Card UI for a single listing with zap button
│   │   └── Login.jsx          # NIP-07 extension login modal
│   │
│   ├── hooks/
│   │   ├── useListings.js     # Fetches all BodAds listings from relays
│   │   └── useProfile.js      # Fetches NIP-01 profile metadata by pubkey
│   │
│   ├── nostr.js               # NPool relay setup, event kind, build/parse helpers
│   ├── App.jsx                # Root component — layout, routing state, modals
│   ├── main.jsx               # React entry point
│   └── index.css              # Global styles (dark cyberpunk aesthetic)
│
├── index.html                 # HTML shell
├── vite.config.js             # Vite config
├── package.json
└── README.md
```

---

## 🛠 Tech Stack

| Layer | Library |
|---|---|
| Framework | React 18 + Vite |
| Nostr relay pool | [@nostrify/nostrify](https://nostrify.dev) — `NPool` + `NRelay1` |
| Nostr state | [applesauce-react](https://github.com/hzrd149/applesauce) hooks |
| Signing | NIP-07 browser extension (`window.nostr`) |
| Styling | Plain CSS with CSS variables |
| Icons | [lucide-react](https://lucide.dev) |

---

## 🔌 Relays

Listings are published to and fetched from:

- `wss://relay.damus.io`
- `wss://nos.lol`
- `wss://relay.primal.net`

To change relays, edit the `RELAYS` array in `src/nostr.js`.

---

## 📦 Nostr Event Format

Listings use **kind 30402** (NIP-99 Classified Listings) with a custom `#t` tag for filtering.

```json
{
  "kind": 30402,
  "content": "<description>",
  "tags": [
    ["d", "bodads-<timestamp>"],
    ["title", "Bitcoin logo on my forearm"],
    ["t", "bodads"],
    ["body_part", "Forearm"],
    ["size", "medium"],
    ["location", "Miami, FL"],
    ["price", "500000", "sats"]
  ]
}
```

---

## 🚀 Local Development

```bash
# 1. Clone the repo
git clone https://github.com/YOUR_USERNAME/bodads.git
cd bodads

# 2. Install dependencies
npm install

# 3. Start dev server
npm run dev
```

You'll need a NIP-07 browser extension to log in and post listings:
- [Alby](https://getalby.com)
- [nos2x](https://github.com/fiatjaf/nos2x)
- [Flamingo](https://www.getflamingo.org)

---

## ☁️ Deploy on Cloudflare Pages

### Option A — Connect GitHub repo (recommended)

1. Push this repo to GitHub
2. Go to [Cloudflare Pages](https://pages.cloudflare.com) → **Create a project** → **Connect to Git**
3. Select your `bodads` repo
4. Set build settings:

| Setting | Value |
|---|---|
| **Framework preset** | None (or Vite) |
| **Build command** | `npm run build` |
| **Build output directory** | `dist` |
| **Node.js version** | `18` or higher |

5. Click **Save and Deploy** — done.

> The `public/_redirects` file handles SPA client-side routing automatically on Cloudflare Pages.

### Option B — Direct upload

```bash
npm run build
```

Then drag-and-drop the `dist/` folder into Cloudflare Pages **Direct Upload**.

---

## 🔮 Roadmap

- [ ] Real NIP-57 Lightning zaps (LNURL flow)
- [ ] NIP-04 encrypted DMs to contact sellers
- [ ] Photo uploads via NIP-94 / Blossom
- [ ] Zap-to-claim confirmation flow
- [ ] Search and sort listings
- [ ] Profile page showing all your listings

---

## ⚖️ License

MIT — do whatever you want with it. #KeepNostrWeird
LFG
