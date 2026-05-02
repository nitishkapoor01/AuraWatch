const express = require('express');
const router = express.Router();
const MovieCrawler = require('../utils/movieCrawler');

// Dynamic import for p-limit to support ESM or CommonJS
let pLimit;
let downloadQueue;

(async () => {
    try {
        const pLimitModule = await import('p-limit');
        pLimit = pLimitModule.default || pLimitModule;
        // Optimization: Use concurrency 1 to prevent OOM on free tier
        downloadQueue = pLimit(1);
    } catch (err) {
        console.error('Failed to load p-limit:', err);
        // Fallback simple queue
        downloadQueue = async (fn) => fn();
    }
})();

// Prevent Playwright stealth plugin from crashing the whole server on timeouts
process.on('uncaughtException', (err) => {
    console.error('Caught exception:', err.message);
});
process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

router.post('/movie', async (req, res) => {
    const { title, year } = req.body;

    if (!title) {
        return res.status(400).json({
            error: 'Movie title is required',
            example: { title: 'The Batman', year: 2022 }
        });
    }

    // Optimization: reduced maxDepth and concurrency
    const crawler = new MovieCrawler({ maxDepth: 2, concurrency: 2, bypassShorteners: true });

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

        // Ensure we have a queue function ready
        const runner = downloadQueue || (async (fn) => fn());

        const results = await runner(() => Promise.race([
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
            // Raw links by type
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

module.exports = router;
