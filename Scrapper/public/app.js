// ═══════════════════════════════════════════════════════════════════════════
// MEGA SCRAPPER — Frontend (Movie Mode + Generic Mode)
// ═══════════════════════════════════════════════════════════════════════════

const API_BASE = 'http://localhost:3000/api';

let currentSessionId = null;
let pollInterval = null;
let timerInterval = null;
let timerSeconds = 0;
let allLinks = [];
let allMovies = []; // grouped movie results
let currentTab = 'movies';
let currentMode = 'movie-crawl'; // 'movie-crawl' | 'movie-search' | 'generic'

// ─── Particles ────────────────────────────────────────────────────────────
(function initParticles() {
    const container = document.getElementById('particles');
    for (let i = 0; i < 30; i++) {
        const p = document.createElement('div');
        p.className = 'particle';
        p.style.left = Math.random() * 100 + '%';
        p.style.animationDelay = Math.random() * 8 + 's';
        p.style.animationDuration = (6 + Math.random() * 6) + 's';
        p.style.width = (1 + Math.random() * 2) + 'px';
        p.style.height = p.style.width;
        const colors = ['#6c5ce7', '#00cec9', '#a29bfe', '#fd79a8', '#fdcb6e'];
        p.style.background = colors[Math.floor(Math.random() * colors.length)];
        container.appendChild(p);
    }
})();

// ─── Mode Switching ───────────────────────────────────────────────────────
function switchMode(mode) {
    currentMode = mode;
    document.querySelectorAll('.mode-btn').forEach(b => b.classList.remove('active'));
    document.querySelector(`.mode-btn[data-mode="${mode}"]`).classList.add('active');

    document.getElementById('movieCrawlMode').style.display = mode === 'movie-crawl' ? 'block' : 'none';
    document.getElementById('movieSearchMode').style.display = mode === 'movie-search' ? 'block' : 'none';
    document.getElementById('genericMode').style.display = mode === 'generic' ? 'block' : 'none';
}

function toggleOptions() {
    const panel = document.getElementById('optionsPanel');
    const chevron = document.getElementById('chevron');
    panel.classList.toggle('open');
    chevron.classList.toggle('open');
}

// ─── Movie Crawl ──────────────────────────────────────────────────────────
async function startMovieCrawl() {
    let url = document.getElementById('urlInput').value.trim();
    if (!url) { showToast('⚠️ Paste a URL bhai!'); return; }
    if (!url.startsWith('http://') && !url.startsWith('https://')) url = 'https://' + url;

    const btn = document.getElementById('crawlBtn');
    btn.disabled = true;
    btn.innerHTML = '<span class="spinner"></span> <span class="btn-text">Crawling...</span>';

    try {
        const res = await fetch(`${API_BASE}/movie/crawl`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                url,
                maxDepth: parseInt(document.getElementById('optDepth').value, 10),
                concurrency: parseInt(document.getElementById('optConcurrency').value, 10),
            })
        });
        const data = await res.json();
        if (data.sessionId) {
            currentSessionId = data.sessionId;
            showResults();
            startPolling();
            startTimer();
            showToast('🎬 Movie crawl launched!');
        }
    } catch (err) {
        showToast('❌ Server se connect nahi ho paya');
        console.error(err);
    }

    btn.disabled = false;
    btn.innerHTML = '<span class="btn-icon">🚀</span> <span class="btn-text">Crawl Links</span>';
}

// ─── Movie Search ─────────────────────────────────────────────────────────
async function startMovieSearch() {
    const query = document.getElementById('searchInput').value.trim();
    if (!query) { showToast('⚠️ Movie ka naam dal bhai!'); return; }

    const btn = document.getElementById('searchBtn');
    btn.disabled = true;
    btn.innerHTML = '<span class="spinner"></span> <span class="btn-text">Searching...</span>';

    try {
        const res = await fetch(`${API_BASE}/movie/search`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                query,
                maxDepth: parseInt(document.getElementById('optDepth').value, 10),
                concurrency: parseInt(document.getElementById('optConcurrency').value, 10),
            })
        });
        const data = await res.json();
        if (data.sessionId) {
            currentSessionId = data.sessionId;
            showResults();
            startPolling();
            startTimer();
            showToast('🔍 Searching across torrent sites...');
        }
    } catch (err) {
        showToast('❌ Server se connect nahi ho paya');
        console.error(err);
    }

    btn.disabled = false;
    btn.innerHTML = '<span class="btn-icon">🔍</span> <span class="btn-text">Search All</span>';
}

// ─── Generic Crawl ────────────────────────────────────────────────────────
async function startGenericCrawl() {
    let url = document.getElementById('genericUrlInput').value.trim();
    if (!url) { showToast('⚠️ URL enter kar!'); return; }
    if (!url.startsWith('http://') && !url.startsWith('https://')) url = 'https://' + url;

    const btn = document.getElementById('genericBtn');
    btn.disabled = true;
    btn.innerHTML = '<span class="spinner"></span> <span class="btn-text">Launching...</span>';

    try {
        const res = await fetch(`${API_BASE}/crawl`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                url,
                maxDepth: parseInt(document.getElementById('optDepth').value, 10),
                concurrency: parseInt(document.getElementById('optConcurrency').value, 10),
                resolveShortLinks: true,
                waitForJS: true,
            })
        });
        const data = await res.json();
        if (data.sessionId) {
            currentSessionId = data.sessionId;
            showResults();
            startPolling();
            startTimer();
            showToast('🕷️ Generic crawl launched!');
        }
    } catch (err) {
        showToast('❌ Server se connect nahi ho paya');
        console.error(err);
    }

    btn.disabled = false;
    btn.innerHTML = '<span class="btn-icon">🚀</span> <span class="btn-text">Launch Crawl</span>';
}

// ─── Results ──────────────────────────────────────────────────────────────
function showResults() {
    document.getElementById('resultsSection').style.display = 'block';
    document.getElementById('exportBar').style.display = 'none';
    allLinks = [];
    allMovies = [];
    renderLinks();
}

function startPolling() {
    if (pollInterval) clearInterval(pollInterval);
    pollInterval = setInterval(async () => {
        if (!currentSessionId) return;
        try {
            const res = await fetch(`${API_BASE}/crawl/${currentSessionId}`);
            const data = await res.json();

            // Update stats
            if (data.liveStats) {
                document.getElementById('statPages').textContent = data.liveStats.pagesCrawled || 0;
                document.getElementById('statMagnets').textContent = data.liveStats.magnetLinks || 0;
                document.getElementById('statTorrents').textContent = data.liveStats.torrentLinks || 0;
                document.getElementById('statDirect').textContent = data.liveStats.directLinks || 0;
            }

            // Update links
            if (data.liveLinks) {
                allLinks = data.liveLinks;
                if (currentTab !== 'movies') renderLinks();
            }

            // Complete
            if (data.status === 'completed') {
                clearInterval(pollInterval);
                stopTimer();
                if (data.results) {
                    allLinks = data.results.downloads?.all || data.results.links?.all || [];
                    allMovies = data.results.movies || [];
                    document.getElementById('statPages').textContent = data.results.meta?.pagesCrawled || 0;
                    document.getElementById('statMagnets').textContent = data.results.meta?.magnetLinks || 0;
                    document.getElementById('statTorrents').textContent = data.results.meta?.torrentLinks || 0;
                    document.getElementById('statDirect').textContent = data.results.meta?.directLinks || 0;
                    renderLinks();
                }
                document.getElementById('statusText').textContent = '✅ Complete!';
                document.getElementById('statusText').style.color = '#00b894';
                document.getElementById('statusIndicator').innerHTML = '<div style="width:10px;height:10px;background:#00b894;border-radius:50%;"></div>';
                document.getElementById('exportBar').style.display = 'flex';
                showToast(`🏁 Done! ${allMovies.length} movies found, ${allLinks.length} links!`);
            } else if (data.status === 'failed') {
                clearInterval(pollInterval);
                stopTimer();
                document.getElementById('statusText').textContent = '❌ Failed';
                document.getElementById('statusText').style.color = '#ff7675';
                showToast('❌ Crawl fail hogya: ' + (data.error || 'Unknown'));
            }
        } catch (err) {
            console.error('Poll error:', err);
        }
    }, 2000);
}

function startTimer() {
    timerSeconds = 0;
    if (timerInterval) clearInterval(timerInterval);
    timerInterval = setInterval(() => {
        timerSeconds++;
        const m = Math.floor(timerSeconds / 60).toString().padStart(2, '0');
        const s = (timerSeconds % 60).toString().padStart(2, '0');
        document.getElementById('statusTimer').textContent = `${m}:${s}`;
    }, 1000);
}

function stopTimer() { if (timerInterval) clearInterval(timerInterval); }

// ─── Tabs ─────────────────────────────────────────────────────────────────
function switchTab(tab) {
    currentTab = tab;
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    document.querySelector(`.tab[data-tab="${tab}"]`).classList.add('active');
    renderLinks();
}

// ─── Render Links ─────────────────────────────────────────────────────────
function renderLinks() {
    const container = document.getElementById('linksList');

    // Movies tab — grouped view
    if (currentTab === 'movies') {
        renderMoviesGrouped(container);
        return;
    }

    let filtered = allLinks;
    if (currentTab === 'magnets') filtered = allLinks.filter(l => l.type === 'magnet');
    else if (currentTab === 'torrents') filtered = allLinks.filter(l => l.type === 'torrent');
    else if (currentTab === 'direct') filtered = allLinks.filter(l => l.type === 'direct');
    else if (currentTab === 'all') filtered = allLinks;

    if (filtered.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <div class="empty-icon">🎬</div>
                <p>${currentTab === 'feed' ? 'Links aa rahe hain...' : 'Is category mein koi link nahi mila'}</p>
            </div>`;
        return;
    }

    const display = currentTab === 'feed' ? filtered.slice(-150).reverse() : filtered.slice(0, 300);

    container.innerHTML = display.map(link => {
        const isMovie = link.type === 'magnet' || link.type === 'torrent' || link.type === 'direct';
        if (isMovie) {
            return renderMovieLink(link);
        } else {
            return renderGenericLink(link);
        }
    }).join('');
}

function renderMoviesGrouped(container) {
    if (allMovies.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <div class="empty-icon">🎬</div>
                <p>Crawl complete hone pe yahan movies grouped dikhenge...</p>
                <p style="font-size:0.7rem;margin-top:8px;color:var(--text-muted)">Abhi Live Feed tab check karo ↗</p>
            </div>`;
        return;
    }

    const qualityOrder = ['4K', '1080p', '720p', '480p', '360p', 'BluRay', 'WEB-DL', 'HDRip', 'DVDRip', 'CAM', 'other'];
    const qualityColors = {
        '4K': 'quality-4k', '1080p': 'quality-1080p', '720p': 'quality-720p',
        '480p': 'quality-480p', '360p': 'quality-other', 'BluRay': 'quality-1080p',
        'WEB-DL': 'quality-720p', 'HDRip': 'quality-720p', 'DVDRip': 'quality-480p',
        'CAM': 'quality-other', 'other': 'quality-other'
    };

    // Sort movies: most links first
    const sorted = [...allMovies].sort((a, b) => {
        const aTotal = (a.links?.direct?.length || 0) + (a.links?.magnet?.length || 0) + (a.links?.torrent?.length || 0);
        const bTotal = (b.links?.direct?.length || 0) + (b.links?.magnet?.length || 0) + (b.links?.torrent?.length || 0);
        return bTotal - aTotal;
    });

    container.innerHTML = sorted.map((movie, idx) => {
        const totalLinks = (movie.links?.direct?.length || 0) + (movie.links?.magnet?.length || 0) + (movie.links?.torrent?.length || 0);

        // Build quality pills
        let qualityHtml = '';
        for (const q of qualityOrder) {
            const links = movie.byQuality?.[q];
            if (links && links.length > 0) {
                const linksHtml = links.map(l =>
                    `<div class="mlink-item" title="${escapeHtml(l.url)}">
                        <span class="link-type-badge badge-${l.type}">${l.type === 'magnet' ? '🧲' : l.type === 'torrent' ? '📦' : '⬇️'}</span>
                        <span class="link-name">${escapeHtml((l.name || 'Download').substring(0, 70))}</span>
                        ${l.size ? `<span class="link-size">${l.size}</span>` : ''}
                        <button class="link-copy" onclick="event.stopPropagation(); copyLink('${escapeJs(l.url)}')" title="Copy">📋</button>
                        <a class="mlink-open" href="${escapeHtml(l.url)}" target="_blank" rel="noopener" onclick="event.stopPropagation()">🔗</a>
                    </div>`
                ).join('');

                qualityHtml += `
                    <div class="quality-group">
                        <div class="quality-header" onclick="this.parentElement.classList.toggle('expanded')">
                            <span class="quality-badge ${qualityColors[q] || 'quality-other'}">${q}</span>
                            <span class="quality-count">${links.length} link${links.length > 1 ? 's' : ''}</span>
                            <span class="quality-chevron">▶</span>
                        </div>
                        <div class="quality-links">
                            ${linksHtml}
                        </div>
                    </div>`;
            }
        }

        return `
            <div class="movie-card">
                <div class="movie-header" onclick="this.parentElement.classList.toggle('open')">
                    <div class="movie-info">
                        <span class="movie-index">#${idx + 1}</span>
                        <h3 class="movie-title">${escapeHtml(movie.title)}</h3>
                        <span class="movie-count">${totalLinks} links</span>
                    </div>
                    <span class="movie-chevron">▼</span>
                </div>
                <div class="movie-body">
                    ${qualityHtml || '<p style="padding:12px;color:var(--text-muted);font-size:0.8rem;">No quality-tagged links found</p>'}
                </div>
            </div>`;
    }).join('');
}

function renderMovieLink(link) {
    const typeIcon = link.type === 'magnet' ? '🧲' : link.type === 'torrent' ? '📦' : '⬇️';
    const badgeClass = `badge-${link.type}`;
    const qualityClass = getQualityClass(link.quality);
    const name = escapeHtml((link.name || 'Unknown').substring(0, 80));

    return `
        <div class="link-item" title="${escapeHtml(link.url)}">
            <span class="link-type-badge ${badgeClass}">${typeIcon} ${link.type}</span>
            ${link.quality ? `<span class="quality-badge ${qualityClass}">${link.quality}</span>` : ''}
            <span class="link-name">${name}</span>
            ${link.size ? `<span class="link-size">${link.size}</span>` : ''}
            <button class="link-copy" onclick="event.stopPropagation(); copyLink('${escapeJs(link.url)}')" title="Copy">📋</button>
        </div>`;
}

function renderGenericLink(link) {
    const badgeClass = `badge-${link.type || 'external'}`;
    const shortUrl = link.url.length > 80 ? link.url.substring(0, 77) + '...' : link.url;

    return `
        <div class="link-item" onclick="window.open('${escapeHtml(link.url)}', '_blank')">
            <span class="link-type-badge ${badgeClass}">${link.type || '?'}</span>
            <span class="link-url" title="${escapeHtml(link.url)}">${escapeHtml(shortUrl)}</span>
            ${link.text ? `<span class="link-text">${escapeHtml(link.text)}</span>` : ''}
            <button class="link-copy" onclick="event.stopPropagation(); copyLink('${escapeHtml(link.url)}')" title="Copy">📋</button>
        </div>`;
}

function getQualityClass(q) {
    if (!q) return 'quality-other';
    if (q === '4K') return 'quality-4k';
    if (q === '1080p') return 'quality-1080p';
    if (q === '720p') return 'quality-720p';
    if (q === '480p') return 'quality-480p';
    return 'quality-other';
}

// ─── Utilities ────────────────────────────────────────────────────────────
function escapeHtml(s) {
    if (!s) return '';
    return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function escapeJs(s) {
    if (!s) return '';
    return s.replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/"/g, '\\"');
}

function copyLink(url) {
    navigator.clipboard.writeText(url).then(() => showToast('📋 Link copied!'));
}

function copyMagnets() {
    const magnets = allLinks.filter(l => l.type === 'magnet').map(l => l.url);
    if (magnets.length === 0) { showToast('No magnets found'); return; }
    navigator.clipboard.writeText(magnets.join('\n')).then(() => showToast(`🧲 ${magnets.length} magnet links copied!`));
}

function copyAll() {
    const urls = allLinks.map(l => l.url).join('\n');
    navigator.clipboard.writeText(urls).then(() => showToast(`📋 ${allLinks.length} links copied!`));
}

function exportJSON() {
    const blob = new Blob([JSON.stringify({ links: allLinks }, null, 2)], { type: 'application/json' });
    downloadBlob(blob, 'movie-links.json');
    showToast('📄 JSON exported!');
}

function exportCSV() {
    const rows = ['Type,Quality,Name,URL,Size,Source'];
    allLinks.forEach(l => {
        const esc = s => `"${(s || '').replace(/"/g, '""')}"`;
        rows.push(`${esc(l.type)},${esc(l.quality)},${esc(l.name)},${esc(l.url)},${esc(l.size)},${esc(l.source)}`);
    });
    downloadBlob(new Blob([rows.join('\n')], { type: 'text/csv' }), 'movie-links.csv');
    showToast('📊 CSV exported!');
}

function downloadBlob(blob, name) {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = name;
    a.click();
    URL.revokeObjectURL(a.href);
}

function showToast(msg) {
    let toast = document.querySelector('.toast');
    if (!toast) { toast = document.createElement('div'); toast.className = 'toast'; document.body.appendChild(toast); }
    toast.textContent = msg;
    toast.classList.add('show');
    setTimeout(() => toast.classList.remove('show'), 2500);
}

// ─── Enter key ────────────────────────────────────────────────────────────
document.getElementById('urlInput').addEventListener('keydown', e => { if (e.key === 'Enter') startMovieCrawl(); });
document.getElementById('searchInput').addEventListener('keydown', e => { if (e.key === 'Enter') startMovieSearch(); });
document.getElementById('genericUrlInput').addEventListener('keydown', e => { if (e.key === 'Enter') startGenericCrawl(); });
