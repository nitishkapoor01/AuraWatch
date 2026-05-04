const { chromium } = require('playwright-extra');
const stealth = require('puppeteer-extra-plugin-stealth')();
chromium.use(stealth);

// Prevent Playwright stealth plugin from crashing the process on timeouts
process.on('uncaughtException', (err) => {
    // Ignore cdpSession errors from stealth plugin
});
process.on('unhandledRejection', (reason, promise) => {
    // Ignore cdpSession errors from stealth plugin
});

const cheerio = require('cheerio');
const { URL } = require('url');
const { Logger } = require('./utils/logger');
const config = require('./config.json');
const fs = require('fs').promises;

class MovieCrawler {
    constructor(options = {}) {
        this.config = { ...config, ...options };
        this.visited = new Set();
        this.movies = new Map();      // movieId -> { title, year, quality, links[] }
        this.allDownloadLinks = [];   // All magnet/torrent/direct links
        this.queue = [];
        this.browser = null;
        this.context = null;
        this.logger = new Logger();
        this.stats = {
            pagesCrawled: 0,
            moviesFound: 0,
            magnetLinks: 0,
            torrentLinks: 0,
            directLinks: 0,
            errors: 0,
            startTime: Date.now()
        };
    }

    /**
     * Find system Chrome/Edge as fallback.
     */
    _findSystemChrome() {
        const fsSync = require('fs');
        const paths = [
            'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
            'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
            process.env.LOCALAPPDATA + '\\Google\\Chrome\\Application\\chrome.exe',
            'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
            'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
            '/usr/bin/google-chrome',
            '/usr/bin/chromium-browser',
        ];
        for (const p of paths) {
            try { if (fsSync.existsSync(p)) return p; } catch { }
        }
        return null;
    }

    /**
     * Launch browser with fallback.
     */
    async _launchBrowser() {
        const launchOpts = {
            headless: true,
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-dev-shm-usage',
                '--disable-gpu',
                '--window-size=1920,1080',
            ]
        };

        try {
            this.browser = await chromium.launch(launchOpts);
            this.logger.success('Playwright Chromium ready');
        } catch (e) {
            this.logger.warn('Playwright browser not found, trying system Chrome...');
            const systemChrome = this._findSystemChrome();
            if (systemChrome) {
                launchOpts.executablePath = systemChrome;
                this.browser = await chromium.launch(launchOpts);
                this.logger.success(`System browser: ${systemChrome}`);
            } else {
                throw new Error('No browser found! Install Chrome or run: npx playwright install chromium');
            }
        }

        this.context = await this.browser.newContext({
            userAgent: this.config.userAgent,
            viewport: { width: 1920, height: 1080 },
            extraHTTPHeaders: this.config.headers,
            ignoreHTTPSErrors: true
        });
    }

    /**
     * Main crawl entry - crawl a torrent/movie site.
     */
    async crawl(startUrl, opts = {}) {
        const mergedConfig = { ...this.config, ...opts };
        this.logger.banner();
        this.logger.info(`🎬 MOVIE TORRENT CRAWLER MODE`);
        this.logger.info(`Target: ${startUrl}`);
        this.logger.info(`Depth: ${mergedConfig.maxDepth} | Concurrency: ${mergedConfig.concurrency}`);

        try {
            await this._launchBrowser();

            // Crawl the starting page
            await this._processPage(startUrl, 0, mergedConfig);

            // Drain the queue
            await this._drainQueue(mergedConfig);

        } catch (err) {
            this.logger.error(`Fatal: ${err.message}`);
            this.stats.errors++;
        } finally {
            if (this.browser) await this.browser.close();
        }

        // Build & save results
        const elapsed = ((Date.now() - this.stats.startTime) / 1000).toFixed(1);
        this.stats.timeTaken = `${elapsed}s`;
        this._printStats();

        const results = this._buildResults();
        await this._saveResults(results);

        this.logger.done();
        return results;
    }

    /**
     * Search for a movie across known torrent sites.
     */
    async searchMovie(query, opts = {}) {
        const mergedConfig = { ...this.config, ...opts, maxDepth: 2, query: query.toLowerCase(), timeout: 15000 };
        this.logger.banner();
        this.logger.info(`🔍 Searching: "${query}"`);

        const searchUrls = this._buildSearchUrls(query);
        this.logger.info(`Searching across ${searchUrls.length} sources...`);

        try {
            await this._launchBrowser();

            const { default: pLimit } = await import('p-limit');
            const limit = pLimit(20); // High concurrency for fast initial sweep

            const searchPromises = searchUrls.map(searchUrl => limit(async () => {
                this.logger.info(`Trying: ${searchUrl.name}`);
                try {
                    await this._processPage(searchUrl.url, 0, mergedConfig);
                } catch (e) {
                    this.logger.warn(`${searchUrl.name} failed: ${e.message}`);
                }
            }));

            // Run all initial search pages with concurrency limit
            await Promise.allSettled(searchPromises);

            // Process found movie pages from the queue with high concurrency
            await this._drainQueue({ ...mergedConfig, concurrency: 8 });

        } catch (err) {
            this.logger.error(`Fatal: ${err.message}`);
            this.stats.errors++;
        } finally {
            if (this.browser) await this.browser.close();
        }

        const elapsed = ((Date.now() - this.stats.startTime) / 1000).toFixed(1);
        this.stats.timeTaken = `${elapsed}s`;
        this._printStats();

        const results = this._buildResults();
        await this._saveResults(results);

        this.logger.done();
        return results;
    }

    /**
     * Search for an EXACT movie and return only its download links.
     * Designed for OTT frontend — click download on "The Batman (2022)"
     * and get ONLY "The Batman 2022" links, not Batman Begins, Batman Forever, etc.
     *
     * @param {string} title - Exact movie title e.g. "The Batman"
     * @param {number|string} year - Release year e.g. 2022 (optional but recommended)
     * @returns {object} { meta, movie: { title, qualities, links } }
     */
    async searchExactMovie(title, year = null, opts = {}) {
        const searchQuery = year ? `${title} ${year}` : title;
        const mergedConfig = { ...this.config, ...opts, maxDepth: 2, query: searchQuery.toLowerCase(), timeout: 15000 };
        this.logger.banner();
        this.logger.info(`🎯 EXACT SEARCH: "${title}" ${year ? `(${year})` : ''}`);

        const searchUrls = this._buildSearchUrls(searchQuery);
        this.logger.info(`Searching across ${searchUrls.length} sources...`);
        this.isStopped = false;

        // Force stop after 28 seconds to ensure frontend 30s timer is respected
        const hardTimeout = setTimeout(() => {
            this.logger.warn(`⏳ Hard 28s timeout reached! Forcing early stop to return partial results...`);
            this.isStopped = true;
            this.queue = []; // Clear queue to stop drainQueue
        }, 28000);

        try {
            await this._launchBrowser();

            const { default: pLimit } = await import('p-limit');
            const limit = pLimit(20);

            const searchPromises = searchUrls.map(searchUrl => limit(async () => {
                if (this.isStopped) return;
                this.logger.info(`Trying: ${searchUrl.name}`);
                try {
                    await this._processPage(searchUrl.url, 0, mergedConfig);
                } catch (e) {
                    this.logger.warn(`${searchUrl.name} failed: ${e.message}`);
                }
            }));

            await Promise.allSettled(searchPromises);
            await this._drainQueue({ ...mergedConfig, concurrency: 8 });

        } catch (err) {
            this.logger.error(`Fatal: ${err.message}`);
            this.stats.errors++;
        } finally {
            clearTimeout(hardTimeout);
            if (this.browser) await this.browser.close();
        }

        const elapsed = ((Date.now() - this.stats.startTime) / 1000).toFixed(1);
        this.stats.timeTaken = `${elapsed}s`;
        this._printStats();

        const fullResults = this._buildResults();
        const exactMovie = this._findExactMatch(fullResults.movies, title, year);

        this.logger.info(`🎯 Exact match: ${exactMovie ? exactMovie.title : 'NOT FOUND'}`);
        this.logger.done();

        return {
            meta: {
                ...fullResults.meta,
                searchTitle: title,
                searchYear: year,
                exactMatchFound: !!exactMovie
            },
            movie: exactMovie
        };
    }

    /**
     * Find the movie from the results list that best matches the given title + year.
     * Uses a scoring system to pick the closest match.
     */
    _findExactMatch(movies, searchTitle, searchYear) {
        if (!movies || movies.length === 0) return null;

        const normalize = (str) => str.toLowerCase()
            .replace(/[^a-z0-9\s]/g, '')
            .replace(/\s+/g, ' ')
            .trim();

        const searchNorm = normalize(searchTitle);
        // Include words of length >= 2 (was > 2, missing short words like "on")
        const searchWords = searchNorm.split(' ').filter(w => w.length >= 2);
        const yearStr = searchYear ? String(searchYear) : null;

        const scored = movies.map(movie => {
            const titleNorm = normalize(movie.title);
            const sourceNorm = normalize(movie.source || '');
            let score = 0;

            // Exact title match
            if (titleNorm === searchNorm) score += 100;
            if (yearStr && titleNorm === `${searchNorm} ${yearStr}`) score += 100;

            // Word overlap score — count how many search words appear in the title
            const matchedWords = searchWords.filter(w => titleNorm.includes(w));
            score += (matchedWords.length / searchWords.length) * 60;

            // Year match bonus
            if (yearStr) {
                if (titleNorm.includes(yearStr)) score += 35;
                else if (sourceNorm.includes(yearStr)) score += 25;
            }

            // Year MISMATCH penalty — only penalize if another year is clearly present
            if (yearStr) {
                const yearsInTitle = titleNorm.match(/\b(19|20)\d{2}\b/g) || [];
                const yearsInSource = sourceNorm.match(/\b(19|20)\d{2}\b/g) || [];
                const allYears = [...new Set([...yearsInTitle, ...yearsInSource])];
                if (allYears.length > 0 && !allYears.includes(yearStr)) {
                    score -= 60; // Wrong year = wrong movie (reduced from 80 to 60)
                }
            }

            // Penalize meaningful extra words in title not in search
            // e.g. "Batman Begins" should NOT match just "Batman"
            const titleWords = titleNorm.split(' ').filter(w => w.length > 2);
            const fillerWords = ['the', 'and', 'full', 'movie', 'search', 'download', 'free', 'season'];
            const meaningfulExtra = titleWords.filter(w =>
                !searchWords.includes(w) && !fillerWords.includes(w) && !/^\d{4}$/.test(w)
            );
            score -= meaningfulExtra.length * 10; // Reduced penalty from 15 to 10

            // Bonus for having more links
            const totalLinks = (movie.links?.direct?.length || 0) +
                (movie.links?.magnet?.length || 0) + (movie.links?.torrent?.length || 0);
            score += Math.min(totalLinks, 10);

            return { movie, score };
        });

        scored.sort((a, b) => b.score - a.score);

        const best = scored[0];
        // Return if score is reasonable (lowered from 20 to 15 for better recall)
        if (best && best.score > 15) {
            const movie = best.movie;
            return {
                title: movie.title,
                source: movie.source,
                totalLinks: (movie.links?.direct?.length || 0) +
                    (movie.links?.magnet?.length || 0) + (movie.links?.torrent?.length || 0),
                qualities: movie.byQuality,
                links: movie.links
            };
        }

        // ─── FALLBACK: If no good match, return the result with the highest word overlap
        // This ensures SOMETHING is returned even when the year is uncertain
        const bestAnyway = scored.find(s => s.score > 0);
        if (bestAnyway) {
            const movie = bestAnyway.movie;
            this.logger.warn(`⚠️ Returning best partial match: "${movie.title}" (score: ${bestAnyway.score})`);
            return {
                title: movie.title,
                source: movie.source,
                totalLinks: (movie.links?.direct?.length || 0) +
                    (movie.links?.magnet?.length || 0) + (movie.links?.torrent?.length || 0),
                qualities: movie.byQuality,
                links: movie.links
            };
        }

        return null;
    }

    /**
     * Build search URLs for known torrent sites.
     */
    _buildSearchUrls(query) {
        const encoded = encodeURIComponent(query);
        const dashed = query.replace(/\s+/g, '-').toLowerCase();
        const plused = query.replace(/\s+/g, '+').toLowerCase();
        const dotted = query.replace(/\s+/g, '.').toLowerCase();

        return [
            // ── FASTEST & MOST RELIABLE SOURCES ONLY ──────────────────
            // Trimmed down to prevent 30s timeout on the frontend
            { name: '1337x', url: `https://1337x.to/search/${encoded}/1/` },
            { name: 'YTS', url: `https://yts.mx/browse-movies/${encoded}` },
            
            // ── INDIAN / HINDI SITES ─────────────────────────
            { name: 'HDHub4u', url: `https://new7.hdhub4u.fo/?s=${plused}` },
            { name: 'HDHub4u.tv', url: `https://hdhub4u.tv/?s=${plused}` },
            { name: 'VegaMovies', url: `https://vegamovies.nf/?s=${plused}` },
            { name: 'OlaMovies', url: `https://olamovies.app/?s=${plused}` },
            { name: 'Movies4u', url: `https://movies4u.ba/?s=${plused}` },
            { name: 'Movie4in', url: `https://movie4in.com/?s=${plused}` },
            { name: 'KatMovieHD', url: `https://new1.katmoviehd.cymru/?s=${plused}` },
            { name: 'WatchAnimeWorld', url: `https://watchanimeworld.net/?s=${plused}` },
            { name: 'UHDMovies', url: `https://uhdmovies.pink/?s=${plused}` }
        ];
    }

    /**
     * Process a single page - extract movie info and download links.
     */
    async _processPage(url, depth, config) {
        if (this.isStopped || this.visited.has(url)) return;
        if (depth > config.maxDepth) return;

        this.visited.add(url);
        this.logger.crawling(url, depth);

        let page;
        try {
            page = await this.context.newPage();

            // Block heavy resources
            await page.route('**/*', (route) => {
                const type = route.request().resourceType();
                if (['image', 'stylesheet', 'font', 'media'].includes(type)) {
                    route.abort();
                } else {
                    route.continue();
                }
            });

            await page.goto(url, {
                waitUntil: 'domcontentloaded',
                timeout: config.timeout || 15000
            });

            // Quick Cloudflare check (5s max instead of 10s)
            try {
                await page.waitForFunction(() => {
                    const text = document.body?.innerText?.toLowerCase() || '';
                    return !text.includes('checking your browser') &&
                        !text.includes('just a moment') &&
                        !text.includes('cloudflare');
                }, { timeout: 5000 });
            } catch (e) {
                // Cloudflare didn't clear in 5s, proceed anyway
            }

            // Minimal wait for dynamic content (1s is enough for most sites)
            await page.waitForTimeout(1000);

            // Quick scroll to trigger lazy loading
            await this._autoScroll(page);

            // Get rendered HTML
            const html = await page.content();
            const pageUrl = page.url(); // might have redirected

            // Extract everything
            const extracted = this._extractMovieData(html, pageUrl, config.query);

            this.stats.pagesCrawled++;

            // Process magnet links
            for (const magnet of extracted.magnetLinks) {
                this.allDownloadLinks.push({
                    type: 'magnet',
                    url: magnet.url,
                    name: magnet.name || this._extractNameFromMagnet(magnet.url),
                    source: pageUrl,
                    quality: magnet.quality || this._detectQuality(magnet.name) || this._detectQuality(magnet.url),
                    size: magnet.size || '',
                    seeders: magnet.seeders || '',
                    leechers: magnet.leechers || '',
                });
                this.stats.magnetLinks++;
                this.logger.info(`🧲 MAGNET: ${(magnet.name || this._extractNameFromMagnet(magnet.url)).substring(0, 70)}`);
            }

            // Process torrent file links
            for (const torrent of extracted.torrentLinks) {
                this.allDownloadLinks.push({
                    type: 'torrent',
                    url: torrent.url,
                    name: torrent.name || '',
                    source: pageUrl,
                    quality: torrent.quality || this._detectQuality(torrent.name) || this._detectQuality(torrent.url),
                    size: torrent.size || '',
                });
                this.stats.torrentLinks++;
                this.logger.info(`📦 TORRENT: ${(torrent.name || torrent.url).substring(0, 70)}`);
            }

            // Process direct download links
            for (const direct of extracted.directLinks) {
                let finalUrl = direct.url;
                if (config.bypassShorteners !== false) {
                    finalUrl = await this._resolveShortlinkWithBrowser(direct.url);
                }

                this.allDownloadLinks.push({
                    type: 'direct',
                    url: finalUrl,
                    name: direct.name || '',
                    source: pageUrl,
                    quality: direct.quality || this._detectQuality(direct.name) || this._detectQuality(direct.url),
                    size: direct.size || '',
                });
                this.stats.directLinks++;
                this.logger.info(`⬇️  DIRECT: ${(direct.name || direct.url).substring(0, 70)}`);
            }

            // Queue internal movie/detail pages for deeper crawl
            if (depth < config.maxDepth) {
                for (const link of extracted.moviePageLinks) {
                    if (!this.visited.has(link.url)) {
                        this.queue.push({ url: link.url, depth: depth + 1 });
                    }
                }
            }

        } catch (err) {
            this.logger.error(`Page failed ${url}: ${err.message}`);
            this.stats.errors++;
        } finally {
            if (page) await page.close();
        }
    }

    /**
     * Extract all movie-related data from the HTML.
     */
    _extractMovieData(html, baseUrl, query = null) {
        const $ = cheerio.load(html);
        const result = {
            magnetLinks: [],
            torrentLinks: [],
            directLinks: [],
            moviePageLinks: [],
        };

        const seen = new Set();

        // ─── 1. MAGNET LINKS ────────────────────────────────────────────
        // From <a href="magnet:...">
        $('a[href^="magnet:"]').each((_, el) => {
            const href = $(el).attr('href');
            if (href && !seen.has(href)) {
                seen.add(href);
                const row = $(el).closest('tr, .torrent-item, .table-list-wrap, li, .card, article, div[class*="torrent"]');
                result.magnetLinks.push({
                    url: href,
                    name: $(el).attr('title') || $(el).text().trim() || this._extractNameFromMagnet(href),
                    quality: this._detectQuality(href),
                    size: this._findNearbyText(row, $, ['size', 'filesize']),
                    seeders: this._findNearbyText(row, $, ['seed', 'se']),
                    leechers: this._findNearbyText(row, $, ['leech', 'le']),
                });
            }
        });

        // Magnet links hidden in JS/data attributes
        const magnetRegex = /magnet:\?xt=urn:[a-zA-Z0-9]+:[a-zA-Z0-9]+[^\s"'<>})\]\\]*/g;
        const allHtml = $.html();
        const jsMatches = allHtml.match(magnetRegex) || [];
        for (const m of jsMatches) {
            if (!seen.has(m)) {
                seen.add(m);
                result.magnetLinks.push({
                    url: m,
                    name: this._extractNameFromMagnet(m),
                    quality: this._detectQuality(m),
                });
            }
        }

        // ─── 2. TORRENT FILE LINKS ──────────────────────────────────────
        $('a[href$=".torrent"], a[href*=".torrent?"], a[href*="/download/torrent/"], a[href*="itorrents.org"], a[href*="torrage.info"]').each((_, el) => {
            let href = $(el).attr('href');
            if (!href) return;
            href = this._resolveUrl(href, baseUrl);
            if (href && !seen.has(href)) {
                seen.add(href);
                const row = $(el).closest('tr, li, div, article');
                result.torrentLinks.push({
                    url: href,
                    name: $(el).attr('title') || $(el).text().trim() || '',
                    quality: this._detectQuality(href),
                    size: this._findNearbyText(row, $, ['size']),
                });
            }
        });

        // ─── 3. DIRECT DOWNLOAD LINKS ───────────────────────────────────
        const videoExtensions = ['.mkv', '.mp4', '.avi', '.mov', '.wmv', '.flv', '.webm', '.m4v'];
        const archiveExtensions = ['.zip', '.rar', '.7z'];
        const allExtensions = [...videoExtensions, ...archiveExtensions];

        $('a[href]').each((_, el) => {
            const href = $(el).attr('href');
            if (!href) return;

            const lowerHref = href.toLowerCase();

            // Video/archive files
            const hasExt = allExtensions.some(ext => lowerHref.includes(ext));

            // Common download hosting patterns
            const isDownloadHost = /drive\.google|mega\.nz|mediafire|zippyshare|uploadhaven|racaty|1fichier|uptobox|rapidgator|nitroflare|turbobit|filefactory|uploaded\.net|ddownload|pixeldrain|gofile|send\.cm|streamtape|mixdrop|upstream|usersdrive|gdtot|hubcloud|apkadmin|gdflix|vcloud|fastdl|spix|adangle|linkstaker|hblinks/i.test(lowerHref);

            // Download button/link patterns
            const text = $(el).text().trim().toLowerCase();
            const isDownloadBtn = /download|descargar|telecharger|baixar|скачать|v-cloud|g-drive|mega|gdtot|hubcloud|direct|link|1080p|720p|480p|2160p|4k|bluray|webrip|hevc|x264|x265|fhd|uhd/i.test(text) &&
                !/screenshot|subtitle|srt|readme/i.test(text) && text.length < 60;

            let isDownloadLink = (hasExt || isDownloadHost || (isDownloadBtn && !lowerHref.startsWith('magnet:')));

            // Prevent classifying internal movie pages as direct links just because they have "Download" in their title
            const resolved = this._resolveUrl(href, baseUrl);
            if (!resolved) return;

            try {
                const baseDomain = new URL(baseUrl).hostname.replace('www.', '');
                const linkDomain = new URL(resolved).hostname.replace('www.', '');
                const isInternal = linkDomain === baseDomain || linkDomain.endsWith('.' + baseDomain);

                if (isDownloadLink && isInternal && !hasExt && !isDownloadHost) {
                    isDownloadLink = false;
                }
            } catch (e) { }

            if (isDownloadLink && !lowerHref.startsWith('magnet:') && !lowerHref.endsWith('.torrent') && !lowerHref.includes('imdb.com')) {
                if (!seen.has(resolved)) {
                    seen.add(resolved);
                    // Try to find quality in surrounding elements (parent, previous siblings)
                    let contextualText = text;
                    const parentText = $(el).parent().text();
                    let prevElementText = '';
                    let prevElem = $(el).parent().prev();
                    for(let i=0; i<3; i++) {
                        if(prevElem.length) {
                            prevElementText += ' ' + prevElem.text();
                            prevElem = prevElem.prev();
                        }
                    }
                    contextualText += ' ' + parentText + prevElementText;
                    
                    // First try to detect quality from the link itself. If none, use the surrounding context.
                    let detectedQuality = this._detectQuality(resolved + ' ' + text);
                    if (!detectedQuality) {
                        detectedQuality = this._detectQuality(contextualText);
                    }

                    result.directLinks.push({
                        url: resolved,
                        name: $(el).attr('title') || $(el).text().trim() || '',
                        quality: detectedQuality,
                    });
                }
            }
        });

        // ─── 4. MOVIE PAGE LINKS (for deeper crawling) ─────────────────
        $('a[href]').each((_, el) => {
            const href = $(el).attr('href');
            if (!href) return;

            const text = ($(el).text().trim() + ' ' + ($(el).attr('title') || '')).toLowerCase();
            const resolved = this._resolveUrl(href, baseUrl);
            if (!resolved) return;

            // Match movie detail pages, download pages
            const isMoviePage = /\/movie[s]?\//i.test(resolved) ||
                /\/torrent\//i.test(resolved) ||
                /\/download/i.test(resolved) ||
                /\/details\//i.test(resolved) ||
                /\/(film|video|watch|release)\//i.test(resolved) ||
                /\/[a-z0-9-]+-download-/i.test(resolved) ||
                /720p|1080p|2160p|4k|bluray|brrip|webrip|hdrip|dvdrip|x264|x265|hevc/i.test(text);

            if (isMoviePage && !seen.has(resolved)) {

                // If search query is present, only crawl movie pages that match the query
                let matchesQuery = true;
                if (query) {
                    // Split query into words > 2 chars to avoid matching 'a', 'the', etc.
                    const queryWords = query.split(/\s+/).filter(w => w.length > 2);
                    if (queryWords.length > 0) {
                        const linkText = text.toLowerCase();
                        const linkUrl = resolved.toLowerCase();
                        // Match if AT LEAST ONE significant query word is found in the link or text
                        matchesQuery = queryWords.some(w => linkText.includes(w) || linkUrl.includes(w));
                    }
                }

                if (matchesQuery) {
                    // Only same domain
                    try {
                        const baseDomain = new URL(baseUrl).hostname;
                        const linkDomain = new URL(resolved).hostname;
                        if (baseDomain === linkDomain || linkDomain.endsWith('.' + baseDomain.replace('www.', ''))) {
                            seen.add(resolved);
                            result.moviePageLinks.push({ url: resolved, text: text.substring(0, 100) });
                        }
                    } catch { }
                }
            }
        });

        return result;
    }

    /**
     * Extract name from magnet URI.
     */
    _extractNameFromMagnet(magnetUrl) {
        try {
            const match = magnetUrl.match(/dn=([^&]+)/);
            if (match) return decodeURIComponent(match[1]).replace(/\+/g, ' ');
        } catch { }
        return 'Unknown';
    }

    /**
     * Detect video quality from a string.
     */
    _detectQuality(str) {
        if (!str) return '';
        const s = str.toLowerCase();
        // Check specific resolutions FIRST (most precise)
        if (/2160p|\b4k\b|uhd|ultra\s*hd/i.test(s)) return '4K';
        if (/1080p|full\s*hd|fhd/i.test(s)) return '1080p';
        if (/720p/i.test(s)) return '720p';
        if (/480p/i.test(s)) return '480p';
        if (/360p/i.test(s)) return '360p';
        // Then check format keywords (less precise)
        if (/bluray|blu-ray/i.test(s)) return 'BluRay';
        if (/webrip|web-rip|web-dl|webdl/i.test(s)) return 'WEB-DL';
        if (/hdrip|hdtv/i.test(s)) return 'HDRip';
        if (/dvdrip|dvdscr/i.test(s)) return 'DVDRip';
        if (/cam(?:rip)?|hdcam/i.test(s)) return 'CAM';
        // Only match standalone 'hd' NOT inside domain names like hdhub4u, kmhd etc.
        if (/(?:^|[\s.\-_\/])hd(?:[\s.\-_\/]|$)/i.test(s)) return '720p';
        return '';
    }

    /**
     * Find text in a nearby table cell or sibling with the given label.
     */
    _findNearbyText(row, $, labels) {
        if (!row || !row.length) return '';
        const cells = row.find('td, span, div, .size, .seeds, .leeches');
        for (let i = 0; i < cells.length; i++) {
            const text = $(cells[i]).text().trim();
            const cls = $(cells[i]).attr('class') || '';
            for (const label of labels) {
                if (cls.toLowerCase().includes(label) || text.toLowerCase().includes(label)) {
                    // Return just numbers/size from this cell or next
                    const cleaned = text.replace(/[a-zA-Z:]/g, '').trim();
                    if (cleaned) return cleaned;
                }
            }
        }
        // Try text content matching size pattern
        const allText = row.text();
        const sizeMatch = allText.match(/(\d+\.?\d*\s*(GB|MB|KB|TB|GiB|MiB))/i);
        if (sizeMatch && labels.some(l => l.includes('size'))) return sizeMatch[1];
        return '';
    }

    /**
     * Resolve URL.
     */
    _resolveUrl(href, base) {
        if (!href) return null;
        href = href.trim();
        if (href.startsWith('#') || href.startsWith('mailto:') || href.startsWith('tel:') || href.startsWith('javascript:')) return null;
        try {
            const url = new URL(href, base);
            url.hash = '';
            return url.href;
        } catch { return null; }
    }

    /**
     * Deep Bypass shortlinks using browser meta-refresh and recursive click-throughs.
     * Designed to beat V-Cloud, FastDL, GPLinks, ShrinkMe, etc.
     */
    async _resolveShortlinkWithBrowser(url) {
        if (!this.context) return url;
        const shorteners = ['shrink', 'gplink', 'droplink', 'ouo.io', 'adf.ly', 'bit.ly', 'tinyurl', 'urlshortx', 'vcloud', 'fastdl', 'spix', 'adangle', 'linkstaker', 'tnshort', 'mdisk', 'hblinks'];
        const isShort = shorteners.some(s => url.toLowerCase().includes(s));
        if (!isShort) return url;

        this.logger.info(`🔄 Deep Bypassing shortener: ${url}`);
        let page;
        try {
            page = await this.context.newPage();
            // Block popups
            page.on('popup', popup => popup.close());

            await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 20000 });

            let currentUrl = page.url();
            let attempts = 0;
            const maxAttempts = 3; // Reduced from 4

            while (attempts < maxAttempts && !this.isStopped) {
                attempts++;

                // Wait for any countdowns (faster 2s wait)
                await page.waitForTimeout(2000);

                currentUrl = page.url();

                // If we reached a known destination, stop.
                const isDest = /drive\.google|mega\.nz|mediafire|zippyshare|racaty|1fichier|uptobox|rapidgator|gofile|send\.cm|hubcloud/i.test(currentUrl);
                if (isDest) {
                    this.logger.success(`✅ Deep Bypassed to: ${currentUrl}`);
                    return currentUrl;
                }

                // Scroll to bottom to trigger lazy loaded buttons
                await this._autoScroll(page);

                // Click common Indian/Global shortener bypass buttons
                const clicked = await page.evaluate(() => {
                    const keywords = ['start verification', 'verify to continue', 'click here to continue', 'continue', 'get link', 'go to link', 'download', 'skip ad', 'generate link'];
                    const elements = Array.from(document.querySelectorAll('a, button'));
                    for (const el of elements) {
                        const text = el.innerText.trim().toLowerCase();
                        // Ignore login/register buttons
                        if (text.includes('login') || text.includes('sign in')) continue;

                        if (keywords.some(k => text.includes(k))) {
                            // Ensure it's visible
                            if (el.offsetWidth > 0 && el.offsetHeight > 0) {
                                el.click();
                                return true;
                            }
                        }
                    }
                    // Try hidden inputs or forms
                    const forms = document.querySelectorAll('form');
                    for (const f of forms) {
                        if (f.innerText.toLowerCase().includes('continue') || f.action.includes('go')) {
                            f.submit();
                            return true;
                        }
                    }
                    return false;
                });

                if (clicked) {
                    // Wait for navigation after click
                    try {
                        await page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 10000 });
                    } catch (e) { }
                } else {
                    // No buttons found, maybe it's just a meta refresh or we reached the end
                    break;
                }
            }

            const finalUrl = page.url();
            if (finalUrl !== url && finalUrl !== 'about:blank') {
                this.logger.success(`✅ Bypassed to: ${finalUrl}`);
                return finalUrl;
            }
            return url;
        } catch (e) {
            return url;
        } finally {
            if (page) await page.close();
        }
    }

    /**
     * Auto-scroll page.
     */
    async _autoScroll(page) {
        try {
            await page.evaluate(async () => {
                await new Promise((resolve) => {
                    let totalHeight = 0;
                    const distance = 500;
                    const timer = setInterval(() => {
                        window.scrollBy(0, distance);
                        totalHeight += distance;
                        if (totalHeight >= document.body.scrollHeight || totalHeight > 8000) {
                            clearInterval(timer);
                            resolve();
                        }
                    }, 80);
                });
            });
        } catch { }
    }

    /**
     * Drain queue with concurrency.
     */
    async _drainQueue(config) {
        while (this.queue.length > 0 && !this.isStopped) {
            const batch = this.queue.splice(0, config.concurrency || 3);
            await Promise.allSettled(batch.map(item => this._processPage(item.url, item.depth, config)));
        }
    }

    /**
     * Print stats.
     */
    _printStats() {
        const chalk = require('chalk');
        console.log('');
        console.log(chalk.cyan('  ┌───────────────────────────────────────────────────┐'));
        console.log(chalk.cyan('  │') + chalk.white.bold(`  🎬 Movie Crawler Statistics                        `) + chalk.cyan('│'));
        console.log(chalk.cyan('  ├───────────────────────────────────────────────────┤'));
        console.log(chalk.cyan('  │') + `  🌐 Pages Crawled:      ${chalk.green.bold(String(this.stats.pagesCrawled).padStart(6))}                 ` + chalk.cyan('│'));
        console.log(chalk.cyan('  │') + `  🧲 Magnet Links:       ${chalk.magenta.bold(String(this.stats.magnetLinks).padStart(6))}                 ` + chalk.cyan('│'));
        console.log(chalk.cyan('  │') + `  📦 Torrent Files:      ${chalk.blue.bold(String(this.stats.torrentLinks).padStart(6))}                 ` + chalk.cyan('│'));
        console.log(chalk.cyan('  │') + `  ⬇️  Direct Downloads:   ${chalk.yellow.bold(String(this.stats.directLinks).padStart(6))}                 ` + chalk.cyan('│'));
        console.log(chalk.cyan('  │') + `  ❌ Errors:             ${chalk.red.bold(String(this.stats.errors).padStart(6))}                 ` + chalk.cyan('│'));
        console.log(chalk.cyan('  │') + `  ⏱️  Time:               ${chalk.gray(this.stats.timeTaken.padStart(6))}                 ` + chalk.cyan('│'));
        console.log(chalk.cyan('  └───────────────────────────────────────────────────┘'));
        console.log('');
    }

    /**
     * Build results.
     */
    /**
     * Extract a clean movie title from a source URL.
     * e.g. "https://site.com/batman-begins-2005-hindi-dubbed/" -> "Batman Begins 2005"
     */
    _extractMovieTitle(sourceUrl) {
        try {
            const urlObj = new URL(sourceUrl);
            let path = urlObj.pathname;
            // Remove trailing slash and leading slash
            path = path.replace(/^\/+|\/+$/g, '');
            // Get the last path segment (the movie slug)
            const segments = path.split('/');
            let slug = segments[segments.length - 1] || segments[segments.length - 2] || '';
            // ─── FIX: Remove leading numeric post IDs like "3501621-" or "52263-"
            slug = slug.replace(/^\d+-/, '');
            // Remove common suffixes
            slug = slug.replace(/-(full-movie|download|free|hd|bluray|webrip|camrip|hindi|english|dubbed|dual-audio|dd[0-9.-]+|x264|x265|hevc|esub|hc-esub|hdrip|dvdrip|brrip|web-dl).*$/gi, '');
            // Remove quality tags like 1080p-720p-480p
            slug = slug.replace(/-(1080p|720p|480p|2160p|4k)(-[0-9]+p)*/gi, '');
            // Convert dashes to spaces and capitalize
            const title = slug.replace(/[-_]+/g, ' ').replace(/\b\w/g, c => c.toUpperCase()).trim();
            return title || 'Unknown';
        } catch {
            return 'Unknown';
        }
    }

    _buildResults() {
        // Group links by movie title (extracted from source URL)
        const movieMap = new Map();
        for (const link of this.allDownloadLinks) {
            const movieTitle = this._extractMovieTitle(link.source);
            if (!movieMap.has(movieTitle)) {
                movieMap.set(movieTitle, {
                    title: movieTitle,
                    source: link.source,
                    links: { direct: [], magnet: [], torrent: [] },
                    byQuality: {}
                });
            }
            const movie = movieMap.get(movieTitle);
            // Add to type bucket
            if (link.type === 'magnet') movie.links.magnet.push(link);
            else if (link.type === 'torrent') movie.links.torrent.push(link);
            else movie.links.direct.push(link);
            // Add to quality bucket
            const q = link.quality || 'other';
            if (!movie.byQuality[q]) movie.byQuality[q] = [];
            movie.byQuality[q].push(link);
        }

        const movies = [...movieMap.values()];

        return {
            meta: {
                crawledAt: new Date().toISOString(),
                pagesCrawled: this.stats.pagesCrawled,
                totalDownloadLinks: this.allDownloadLinks.length,
                magnetLinks: this.stats.magnetLinks,
                torrentLinks: this.stats.torrentLinks,
                directLinks: this.stats.directLinks,
                errors: this.stats.errors,
                timeTaken: this.stats.timeTaken,
                moviesFound: movies.length
            },
            // Grouped by individual movie
            movies: movies,
            // Flat lists (backwards compatible)
            downloads: {
                all: this.allDownloadLinks,
                magnets: this.allDownloadLinks.filter(l => l.type === 'magnet'),
                torrents: this.allDownloadLinks.filter(l => l.type === 'torrent'),
                direct: this.allDownloadLinks.filter(l => l.type === 'direct'),
            },
            byQuality: {
                '4K': this.allDownloadLinks.filter(l => l.quality === '4K'),
                '1080p': this.allDownloadLinks.filter(l => l.quality === '1080p'),
                '720p': this.allDownloadLinks.filter(l => l.quality === '720p'),
                '480p': this.allDownloadLinks.filter(l => l.quality === '480p'),
                other: this.allDownloadLinks.filter(l => !['4K', '1080p', '720p', '480p'].includes(l.quality)),
            }
        };
    }

    /**
     * Save results.
     */
    async _saveResults(results) {
        const outFile = 'movie_results.json';
        await fs.writeFile(outFile, JSON.stringify(results, null, 2), 'utf-8');
        this.logger.info(`💾 Results saved: ${outFile}`);

        // Also save a clean links-only file
        const linksFile = 'movie_links.txt';
        const lines = [];
        lines.push('=== MAGNET LINKS ===\n');
        for (const l of results.downloads.magnets) {
            lines.push(`[${l.quality || '?'}] ${l.name}`);
            lines.push(l.url);
            lines.push('');
        }
        lines.push('\n=== TORRENT FILES ===\n');
        for (const l of results.downloads.torrents) {
            lines.push(`[${l.quality || '?'}] ${l.name}`);
            lines.push(l.url);
            lines.push('');
        }
        lines.push('\n=== DIRECT DOWNLOADS ===\n');
        for (const l of results.downloads.direct) {
            lines.push(`[${l.quality || '?'}] ${l.name}`);
            lines.push(l.url);
            lines.push('');
        }
        await fs.writeFile(linksFile, lines.join('\n'), 'utf-8');
        this.logger.info(`💾 Links saved: ${linksFile}`);
    }
}

module.exports = MovieCrawler;
