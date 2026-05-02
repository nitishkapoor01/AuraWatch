const express = require('express');
const cors = require('cors');
const path = require('path');
const MegaCrawler = require('./crawler');
const MovieCrawler = require('./movieCrawler');
const pLimit = require('p-limit');

// Concurrency queue to prevent the server from crashing under high load
const downloadQueue = pLimit(5);

// Prevent Playwright stealth plugin from crashing the whole server on timeouts
process.on('uncaughtException', (err) => {
    console.error('Caught exception:', err.message);
});
process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

const app = express();
const PORT = 3000;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Store active/completed crawl sessions
const sessions = new Map();
let sessionCounter = 0;

// ═══════════════════════════════════════════════════════════════════════════
//  GENERIC LINK CRAWLER API
// ═══════════════════════════════════════════════════════════════════════════

app.post('/api/crawl', async (req, res) => {
    const { url, maxDepth, concurrency, resolveShortLinks, waitForJS } = req.body;

    if (!url) {
        return res.status(400).json({ error: 'URL is required' });
    }

    const sessionId = ++sessionCounter;
    const opts = {};
    if (maxDepth !== undefined) opts.maxDepth = parseInt(maxDepth, 10);
    if (concurrency !== undefined) opts.concurrency = parseInt(concurrency, 10);
    if (resolveShortLinks !== undefined) opts.resolveShortLinks = resolveShortLinks;
    if (waitForJS !== undefined) opts.waitForJS = waitForJS;

    const crawler = new MegaCrawler(opts);

    sessions.set(sessionId, {
        id: sessionId,
        mode: 'generic',
        url,
        status: 'running',
        startedAt: new Date().toISOString(),
        crawler,
        results: null
    });

    res.json({ sessionId, status: 'started', url });

    try {
        const results = await crawler.crawl(url, opts);
        const session = sessions.get(sessionId);
        if (session) {
            session.status = 'completed';
            session.results = results;
            session.completedAt = new Date().toISOString();
        }
    } catch (err) {
        const session = sessions.get(sessionId);
        if (session) {
            session.status = 'failed';
            session.error = err.message;
        }
    }
});

// ═══════════════════════════════════════════════════════════════════════════
//  MOVIE TORRENT CRAWLER API
// ═══════════════════════════════════════════════════════════════════════════

// Crawl a specific movie/torrent site URL
app.post('/api/movie/crawl', async (req, res) => {
    const { url, maxDepth, concurrency } = req.body;

    if (!url) {
        return res.status(400).json({ error: 'URL is required' });
    }

    const sessionId = ++sessionCounter;
    const opts = {};
    if (maxDepth !== undefined) opts.maxDepth = parseInt(maxDepth, 10);
    if (concurrency !== undefined) opts.concurrency = parseInt(concurrency, 10);

    const crawler = new MovieCrawler(opts);

    sessions.set(sessionId, {
        id: sessionId,
        mode: 'movie',
        url,
        status: 'running',
        startedAt: new Date().toISOString(),
        crawler,
        results: null
    });

    res.json({ sessionId, status: 'started', mode: 'movie', url });

    try {
        const results = await crawler.crawl(url, opts);
        const session = sessions.get(sessionId);
        if (session) {
            session.status = 'completed';
            session.results = results;
            session.completedAt = new Date().toISOString();
        }
    } catch (err) {
        const session = sessions.get(sessionId);
        if (session) {
            session.status = 'failed';
            session.error = err.message;
        }
    }
});

// Search for a movie across multiple torrent sites
app.post('/api/movie/search', async (req, res) => {
    const { query, maxDepth, concurrency } = req.body;

    if (!query) {
        return res.status(400).json({ error: 'Search query is required' });
    }

    const sessionId = ++sessionCounter;
    const opts = {};
    if (maxDepth !== undefined) opts.maxDepth = parseInt(maxDepth, 10);
    if (concurrency !== undefined) opts.concurrency = parseInt(concurrency, 10);

    const crawler = new MovieCrawler(opts);

    sessions.set(sessionId, {
        id: sessionId,
        mode: 'movie-search',
        url: `search: ${query}`,
        status: 'running',
        startedAt: new Date().toISOString(),
        crawler,
        results: null
    });

    res.json({ sessionId, status: 'started', mode: 'movie-search', query });

    try {
        const results = await crawler.searchMovie(query, opts);
        const session = sessions.get(sessionId);
        if (session) {
            session.status = 'completed';
            session.results = results;
            session.completedAt = new Date().toISOString();
        }
    } catch (err) {
        const session = sessions.get(sessionId);
        if (session) {
            session.status = 'failed';
            session.error = err.message;
        }
    }
});

// Synchronous endpoint for external website integration
// Expects: { "query": "Batman", "quality": "1080p" (optional) }
app.post('/api/movie/getLink', async (req, res) => {
    const { query, quality } = req.body;

    if (!query) {
        return res.status(400).json({ error: 'Movie query is required. Example: { "query": "Batman", "quality": "1080p" }' });
    }

    // Default to aggressive crawling for direct API requests
    const opts = { maxDepth: 2, concurrency: 5, bypassShorteners: true };
    const crawler = new MovieCrawler(opts);

    try {
        // Run the deep crawler through the queue to prevent server crashing
        const results = await downloadQueue(() => crawler.searchMovie(query, opts));

        // If quality filter is specified, filter down
        const targetQuality = quality ? quality.toLowerCase() : null;

        // Helper to check quality match
        const matchQuality = (link) => {
            if (!targetQuality) return true;
            return link.quality && link.quality.toLowerCase() === targetQuality;
        };

        // Filter all downloads
        const allDirect = (results.downloads?.direct || []).filter(matchQuality);
        const allMagnets = (results.downloads?.magnets || []).filter(matchQuality);
        const allTorrents = (results.downloads?.torrents || []).filter(matchQuality);

        // Group by movie title if available
        const movies = (results.movies || []).map(movie => {
            const filteredDirect = movie.links.direct.filter(matchQuality);
            const filteredMagnet = movie.links.magnet.filter(matchQuality);
            const filteredTorrent = movie.links.torrent.filter(matchQuality);
            const totalLinks = filteredDirect.length + filteredMagnet.length + filteredTorrent.length;
            if (totalLinks === 0) return null;
            return {
                title: movie.title,
                source: movie.source,
                totalLinks,
                links: {
                    direct: filteredDirect,
                    magnet: filteredMagnet,
                    torrent: filteredTorrent
                },
                byQuality: targetQuality ? undefined : movie.byQuality
            };
        }).filter(Boolean);

        const totalFound = allDirect.length + allMagnets.length + allTorrents.length;

        // Pick the best link (prefer direct, then magnet, then torrent)
        const bestLink = allDirect.length > 0 ? allDirect[0].url
            : allMagnets.length > 0 ? allMagnets[0].url
            : allTorrents.length > 0 ? allTorrents[0].url
            : null;

        res.json({
            status: 'success',
            query,
            quality: quality || 'all',
            totalFound,
            moviesFound: movies.length,
            bestLink,
            movies,
            links: {
                direct: allDirect,
                magnet: allMagnets,
                torrent: allTorrents
            }
        });
    } catch (err) {
        res.status(500).json({ status: 'error', error: 'Crawling failed', details: err.message });
    }
});

// ═══════════════════════════════════════════════════════════════════════════
//  OTT FRONTEND — EXACT MOVIE DOWNLOAD LINKS
//  Use this from your OTT website's download button.
//  POST { "title": "The Batman", "year": 2022 }
//  Returns ONLY "The Batman (2022)" links grouped by quality.
// ═══════════════════════════════════════════════════════════════════════════

app.post('/api/movie/download', async (req, res) => {
    const { title, year } = req.body;

    if (!title) {
        return res.status(400).json({
            error: 'Movie title is required',
            example: { title: 'The Batman', year: 2022 }
        });
    }

    const crawler = new MovieCrawler({ maxDepth: 2, concurrency: 5, bypassShorteners: true });

    try {
        const timeoutPromise = new Promise((resolve) => {
            setTimeout(() => {
                try {
                    const fullResults = crawler._buildResults();
                    const exactMovie = crawler._findExactMatch(fullResults.movies, title, year || null);
                    resolve({
                        meta: {
                            ...fullResults.meta,
                            searchTitle: title,
                            searchYear: year || null,
                            exactMatchFound: !!exactMovie,
                            timedOut: true
                        },
                        movie: exactMovie
                    });
                } catch (e) {
                    resolve({ meta: {}, movie: null });
                }
            }, 28500); // 28.5 seconds absolute max
        });

        const results = await downloadQueue(() => Promise.race([
            crawler.searchExactMovie(title, year || null),
            timeoutPromise
        ]));

        if (!results.movie) {
            return res.json({
                status: 'not_found',
                title,
                year: year || null,
                message: `No download links found for "${title}"${year ? ` (${year})` : ''}`,
                meta: results.meta
            });
        }

        // Build clean quality-grouped response for OTT frontend
        const movie = results.movie;
        const qualityList = [];

        // Order qualities from highest to lowest
        const qualityOrder = ['4K', '1080p', '720p', '480p', '360p', 'BluRay', 'WEB-DL', 'HDRip', 'DVDRip', 'CAM', 'other'];
        for (const q of qualityOrder) {
            if (movie.qualities && movie.qualities[q] && movie.qualities[q].length > 0) {
                qualityList.push({
                    quality: q,
                    count: movie.qualities[q].length,
                    links: movie.qualities[q].map(l => ({
                        url: l.url,
                        name: l.name,
                        type: l.type,
                        size: l.size || null
                    }))
                });
            }
        }

        res.json({
            status: 'success',
            title: movie.title,
            year: year || null,
            totalLinks: movie.totalLinks,
            qualities: qualityList,
            // Raw links by type (if frontend needs it)
            raw: {
                direct: movie.links.direct,
                magnet: movie.links.magnet,
                torrent: movie.links.torrent
            },
            meta: results.meta
        });
    } catch (err) {
        res.status(500).json({ status: 'error', error: 'Search failed', details: err.message });
    }
});

// ═══════════════════════════════════════════════════════════════════════════
//  COMMON ENDPOINTS
// ═══════════════════════════════════════════════════════════════════════════

// Get session status (works for both modes)
app.get('/api/session/:id', (req, res) => {
    const session = sessions.get(parseInt(req.params.id, 10));
    if (!session) {
        return res.status(404).json({ error: 'Session not found' });
    }

    const { crawler, ...info } = session;

    if (crawler && session.mode === 'generic') {
        info.liveStats = {
            pagesCrawled: crawler.stats.pagesCrawled,
            linksFound: crawler.stats.linksFound,
            linksResolved: crawler.stats.linksResolved,
            errors: crawler.stats.errors,
            visited: crawler.visited.size,
            queueSize: crawler.queue.length
        };
        info.liveLinks = [...crawler.allLinks.values()].slice(-50);
    } else if (crawler && (session.mode === 'movie' || session.mode === 'movie-search')) {
        info.liveStats = {
            pagesCrawled: crawler.stats.pagesCrawled,
            magnetLinks: crawler.stats.magnetLinks,
            torrentLinks: crawler.stats.torrentLinks,
            directLinks: crawler.stats.directLinks,
            errors: crawler.stats.errors,
            visited: crawler.visited.size,
            queueSize: crawler.queue.length
        };
        info.liveLinks = crawler.allDownloadLinks.slice(-50);
    }

    res.json(info);
});

// Backward compat for the old endpoint
app.get('/api/crawl/:id', (req, res) => {
    const session = sessions.get(parseInt(req.params.id, 10));
    if (!session) return res.status(404).json({ error: 'Session not found' });
    const { crawler, ...info } = session;
    if (crawler) {
        info.liveStats = {
            pagesCrawled: crawler.stats?.pagesCrawled || 0,
            linksFound: crawler.stats?.linksFound || crawler.stats?.magnetLinks || 0,
            linksResolved: crawler.stats?.linksResolved || 0,
            errors: crawler.stats?.errors || 0,
            visited: crawler.visited?.size || 0,
            queueSize: crawler.queue?.length || 0,
            magnetLinks: crawler.stats?.magnetLinks || 0,
            torrentLinks: crawler.stats?.torrentLinks || 0,
            directLinks: crawler.stats?.directLinks || 0,
        };
        if (session.mode === 'generic') {
            info.liveLinks = [...(crawler.allLinks?.values() || [])].slice(-50);
        } else {
            info.liveLinks = (crawler.allDownloadLinks || []).slice(-50);
        }
    }
    res.json(info);
});

app.get('/api/sessions', (req, res) => {
    const list = [];
    for (const [id, session] of sessions) {
        const { crawler, results, ...info } = session;
        if (session.mode === 'generic') {
            info.totalLinks = crawler?.allLinks?.size || 0;
        } else {
            info.totalLinks = crawler?.allDownloadLinks?.length || 0;
        }
        list.push(info);
    }
    res.json(list);
});

// Serve frontend
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
    console.log(`\n  🕷️  Mega Scrapper Dashboard running at http://localhost:${PORT}\n`);
});
