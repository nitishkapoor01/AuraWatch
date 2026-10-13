# AuraWatch Active Features & Repository Knowledge Base

## 1. Branch Safety & Deployment Contract (CRITICAL)
- **`main` Branch**:
  - Purpose: **Live Production**. Directly deployed to `https://www.aurawatch.fun` (Render backend + Frontend).
  - Rule: **NEVER push unapproved features, experimental paid/VIP features, or broken layouts to `main` or `origin/main`**.
  - All changes on `main` must be production-ready and free of unapproved monetization banners.
- **`feature/vip` Branch**:
  - Purpose: **VIP Ad-Free & UPI Monetization System**.
  - Rule: **STRICTLY LOCAL**. Kept isolated on `feature/vip`.
  - **DO NOT MERGE OR PUSH TO `origin/main`** unless the user explicitly gives the direct instruction: *"Merge VIP to main and push"*.

---

## 2. Active & Paused Features (Recent Work)

### 1. Custom Playlists & Collections Hub
- **Branch**: `main`
- **Status**: ⏸️ **Paused / In Progress**
- **Purpose**: Allow users to create custom playlists/collections by custom name (so `My List` doesn't get cluttered with 50+ movies together). Supports public shareable links (`/shared-playlist/:id`).
- **Files**:
  - Backend: `backend/routes/playlists.js` (Full REST API for CRUD, privacy toggles, adding/removing media items).
  - Frontend: `frontend/src/components/PlaylistModal.jsx`, `frontend/src/components/PlaylistModal.module.css`.
  - Pages: `frontend/src/pages/MyList.jsx`, `frontend/src/pages/SharedPlaylist.jsx`.
- **Pending Work**: Connecting the modal to detail pages and movie cards, 2x2 collage view in My List.

### 2. Cinema Roulette / Aura Arcade Reel
- **Branch**: `main`
- **Status**: ⏸️ **Polished / Iteration on Hold**
- **Purpose**: Replaces basic "Surprise Me" button with an interactive cinematic arcade reel.
- **Files**:
  - Frontend: `frontend/src/components/CinemaRouletteModal.jsx`, `frontend/src/components/CinemaRouletteModal.module.css`.
  - Backend: `backend/routes/roulette.js`.
- **Status details**:
  - Features real movie thumbnails on conveyor strip, realistic sound clicks, 5.0s suspenseful deceleration glide.
  - Fake badges ("4K ULTRA HD", "CERTIFIED PICK") have been removed from the result card.

### 3. VIP Ad-Free & UPI Monetization System
- **Branch**: `feature/vip`
- **Status**: ⏸️ **Local Only / Paused**
- **Files**:
  - Backend: `backend/routes/vip.js`, `backend/routes/admin.js`, schema migrations for orders and gift codes.
  - Frontend: `frontend/src/components/VipModal.jsx`, `frontend/src/components/VipModal.module.css`, `useVip` state hook, admin approval panel.
- **Rule**: STRICTLY kept on branch `feature/vip`. Do not merge to `main` or push to remote without explicit user command.

---

## 3. Previously Built Features Kept Dormant / Never Taken Live

### 4. Live TV / IPTV Channels Streaming
- **Status**: 📦 **Built in Backend / Never Linked to Frontend**
- **Files**:
  - Backend: `backend/routes/livetv.js` (M3U playlist parser, channel categories, logos, stream proxies).
- **Context**: Backend endpoints exist to parse M3U sources (IPTV-org, JioTV streams), but no live frontend tab/route was launched to keep site simple and focused on VOD movies/series.

### 5. AI Smart Search (Groq AI)
- **Status**: 🛑 **Disabled / UI Removed**
- **Context**:
  - Previously implemented conversational AI search powered by Groq LLM (`groq-sdk`).
  - Disabled and UI components removed (commits `5d27a15` and `2a7fe42`) to avoid API costs, simplify the search experience, and keep fast instant TMDB search.
  - Do not re-enable unless the user explicitly requests AI search back.

### 6. Torrent & Multi-Source Download Scraper
- **Status**: 📦 **Built in Backend / Hidden from Live Movie Detail UI**
- **Files**:
  - Backend: `backend/routes/downloads.js`, `backend/utils/movieCrawler.js`.
  - Direct sources: MoviesVerse, UHDMovies, 1337x, VidVault.
- **Context**: Backend scraper engine exists with 24h caching in `download_cache` table. Kept off live movie detail page to avoid link rot, slow scraper wait times, and copyright scrutiny.

---

## 4. Quick Context Switch Commands
- To work on VIP: `git checkout feature/vip`
- To work on Live Site / Playlists / Roulette: `git checkout main`
- Check active branch before pushing: `git branch --show-current`
