const express = require('express');
const router = express.Router();
const db = require('../db');
const MovieCrawler = require('../utils/movieCrawler');

// Lightweight scraper - no p-limit or Playwright needed

// ═══════════════════════════════════════════════════════════════════════════
//  CACHE SETTINGS
// ═══════════════════════════════════════════════════════════════════════════
const CACHE_TTL_HOURS = 24; // Cache expires after 24 hours

/**
 * Generate a consistent cache key from title + year.
 * e.g. "the batman|2022" or "inception|"
 */
function buildCacheKey(title, year) {
    const normalizedTitle = title.toLowerCase().trim().replace(/[^a-z0-9\s]/g, '').replace(/\s+/g, ' ');
    return `${normalizedTitle}|${year || ''}`;
}

/**
 * Check the database cache for a movie's download links.
 * Returns null if not found or expired.
 */
async function getCachedResult(cacheKey) {
    try {
        const res = await db.query(
            `SELECT result, created_at FROM download_cache 
             WHERE cache_key = $1 
             AND created_at > NOW() - INTERVAL '${CACHE_TTL_HOURS} hours'`,
            [cacheKey]
        );
        if (res.rows.length > 0) {
            return res.rows[0].result;
        }
    } catch (err) {
        console.error('[CACHE] Read error:', err.message);
    }
    return null;
}

/**
 * Save scraper results to cache.
 * Uses UPSERT so re-scraping the same movie updates the cache.
 */
async function saveToCacheDB(title, year, cacheKey, responseData) {
    try {
        await db.query(
            `INSERT INTO download_cache (title, year, cache_key, result, total_links, created_at)
             VALUES ($1, $2, $3, $4, $5, NOW())
             ON CONFLICT (cache_key) 
             DO UPDATE SET result = $4, total_links = $5, created_at = NOW()`,
            [title, year || null, cacheKey, JSON.stringify(responseData), responseData.totalLinks || 0]
        );
        console.log(`[CACHE] Saved: "${title}" (${responseData.totalLinks || 0} links)`);
    } catch (err) {
        console.error('[CACHE] Write error:', err.message);
    }
}

// ═══════════════════════════════════════════════════════════════════════════
//  MAIN DOWNLOAD ROUTE — with Cache-First Strategy
// ═══════════════════════════════════════════════════════════════════════════

router.post('/movie', async (req, res) => {
    const { title, year, season, episode, type, forceRefresh, visitorId, tmdbId } = req.body;

    if (!title) {
        return res.status(400).json({
            error: 'Title is required'
        });
    }

    // ── STEP 1: Check Cache ──────────────────────────────────────────────
    // For TV shows, cache specifically for the season/episode
    const cacheKey = type === 'tv' ? `tv:${title}:${season}:${episode}` : buildCacheKey(title, year);
    
    if (!forceRefresh) {
        const cached = await getCachedResult(cacheKey);

        if (cached) {
            console.log(`[CACHE] HIT for "${title}" — returning instantly!`);
            return res.json({
                ...cached,
                cached: true,
                cacheMessage: 'Served from cache (instant). Links refresh every 24h.'
            });
        }
    } else {
        console.log(`[CACHE] FORCE REFRESH requested for "${title}" — bypassing cache.`);
    }

    console.log(`[CACHE] MISS for "${title}" — starting scraper...`);

    // ── STEP 2: Run Scraper ──────────────────────────────────────────────
    const crawler = new MovieCrawler({ bypassShorteners: true });

    try {
        const results = await crawler.searchExactMovie(title, year || null, { 
            type, 
            season, 
            episode,
            tmdbId 
        });

        if (!results.movie) {
            return res.json({
                status: 'not_found',
                title,
                year: year || null,
                message: `No download links found for "${title}"${year ? ` (${year})` : ''}`,
                cached: false,
                meta: results.meta
            });
        }

        // Build clean quality-grouped response
        const movie = results.movie;
        const qualityList = [];

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
                        size: l.size || null,
                        category: l.category || 'episode'
                    }))
                });
            }
        }

        const responseData = {
            status: 'success',
            title: movie.title,
            year: year || null,
            totalLinks: movie.totalLinks,
            qualities: qualityList,
            raw: {
                direct: movie.links.direct,
                magnet: movie.links.magnet,
                torrent: movie.links.torrent
            },
            meta: results.meta
        };

        // ── STEP 3: Save to Cache ────────────────────────────────────────
        await saveToCacheDB(title, year, cacheKey, responseData);

        // ── STEP 4: Log Search ──────────────────────────────────────────
        try {
            await db.query(
                "INSERT INTO search_logs (query, has_results, visitor_id) VALUES ($1, $2, $3)",
                [title.trim().toLowerCase(), true, visitorId || null]
            );
        } catch (logError) {
            console.error('Failed to log search query in downloads:', logError);
        }

        res.json({ ...responseData, cached: false });

    } catch (err) {
        res.status(500).json({ status: 'error', error: 'Search failed', details: err.message });
    }
});

// ═══════════════════════════════════════════════════════════════════════════
//  ADMIN: View/Clear Cache (optional utility)
// ═══════════════════════════════════════════════════════════════════════════

router.get('/cache/stats', async (req, res) => {
    try {
        const total = await db.query('SELECT COUNT(*) as count FROM download_cache');
        const recent = await db.query(
            `SELECT title, year, total_links, created_at FROM download_cache 
             ORDER BY created_at DESC LIMIT 20`
        );
        res.json({
            totalCached: parseInt(total.rows[0].count),
            recentSearches: recent.rows
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.delete('/cache/clear', async (req, res) => {
    try {
        await db.query('DELETE FROM download_cache');
        res.json({ status: 'ok', message: 'Cache cleared' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
