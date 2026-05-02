# Graph Report - .  (2026-05-02)

## Corpus Check
- 51 files · ~188,341 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 186 nodes · 260 edges · 40 communities detected
- Extraction: 78% EXTRACTED · 22% INFERRED · 0% AMBIGUOUS · INFERRED: 58 edges (avg confidence: 0.81)
- Token cost: 4,500 input · 1,400 output

## Community Hubs (Navigation)
- [[_COMMUNITY_Mega Crawler Logic|Mega Crawler Logic]]
- [[_COMMUNITY_Scrapper UI Utilities|Scrapper UI Utilities]]
- [[_COMMUNITY_Movie Crawler Logic|Movie Crawler Logic]]
- [[_COMMUNITY_Frontend Core & Auth|Frontend Core & Auth]]
- [[_COMMUNITY_API & Data Fetching|API & Data Fetching]]
- [[_COMMUNITY_UI Assets & Base|UI Assets & Base]]
- [[_COMMUNITY_App Features & Home|App Features & Home]]
- [[_COMMUNITY_CLI Scraper Entry|CLI Scraper Entry]]
- [[_COMMUNITY_Backend Core & DB|Backend Core & DB]]
- [[_COMMUNITY_Scrapper Subsystem|Scrapper Subsystem]]
- [[_COMMUNITY_Auth Middleware|Auth Middleware]]
- [[_COMMUNITY_Auth Utilities|Auth Utilities]]
- [[_COMMUNITY_Row Component|Row Component]]
- [[_COMMUNITY_Announcement Banner|Announcement Banner]]
- [[_COMMUNITY_Theme Management|Theme Management]]
- [[_COMMUNITY_Category Page|Category Page]]
- [[_COMMUNITY_Home Component|Home Component]]
- [[_COMMUNITY_Player Page|Player Page]]
- [[_COMMUNITY_Search Page|Search Page]]
- [[_COMMUNITY_Quality Matching|Quality Matching]]
- [[_COMMUNITY_Admin Auth Layer|Admin Auth Layer]]
- [[_COMMUNITY_Email & Profile|Email & Profile]]
- [[_COMMUNITY_DB Init|DB Init]]
- [[_COMMUNITY_Server Entry|Server Entry]]
- [[_COMMUNITY_Mock Data|Mock Data]]
- [[_COMMUNITY_Admin API|Admin API]]
- [[_COMMUNITY_Favorites API|Favorites API]]
- [[_COMMUNITY_Tracking API|Tracking API]]
- [[_COMMUNITY_Watch History API|Watch History API]]
- [[_COMMUNITY_Linter Config|Linter Config]]
- [[_COMMUNITY_Build Config|Build Config]]
- [[_COMMUNITY_Client Entry|Client Entry]]
- [[_COMMUNITY_Favorites Feature|Favorites Feature]]
- [[_COMMUNITY_Tracking Feature|Tracking Feature]]
- [[_COMMUNITY_History Feature|History Feature]]
- [[_COMMUNITY_Movie UI|Movie UI]]
- [[_COMMUNITY_Global Alert|Global Alert]]
- [[_COMMUNITY_User Preferences|User Preferences]]
- [[_COMMUNITY_Entry HTML|Entry HTML]]
- [[_COMMUNITY_Scraped Data Links|Scraped Data Links]]

## God Nodes (most connected - your core abstractions)
1. `MovieCrawler` - 22 edges
2. `MegaCrawler` - 15 edges
3. `Logger` - 13 edges
4. `useAuth()` - 10 edges
5. `showToast()` - 7 edges
6. `startMovieCrawl()` - 6 edges
7. `startMovieSearch()` - 6 edges
8. `startGenericCrawl()` - 6 edges
9. `showResults()` - 5 edges
10. `main()` - 4 edges

## Surprising Connections (you probably didn't know these)
- `App()` --calls--> `useAuth()`  [INFERRED]
  frontend\src\App.jsx → frontend\src\context\AuthContext.jsx
- `Sidebar()` --calls--> `useAuth()`  [INFERRED]
  frontend\src\components\layout\Sidebar.jsx → frontend\src\context\AuthContext.jsx
- `TopNav()` --calls--> `useAuth()`  [INFERRED]
  frontend\src\components\layout\TopNav.jsx → frontend\src\context\AuthContext.jsx
- `ProfileModal()` --calls--> `useAuth()`  [INFERRED]
  frontend\src\components\profile\ProfileModal.jsx → frontend\src\context\AuthContext.jsx
- `AdminDashboard()` --calls--> `useAuth()`  [INFERRED]
  frontend\src\pages\AdminDashboard.jsx → frontend\src\context\AuthContext.jsx

## Hyperedges (group relationships)
- **Backend API Structure** — auth_routes, movies_routes, admin_routes, favorites_routes, tracking_routes [EXTRACTED 0.90]
- **Frontend State Management** — auth_context, theme_context [EXTRACTED 0.95]
- **Scrapper Subsystem** — moviecrawler_scrapper, resolver_utils, logger_utils [EXTRACTED 0.90]

## Communities

### Community 0 - "Mega Crawler Logic"
Cohesion: 0.11
Nodes (3): MegaCrawler, Logger, LinkResolver

### Community 1 - "Scrapper UI Utilities"
Cohesion: 0.14
Nodes (20): copyMagnets(), downloadBlob(), escapeHtml(), escapeJs(), exportCSV(), exportJSON(), getQualityClass(), renderGenericLink() (+12 more)

### Community 2 - "Movie Crawler Logic"
Cohesion: 0.19
Nodes (1): MovieCrawler

### Community 3 - "Frontend Core & Auth"
Cohesion: 0.09
Nodes (11): AdminDashboard(), App(), useAuth(), Login(), isTVType(), MovieDetail(), MyList(), ProfileModal() (+3 more)

### Community 4 - "API & Data Fetching"
Cohesion: 0.24
Nodes (5): fetchWithCache(), fetchAndFormat(), fetchWithRetry(), getCacheKey(), revalidate()

### Community 5 - "UI Assets & Base"
Cohesion: 0.33
Nodes (6): App Component, AuraMovie Logo, Main Entry Point, Frontend README, Sidebar Component, Top Navigation

### Community 6 - "App Features & Home"
Cohesion: 0.33
Nodes (6): Admin Dashboard, Frontend API Utils, Authentication Context, Hero Banner Image, Home Page, Movie Detail Page

### Community 7 - "CLI Scraper Entry"
Cohesion: 0.7
Nodes (4): interactiveMode(), main(), parseArgs(), showHelp()

### Community 8 - "Backend Core & DB"
Cohesion: 0.4
Nodes (5): Auth Routes, Database Connection, Mock Movie Data, Movies Routes, Express Server

### Community 9 - "Scrapper Subsystem"
Cohesion: 0.5
Nodes (4): Scrapper Logger, Movie Crawler Scrapper, Link Resolver Utilities, Scrapper UI

### Community 10 - "Auth Middleware"
Cohesion: 0.67
Nodes (0): 

### Community 11 - "Auth Utilities"
Cohesion: 1.0
Nodes (0): 

### Community 12 - "Row Component"
Cohesion: 1.0
Nodes (0): 

### Community 13 - "Announcement Banner"
Cohesion: 1.0
Nodes (0): 

### Community 14 - "Theme Management"
Cohesion: 1.0
Nodes (0): 

### Community 15 - "Category Page"
Cohesion: 1.0
Nodes (0): 

### Community 16 - "Home Component"
Cohesion: 1.0
Nodes (0): 

### Community 17 - "Player Page"
Cohesion: 1.0
Nodes (0): 

### Community 18 - "Search Page"
Cohesion: 1.0
Nodes (0): 

### Community 19 - "Quality Matching"
Cohesion: 1.0
Nodes (0): 

### Community 20 - "Admin Auth Layer"
Cohesion: 1.0
Nodes (2): Admin Routes, Auth Middleware

### Community 21 - "Email & Profile"
Cohesion: 1.0
Nodes (2): Email Utilities, Profile Modal

### Community 22 - "DB Init"
Cohesion: 1.0
Nodes (0): 

### Community 23 - "Server Entry"
Cohesion: 1.0
Nodes (0): 

### Community 24 - "Mock Data"
Cohesion: 1.0
Nodes (0): 

### Community 25 - "Admin API"
Cohesion: 1.0
Nodes (0): 

### Community 26 - "Favorites API"
Cohesion: 1.0
Nodes (0): 

### Community 27 - "Tracking API"
Cohesion: 1.0
Nodes (0): 

### Community 28 - "Watch History API"
Cohesion: 1.0
Nodes (0): 

### Community 29 - "Linter Config"
Cohesion: 1.0
Nodes (0): 

### Community 30 - "Build Config"
Cohesion: 1.0
Nodes (0): 

### Community 31 - "Client Entry"
Cohesion: 1.0
Nodes (0): 

### Community 32 - "Favorites Feature"
Cohesion: 1.0
Nodes (1): Favorites Routes

### Community 33 - "Tracking Feature"
Cohesion: 1.0
Nodes (1): Tracking Routes

### Community 34 - "History Feature"
Cohesion: 1.0
Nodes (1): Watch History Routes

### Community 35 - "Movie UI"
Cohesion: 1.0
Nodes (1): Movie Row Component

### Community 36 - "Global Alert"
Cohesion: 1.0
Nodes (1): Announcement Banner

### Community 37 - "User Preferences"
Cohesion: 1.0
Nodes (1): Theme Context

### Community 38 - "Entry HTML"
Cohesion: 1.0
Nodes (1): Index HTML

### Community 39 - "Scraped Data Links"
Cohesion: 1.0
Nodes (1): Extracted Movie Links

## Knowledge Gaps
- **25 isolated node(s):** `Database Connection`, `Mock Movie Data`, `Auth Middleware`, `Admin Routes`, `Auth Routes` (+20 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **Thin community `Auth Utilities`** (2 nodes): `normalizeAnswer()`, `auth.js`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Row Component`** (2 nodes): `Row.jsx`, `Row()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Announcement Banner`** (2 nodes): `AnnouncementBanner()`, `AnnouncementBanner.jsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Theme Management`** (2 nodes): `ThemeContext.jsx`, `ThemeProvider()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Category Page`** (2 nodes): `Category()`, `Category.jsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Home Component`** (2 nodes): `Home.jsx`, `Home()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Player Page`** (2 nodes): `Player.jsx`, `Player()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Search Page`** (2 nodes): `Search.jsx`, `Search()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Quality Matching`** (2 nodes): `server.js`, `matchQuality()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Admin Auth Layer`** (2 nodes): `Admin Routes`, `Auth Middleware`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Email & Profile`** (2 nodes): `Email Utilities`, `Profile Modal`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `DB Init`** (1 nodes): `db.js`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Server Entry`** (1 nodes): `server.js`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Mock Data`** (1 nodes): `mockMovies.js`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Admin API`** (1 nodes): `admin.js`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Favorites API`** (1 nodes): `favorites.js`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Tracking API`** (1 nodes): `tracking.js`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Watch History API`** (1 nodes): `watchHistory.js`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Linter Config`** (1 nodes): `eslint.config.js`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Build Config`** (1 nodes): `vite.config.js`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Client Entry`** (1 nodes): `main.jsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Favorites Feature`** (1 nodes): `Favorites Routes`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Tracking Feature`** (1 nodes): `Tracking Routes`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `History Feature`** (1 nodes): `Watch History Routes`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Movie UI`** (1 nodes): `Movie Row Component`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Global Alert`** (1 nodes): `Announcement Banner`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `User Preferences`** (1 nodes): `Theme Context`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Entry HTML`** (1 nodes): `Index HTML`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Scraped Data Links`** (1 nodes): `Extracted Movie Links`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Are the 9 inferred relationships involving `useAuth()` (e.g. with `App()` and `Sidebar()`) actually correct?**
  _`useAuth()` has 9 INFERRED edges - model-reasoned connections that need verification._
- **What connects `Database Connection`, `Mock Movie Data`, `Auth Middleware` to the rest of the system?**
  _25 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Mega Crawler Logic` be split into smaller, more focused modules?**
  _Cohesion score 0.11 - nodes in this community are weakly interconnected._
- **Should `Scrapper UI Utilities` be split into smaller, more focused modules?**
  _Cohesion score 0.14 - nodes in this community are weakly interconnected._
- **Should `Frontend Core & Auth` be split into smaller, more focused modules?**
  _Cohesion score 0.09 - nodes in this community are weakly interconnected._