# AuraWatch Active Features & Branch Architecture

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

## 2. Feature Status Tracker

### Feature 1: VIP Ad-Free Monetization (Branch: `feature/vip`)
- **Status**: **ON-HOLD / LOCAL WORKSPACE ONLY**
- **Location**: Git branch `feature/vip`
- **Implemented Scope**:
  - Backend: `backend/routes/vip.js`, `backend/routes/admin.js`, schema migration for VIP orders/gift codes, UPI reference submission, tamper-proof rate-limited server verification.
  - Frontend: `VipModal.jsx`, `VipModal.module.css`, `useVip` state hook, admin approval UI, VIP badge.
- **Action for Future Chats**: If user wants to resume VIP, switch to `feature/vip` (`git checkout feature/vip`). Keep `main` clean.

### Feature 2: Custom Playlists & Collections Hub (Branch: `main`)
- **Status**: **PAUSED / IN PROGRESS**
- **Files**:
  - Backend: `backend/routes/playlists.js` (CRUD for custom playlists, privacy toggles, public shareable links).
  - Frontend: `frontend/src/components/PlaylistModal.jsx`, `frontend/src/components/PlaylistModal.module.css`.
  - Integration: Integration into `MyList.jsx` (2x2 poster collage, creating custom watchlists, adding media to custom lists).
- **Next Steps when Resuming**: Test playlist creation end-to-end, verify UI modal integration on media cards and movie/show detail pages.

### Feature 3: Cinema Roulette / Arcade Reel (Branch: `main`)
- **Status**: **ACTIVE & POLISHED**
- **Files**:
  - Frontend: `frontend/src/components/CinemaRouletteModal.jsx`, `frontend/src/components/CinemaRouletteModal.module.css`.
  - Backend: `backend/routes/roulette.js`.
  - Notes: Cleaned up fake badges (4K Ultra HD / Certified Pick removed). Continuous glide spin animation and genre filtering functional.

---

## 3. How to Switch Contexts
- Work on VIP System: `git checkout feature/vip`
- Work on Production / Playlists / Roulette / UI: `git checkout main`
- Always verify active branch before committing: `git branch --show-current`
