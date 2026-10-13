# AuraWatch - Development Roadmap & Feature Tracker

> **Permanent Tracker**: This file maintains state across sessions and development cycles.

---

## 🚦 Branch Strategy
| Branch | Target Environment | Status | Rules |
| :--- | :--- | :--- | :--- |
| `main` | Production (`aurawatch.fun`) | **Clean & Live** | Only production-ready, fully tested code. No unapproved paid/VIP popups. |
| `feature/vip` | Local Development | **Local Only** | Holds full VIP Ad-Free, UPI QR, and Gift code system. **DO NOT PUSH TO ORIGIN/MAIN**. |

---

## 📌 Feature Breakdown & Current Status

### 1. VIP Monetization & Ad-Free System
- **Branch**: `feature/vip`
- **Status**: ⏸️ **Paused / Ready on Local Branch**
- **What is Built**:
  - UPI payment request submission + manual admin panel approval.
  - Gift code generation and instant redemption.
  - Anti-bypass server validation (no fake client-side VIP flags).
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
- **What is Built**:
  - Full backend REST API for creating custom playlists, adding/removing items, setting public/private visibility, and generating shareable playlist links.
  - Modal UI component for playlist creation and selection.
- **Next to do**:
  - Wire playlist modal to media cards / detail pages.
  - Complete 2x2 collage view in My List.

### 3. Cinema Roulette / Arcade Reel
- **Branch**: `main`
- **Status**: ✅ **Active & Polished**
- **Key Files**:
  - `frontend/src/components/CinemaRouletteModal.jsx`
  - `backend/routes/roulette.js`
- **Recent Polish**:
  - Removed misleading fake badges (4K Ultra HD & Certified Pick).
  - Smooth reel spinning and responsive layout.

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
