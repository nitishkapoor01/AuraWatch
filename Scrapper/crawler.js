const { chromium } = require('playwright');
const cheerio = require('cheerio');
const { URL } = require('url');
const resolver = require('./utils/resolver');
const { Logger } = require('./utils/logger');
const config = require('./config.json');

class MegaCrawler {
    constructor(options = {}) {
        this.config = { ...config, ...options };
        this.visited = new Set();
        this.allLinks = new Map(); // url -> { source, depth, resolved, type, status }
        this.queue = [];
        this.browser = null;
        this.context = null;
        this.logger = new Logger();
        this.stats = {
            pagesCrawled: 0,
            linksFound: 0,
            linksResolved: 0,
            errors: 0,
            startTime: Date.now()
        };
    }

    /**
     * Finds system-installed Chrome/Edge as fallback.
     */
    _findSystemChrome() {
        const fs = require('fs');
        const paths = [
            'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
            'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
            process.env.LOCALAPPDATA + '\\Google\\Chrome\\Application\\chrome.exe',
            'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
            'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
            '/usr/bin/google-chrome',
            '/usr/bin/chromium-browser',
            '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
        ];
        for (const p of paths) {
            try { if (fs.existsSync(p)) return p; } catch {}
        }
        return null;
    }

    /**
     * Start the crawl from a given URL.
     * @param {string} startUrl - The starting URL to crawl.
     * @param {object} opts - Override options.
     */
    async crawl(startUrl, opts = {}) {
        const mergedConfig = { ...this.config, ...opts };
        this.logger.banner();
        this.logger.info(`Starting crawl: ${startUrl}`);
        this.logger.info(`Max depth: ${mergedConfig.maxDepth} | Concurrency: ${mergedConfig.concurrency} | Resolve short links: ${mergedConfig.resolveShortLinks}`);

        try {
            // Try Playwright's bundled browser first, fallback to system Chrome
            const launchOpts = {
                headless: true,
                args: [
                    '--no-sandbox',
                    '--disable-setuid-sandbox',
                    '--disable-dev-shm-usage',
                    '--disable-accelerated-2d-canvas',
                    '--disable-gpu',
                    '--window-size=1920,1080',
                ]
            };

            try {
                this.browser = await chromium.launch(launchOpts);
                this.logger.success('Using Playwright bundled Chromium');
            } catch (e) {
                this.logger.warn('Playwright bundled browser not found, checking system Chrome...');
                const systemChrome = this._findSystemChrome();
                if (systemChrome) {
                    launchOpts.executablePath = systemChrome;
                    this.browser = await chromium.launch(launchOpts);
                    this.logger.success(`Using system browser: ${systemChrome}`);
                } else {
                    throw new Error('No browser found! Run "npx playwright install chromium" or install Chrome/Edge.');
                }
            }

            this.context = await this.browser.newContext({
                userAgent: mergedConfig.userAgent,
                viewport: { width: 1920, height: 1080 },
                extraHTTPHeaders: mergedConfig.headers,
                ignoreHTTPSErrors: true
            });

            // Start the recursive crawl
            await this._processUrl(startUrl, 0, mergedConfig);

            // Process remaining queue with concurrency
            await this._drainQueue(mergedConfig);

        } catch (err) {
            this.logger.error(`Fatal error: ${err.message}`);
            this.stats.errors++;
        } finally {
            if (this.browser) {
                await this.browser.close();
            }
        }

        // Resolve short links if enabled
        if (mergedConfig.resolveShortLinks) {
            await this._resolveAllShortLinks();
        }

        // Show stats
        const elapsed = ((Date.now() - this.stats.startTime) / 1000).toFixed(1);
        this.stats.timeTaken = `${elapsed}s`;
        this.logger.stats(this.stats);

        // Save results
        const results = this._buildResults();
        await this._saveResults(results, mergedConfig);

        this.logger.done();
        return results;
    }

    /**
     * Process a single URL: navigate, wait, extract links.
     */
    async _processUrl(url, depth, config) {
        if (this.visited.has(url)) return;
        if (depth > config.maxDepth) return;
        if (this._isBlockedDomain(url)) return;

        this.visited.add(url);
        this.logger.crawling(url, depth);

        let page;
        try {
            page = await this.context.newPage();

            // Block unnecessary resources for speed
            await page.route('**/*', (route) => {
                const resourceType = route.request().resourceType();
                if (['image', 'stylesheet', 'font', 'media'].includes(resourceType)) {
                    route.abort();
                } else {
                    route.continue();
                }
            });

            // Navigate to the page
            await page.goto(url, {
                waitUntil: config.waitForJS ? 'networkidle' : 'domcontentloaded',
                timeout: config.timeout
            });

            // Wait a bit more for JS-rendered content
            if (config.waitForJS) {
                await page.waitForTimeout(2000);
            }

            // Scroll down to trigger lazy loading
            await this._autoScroll(page);

            // Get the full rendered HTML
            const html = await page.content();

            // Extract links
            const links = this._extractLinks(html, url);

            this.stats.pagesCrawled++;

            for (const link of links) {
                if (!this.allLinks.has(link.url)) {
                    this.allLinks.set(link.url, {
                        url: link.url,
                        source: url,
                        depth: depth,
                        type: link.type,
                        text: link.text,
                        resolved: null,
                        status: 'found'
                    });
                    this.stats.linksFound++;
                    this.logger.link(link.url, 'found');

                    // Add to queue for deeper crawling if internal
                    if (link.type === 'internal' && depth + 1 <= config.maxDepth) {
                        this.queue.push({ url: link.url, depth: depth + 1 });
                    }
                }
            }

        } catch (err) {
            this.logger.error(`Failed to crawl ${url}: ${err.message}`);
            this.stats.errors++;
        } finally {
            if (page) {
                await page.close();
            }
        }
    }

    /**
     * Drain the queue with concurrency control.
     */
    async _drainQueue(config) {
        while (this.queue.length > 0) {
            const batch = this.queue.splice(0, config.concurrency);
            const promises = batch.map(item => this._processUrl(item.url, item.depth, config));
            await Promise.allSettled(promises);
        }
    }

    /**
     * Auto-scroll a page to trigger lazy-loaded content.
     */
    async _autoScroll(page) {
        try {
            await page.evaluate(async () => {
                await new Promise((resolve) => {
                    let totalHeight = 0;
                    const distance = 400;
                    const timer = setInterval(() => {
                        window.scrollBy(0, distance);
                        totalHeight += distance;
                        if (totalHeight >= document.body.scrollHeight || totalHeight > 10000) {
                            clearInterval(timer);
                            resolve();
                        }
                    }, 100);
                });
            });
        } catch (e) {
            // Scroll failed, not critical
        }
    }

    /**
     * Extract all links from HTML using Cheerio.
     */
    _extractLinks(html, baseUrl) {
        const $ = cheerio.load(html);
        const links = [];
        const seen = new Set();

        // Extract from <a> tags
        $('a[href]').each((_, el) => {
            const href = $(el).attr('href');
            const text = $(el).text().trim().substring(0, 100);
            const resolved = this._resolveUrl(href, baseUrl);
            if (resolved && !seen.has(resolved)) {
                seen.add(resolved);
                links.push({
                    url: resolved,
                    text: text || '',
                    type: this._getLinkType(resolved, baseUrl)
                });
            }
        });

        // Extract from <iframe> src
        $('iframe[src]').each((_, el) => {
            const src = $(el).attr('src');
            const resolved = this._resolveUrl(src, baseUrl);
            if (resolved && !seen.has(resolved)) {
                seen.add(resolved);
                links.push({ url: resolved, text: '[iframe]', type: 'embed' });
            }
        });

        // Extract from <script> src
        $('script[src]').each((_, el) => {
            const src = $(el).attr('src');
            const resolved = this._resolveUrl(src, baseUrl);
            if (resolved && !seen.has(resolved)) {
                seen.add(resolved);
                links.push({ url: resolved, text: '[script]', type: 'resource' });
            }
        });

        // Extract from <source> src (video/audio)
        $('source[src]').each((_, el) => {
            const src = $(el).attr('src');
            const resolved = this._resolveUrl(src, baseUrl);
            if (resolved && !seen.has(resolved)) {
                seen.add(resolved);
                links.push({ url: resolved, text: '[media]', type: 'media' });
            }
        });

        // Extract from <video> src
        $('video[src]').each((_, el) => {
            const src = $(el).attr('src');
            const resolved = this._resolveUrl(src, baseUrl);
            if (resolved && !seen.has(resolved)) {
                seen.add(resolved);
                links.push({ url: resolved, text: '[video]', type: 'media' });
            }
        });

        // Extract URLs from inline JS (regex pattern matching)
        const scriptBlocks = $('script:not([src])').map((_, el) => $(el).html()).get().join('\n');
        const urlRegex = /https?:\/\/[^\s"'<>\)\]\}\\]+/g;
        const jsUrls = scriptBlocks.match(urlRegex) || [];
        for (const rawUrl of jsUrls) {
            const cleaned = rawUrl.replace(/[,;]+$/, '');
            if (!seen.has(cleaned) && this._isValidUrl(cleaned)) {
                seen.add(cleaned);
                links.push({ url: cleaned, text: '[js-embedded]', type: 'js-embedded' });
            }
        }

        // Extract from data attributes
        $('[data-url], [data-href], [data-src], [data-link]').each((_, el) => {
            const attrs = ['data-url', 'data-href', 'data-src', 'data-link'];
            for (const attr of attrs) {
                const val = $(el).attr(attr);
                if (val) {
                    const resolved = this._resolveUrl(val, baseUrl);
                    if (resolved && !seen.has(resolved)) {
                        seen.add(resolved);
                        links.push({ url: resolved, text: `[${attr}]`, type: 'data-attr' });
                    }
                }
            }
        });

        // Extract from meta tags (og:url, og:image, etc.)
        $('meta[content]').each((_, el) => {
            const content = $(el).attr('content');
            if (content && this._isValidUrl(content)) {
                if (!seen.has(content)) {
                    seen.add(content);
                    links.push({ url: content, text: '[meta]', type: 'meta' });
                }
            }
        });

        return links;
    }

    /**
     * Resolve a potentially relative URL against a base.
     */
    _resolveUrl(href, base) {
        if (!href) return null;
        href = href.trim();
        if (href.startsWith('#') || href.startsWith('mailto:') || href.startsWith('tel:') || href.startsWith('javascript:')) {
            return null;
        }
        try {
            const resolved = new URL(href, base).href;
            // Remove fragment
            const url = new URL(resolved);
            url.hash = '';
            return url.href;
        } catch {
            return null;
        }
    }

    /**
     * Determine if a link is internal or external.
     */
    _getLinkType(url, baseUrl) {
        try {
            const urlHost = new URL(url).hostname;
            const baseHost = new URL(baseUrl).hostname;
            return urlHost === baseHost ? 'internal' : 'external';
        } catch {
            return 'unknown';
        }
    }

    /**
     * Check if a URL is valid.
     */
    _isValidUrl(str) {
        try {
            const url = new URL(str);
            return url.protocol === 'http:' || url.protocol === 'https:';
        } catch {
            return false;
        }
    }

    /**
     * Check if a domain is blocked.
     */
    _isBlockedDomain(url) {
        try {
            const hostname = new URL(url).hostname;
            return this.config.blockedDomains.some(d => hostname.includes(d));
        } catch {
            return false;
        }
    }

    /**
     * Resolve all short links found during crawling.
     */
    async _resolveAllShortLinks() {
        this.logger.info('Resolving shortened links...');
        const entries = [...this.allLinks.entries()];

        for (const [url, info] of entries) {
            if (resolver.isShortLink(url)) {
                try {
                    const resolved = await resolver.resolve(url);
                    if (resolved !== url) {
                        info.resolved = resolved;
                        info.status = 'resolved';
                        this.stats.linksResolved++;
                        this.logger.link(resolved, 'resolved');
                    }
                } catch (err) {
                    this.logger.link(url, 'error');
                }
            }
        }
    }

    /**
     * Build the final results object.
     */
    _buildResults() {
        const links = [...this.allLinks.values()];

        return {
            meta: {
                crawledAt: new Date().toISOString(),
                totalLinks: links.length,
                pagesCrawled: this.stats.pagesCrawled,
                errors: this.stats.errors,
                resolved: this.stats.linksResolved
            },
            links: {
                all: links,
                internal: links.filter(l => l.type === 'internal'),
                external: links.filter(l => l.type === 'external'),
                media: links.filter(l => l.type === 'media'),
                embedded: links.filter(l => l.type === 'js-embedded' || l.type === 'embed'),
                resources: links.filter(l => l.type === 'resource'),
                shortLinksResolved: links.filter(l => l.resolved)
            }
        };
    }

    /**
     * Save results to a file.
     */
    async _saveResults(results, config) {
        const fs = require('fs').promises;
        const outputFile = config.output?.file || 'results.json';

        await fs.writeFile(outputFile, JSON.stringify(results, null, 2), 'utf-8');
        this.logger.saved(outputFile);

        // Also save a CSV version
        const csvFile = outputFile.replace('.json', '.csv');
        const csvLines = ['URL,Type,Source,Text,Resolved'];
        for (const link of results.links.all) {
            const escaped = (str) => `"${(str || '').replace(/"/g, '""')}"`;
            csvLines.push(`${escaped(link.url)},${escaped(link.type)},${escaped(link.source)},${escaped(link.text)},${escaped(link.resolved || '')}`);
        }
        await fs.writeFile(csvFile, csvLines.join('\n'), 'utf-8');
        this.logger.saved(csvFile);
    }
}

module.exports = MegaCrawler;
