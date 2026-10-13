# AuraWatch - Development Roadmap & Master Feature Tracker

> **Permanent Project Memory**: This document tracks active branches, paused work, and dormant unreleased features across all future sessions.

---

## 🚦 Branch Strategy
| Branch | Target Environment | Status | Rules |
| :--- | :--- | :--- | :--- |
| `main` | Production (`aurawatch.fun`) | **Clean & Live** | Only production-ready, verified code. No unapproved monetization banners. |
| `feature/vip` | Local Development | **Local Only** | Holds full VIP Ad-Free, UPI QR, and Gift code system. **DO NOT PUSH TO ORIGIN/MAIN**. |

---

## 📌 Master Feature Breakdown & Current Status

### 1. VIP Monetization & Ad-Free System
- **Branch**: `feature/vip`
- **Status**: ⏸️ **Paused / Saved Locally**
- **Architecture**:
  - UPI payment request submission + manual admin approval modal.
  - Gift code generation and instant redemption.
  - Anti-bypass server validation (no fake client-side flags).
  - `VipModal` with UPI QR and instructions.
- **To resume work**:
  ```bash
  git checkout feature/vip
  ```

### 2. Custom Playlists & Collections Hub
- **Branch**: `main`
- **Status**: ⏸️ **Paused / In Progress**
- **Key Files**:
  - `backend/routes/playlists.js`
  - `frontend/src/components/PlaylistModal.jsx`
  - `frontend/src/components/PlaylistModal.module.css`
- **Architecture**:
  - REST API for creating custom playlists, adding/removing items, setting public/private visibility, and generating shareable links.
  - Playlist selection modal UI with search and creation form.
- **Next to do when resumed**:
  - Wire playlist modal to media cards / detail pages.
  - Complete 2x2 collage view in My List.

### 3. Cinema Roulette / Arcade Reel
- **Branch**: `main`
- **Status**: ⏸️ **Polished / On Hold**
- **Key Files**:
  - `frontend/src/components/CinemaRouletteModal.jsx`
  - `backend/routes/roulette.js`
- **Architecture**:
  - Smooth conveyor strip animation with 36 movie thumbnails.
  - Suspenseful 5.0-second deceleration glide with realistic audio clicks.
  - Fake badges (4K Ultra HD & Certified Pick) removed.

---

## 📦 Dormant & Unreleased Features (Built but not taken Live)

### 4. Live TV / IPTV Channels
- **Status**: 📦 **Backend Ready / Never Exposed on Frontend**
- **Key File**: `backend/routes/livetv.js`
- **Details**: Full M3U parser for IPTV channels (JioTV, IPTV-org) with category grouping and logos. No frontend page was linked to keep focus on movies/series.

### 5. AI Smart Search (Groq AI)
- **Status**: 🛑 **Disabled & UI Removed**
- **Details**: Built with Groq SDK LLM for natural-language search, but removed to keep instant TMDB search snappy and avoid external API dependencies/costs.

### 6. Direct Torrent & Scraper Downloads
- **Status**: 📦 **Backend Engine Ready / Hidden on Detail Page**
- **Key Files**: `backend/routes/downloads.js`, `backend/utils/movieCrawler.js`
- **Details**: Multi-source crawlers (MoviesVerse, UHDMovies, 1337x, VidVault) with 24-hour database caching. Hidden from public detail pages to prevent link expiration issues and keep site clean.

---

## 🛠️ Quick Commands

```bash
# Check current active branch
git branch

# Switch to VIP monetization feature
git checkout feature/vip

# Switch back to production/clean site
git checkout main

# Start local frontend dev server
npm run dev --prefix frontend

# Start local backend dev server
npm run dev --prefix backend
```
