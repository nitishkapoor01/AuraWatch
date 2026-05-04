const axios = require('axios');
const cheerio = require('cheerio');
const { Logger } = require('./logger');

// VidVault uses TMDb IDs — use env variable, fallback to their public embedded key
const TMDB_API_KEY = process.env.TMDB_API_KEY_1 || process.env.TMDB_API_KEY || '54e00466a09676df57ba51c4ca30b1a6';
const VIDVAULT_API = 'https://vidvault.ru/api';
const VIDVAULT_CDN = 'https://dl.gemlelispe.workers.dev';

class MovieCrawler {
    constructor(options = {}) {
        this.config = options;
        this.logger = new Logger();
        this.stats = {
            pagesCrawled: 0,
            moviesFound: 0,
            directLinks: 0,
            torrentLinks: 0,
            errors: 0,
            startTime: Date.now()
        };
    }

    /**
     * Resolve multi-step WordPress shorteners like cloud.unblockedgames.world
     * These sites use a 2-step POST form before redirecting to the real link.
     * Step 1: GET /?sid=BASE64 → extract hidden _wp_http input
     * Step 2: POST / with _wp_http → extract _wp_http2 input + next URL
     * Step 3: POST next URL with _wp_http2 → get real link via redirect
     * Returns the resolved final URL, or the original URL if it can't be resolved.
     */
    async _resolveShortener(shortUrl) {
        try {
            const headers = {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                'Accept-Language': 'en-US,en;q=0.9',
            };

            // Step 1: GET the shortener page
            const step1 = await axios.get(shortUrl, { headers, timeout: 10000 });
            const $1 = cheerio.load(step1.data);

            const wpHttp = $1('input[name="_wp_http"]').val();
            const formAction1 = $1('form').attr('action') || new URL(shortUrl).origin + '/';
            if (!wpHttp) return shortUrl; // Can't resolve, return as-is

            // Step 2: POST with _wp_http
            const params2 = new URLSearchParams();
            params2.append('_wp_http', wpHttp);
            const step2 = await axios.post(formAction1, params2, {
                headers: { ...headers, 'Content-Type': 'application/x-www-form-urlencoded', 'Referer': shortUrl },
                timeout: 10000,
                maxRedirects: 5
            });
            const $2 = cheerio.load(step2.data);

            // Check for a redirect link first
            let finalUrl = null;
            $2('a[href]').each((_, el) => {
                const href = $2(el).attr('href');
                const host = shortUrl ? new URL(shortUrl).hostname : '';
                if (href && !href.includes(host) && !href.startsWith('#') && href.startsWith('http')) {
                    finalUrl = href;
                    return false;
                }
            });
            if (finalUrl) return finalUrl;

            // Check for script redirect
            const scriptRedir = step2.data.match(/window\.location(?:\.href)?\s*=\s*['"]([^'"]+)['"]/);
            if (scriptRedir) return scriptRedir[1];

            // Step 3: If there's _wp_http2, do one more POST
            const wpHttp2 = $2('input[name="_wp_http2"]').val();
            const formAction2 = $2('form').attr('action');
            if (wpHttp2 && formAction2) {
                const params3 = new URLSearchParams();
                params3.append('_wp_http2', wpHttp2);
                const step3 = await axios.post(formAction2, params3, {
                    headers: { ...headers, 'Content-Type': 'application/x-www-form-urlencoded', 'Referer': formAction1 },
                    timeout: 10000,
                    maxRedirects: 10
                });
                // The final redirect URL is what we want
                const finalRedirectUrl = step3.request?.res?.responseUrl || step3.config?.url;
                const shortenerPatterns = ['unblockedgames', 'modlist', 'kmhd', 'katmoviehd'];
                if (finalRedirectUrl && !shortenerPatterns.some(p => finalRedirectUrl.includes(p))) {
                    return finalRedirectUrl;
                }
                // Also check for links on the final page
                const $3 = cheerio.load(step3.data);
                $3('a[href]').each((_, el) => {
                    const href = $3(el).attr('href');
                    if (href && href.startsWith('http') && !shortenerPatterns.some(p => href.includes(p)) && !href.includes('google.com')) {
                        finalUrl = href;
                        return false;
                    }
                });
                if (finalUrl) return finalUrl;
            }

            return shortUrl; // Return original if all else fails
        } catch (e) {
            this.logger.warn(`Shortener resolve failed for ${shortUrl}: ${e.message}`);
            return shortUrl; // Return original on error
        }
    }



    /**
     * Search for an EXACT movie and return only its download links.
     * Uses lightweight axios/cheerio approach for HDHub4u and YTS API.
     */
    async _searchYTS(title, year) {
        try {
            this.logger.info(`🔍 Searching YTS...`);
            const query = year ? `${title} ${year}` : title;
            const url = `https://yts.mx/api/v2/list_movies.json?query_term=${encodeURIComponent(query)}&limit=5`;
            const response = await axios.get(url, { timeout: 10000 });
            
            if (response.data.status === 'ok' && response.data.data.movie_count > 0) {
                let movies = response.data.data.movies;
                
                // Filter movies by strict title match
                movies = movies.filter(m => this._isTitleMatch(m.title, title, year));
                if (movies.length === 0) return null;

                const match = year ? movies.find(m => String(m.year) === String(year)) || movies[0] : movies[0];
                
                if (match && match.torrents) {
                    const qualities = {};
                    const links = { direct: [], magnet: [], torrent: [] };
                    
                    match.torrents.forEach(t => {
                        const q = t.quality === '2160p' ? '4K' : t.quality;
                        if (!qualities[q]) qualities[q] = [];
                        
                        const magnet = `magnet:?xt=urn:btih:${t.hash}&dn=${encodeURIComponent(match.title)}&tr=udp://open.demonii.com:1337/announce&tr=udp://tracker.openbittorrent.com:80`;
                        
                        const linkObj = {
                            url: magnet,
                            name: `YTS ${match.title} [${q}] [${t.type}]`,
                            type: 'magnet',
                            size: t.size
                        };
                        
                        qualities[q].push(linkObj);
                        links.magnet.push(linkObj);
                        this.stats.torrentLinks++;
                    });
                    
                    return { title: match.title, qualities, links };
                }
            }
        } catch (e) {
            this.logger.warn(`YTS search failed: ${e.message}`);
        }
        return null;
    }

    /**
     * Helper: Convert bytes to human-readable size (e.g. "1.34 GB")
     */
    _formatBytes(bytes, decimals = 2) {
        if (!bytes || bytes <= 0) return null;
        const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
        const i = Math.floor(Math.log(bytes) / Math.log(1024));
        const idx = Math.min(i, sizes.length - 1);
        return (bytes / Math.pow(1024, idx)).toFixed(decimals) + ' ' + sizes[idx];
    }

    /**
     * Helper: Resolve a movie/TV title to a TMDb ID using TMDb search API.
     * Returns { tmdbId, mediaType } or null.
     */
    async _getTmdbId(title, year, type) {
        try {
            const mediaType = type === 'tv' ? 'tv' : 'movie';
            const query = encodeURIComponent(title);
            const yearParam = year ? `&year=${year}` : '';
            const url = `https://api.themoviedb.org/3/search/${mediaType}?api_key=${TMDB_API_KEY}&query=${query}${yearParam}&language=en-US&page=1`;
            
            const response = await axios.get(url, { timeout: 8000 });
            const results = response.data.results;
            
            if (results && results.length > 0) {
                // Filter results to ensure the title actually matches our strict criteria
                const validResults = results.filter(r => {
                    const rTitle = mediaType === 'tv' ? r.name : r.title;
                    return this._isTitleMatch(rTitle, title, year);
                });
                
                if (validResults.length === 0) {
                    this.logger.warn(`TMDb lookup found results but none passed strict title match for: ${title}`);
                    return null;
                }

                // Try to find exact year match first among valid results
                let match = validResults[0];
                if (year) {
                    const dateField = mediaType === 'tv' ? 'first_air_date' : 'release_date';
                    const yearMatch = validResults.find(r => r[dateField] && r[dateField].startsWith(String(year)));
                    if (yearMatch) match = yearMatch;
                }
                return { tmdbId: String(match.id), mediaType };
            }
        } catch (e) {
            this.logger.warn(`TMDb lookup failed: ${e.message}`);
        }
        return null;
    }

    /**
     * VidVault.ru — Direct MP4/MKV downloads via their REST API.
     * Uses TMDb IDs for lookups, provides multiple quality options with file sizes.
     */
    async _searchVidVault(title, year, tvInfo = {}) {
        try {
            this.logger.info(`🔍 Searching VidVault...`);
            const { type, season, episode, tmdbId } = tvInfo;
            
            // Step 1: Get TMDb ID (use provided one if available)
            let finalTmdbId = tmdbId;
            if (!finalTmdbId) {
                const tmdbResult = await this._getTmdbId(title, year, type);
                if (!tmdbResult) {
                    this.logger.warn('VidVault: Could not resolve TMDb ID');
                    return null;
                }
                finalTmdbId = tmdbResult.tmdbId;
            }
            
            this.logger.info(`📄 [VidVault] TMDb ID: ${finalTmdbId}`);
            
            // Step 2: Get auth token
            const tokenRes = await axios.get(`${VIDVAULT_API}/get-token`, { timeout: 8000 });
            const token = tokenRes.data?.t || '';
            
            if (!token) {
                this.logger.warn('VidVault: Failed to get auth token');
                return null;
            }
            
            // Step 3: Fetch download links
            const payload = {
                type: type === 'tv' ? 'tv' : 'movie',
                tmdbId: finalTmdbId,
                season: season ? Number(season) : undefined,
                episode: episode ? Number(episode) : undefined
            };
            
            const dlRes = await axios.post(`${VIDVAULT_API}/download-proxy`, payload, {
                headers: {
                    'Content-Type': 'application/json',
                    'x-request-token': token
                },
                timeout: 15000
            });
            
            const extractData = dlRes.data?.extractData;
            const mkvData = dlRes.data?.mkvData;
            const coreData = extractData?.data?.data || extractData?.data;
            
            const qualities = {};
            const links = { direct: [], magnet: [], torrent: [] };
            const displayName = year ? `${title} (${year})` : title;
            const encodedName = encodeURIComponent(displayName);
            
            // Parse MP4 streams
            if (coreData?.streams) {
                for (const stream of coreData.streams) {
                    if (!stream.size || !stream.url) continue;
                    const resolution = stream.resolutions || stream.resolution || null;
                    const q = resolution ? this._detectQuality(`${resolution}p`) || resolution + 'p' : 'other';
                    const size = this._formatBytes(Number(stream.size));
                    
                    if (!qualities[q]) qualities[q] = [];
                    const linkObj = {
                        url: stream.url,
                        name: `VidVault: ${q} MP4 [${size || 'Unknown'}]`,
                        type: 'direct',
                        size: size,
                        proxyRequired: true
                    };
                    qualities[q].push(linkObj);
                    links.direct.push(linkObj);
                    this.stats.directLinks++;
                }
            }
            
            // Parse MP4 downloads (alternative format)
            if (coreData?.downloads) {
                for (const dl of coreData.downloads) {
                    if (!dl.size || !dl.url) continue;
                    const resolution = dl.resolution || null;
                    const q = resolution ? this._detectQuality(`${resolution}p`) || resolution + 'p' : 'other';
                    const size = this._formatBytes(Number(dl.size));
                    
                    if (!qualities[q]) qualities[q] = [];
                    const linkObj = {
                        url: dl.url,
                        name: `VidVault: ${q} MP4 [${size || 'Unknown'}]`,
                        type: 'direct',
                        size: size,
                        proxyRequired: true
                    };
                    // Avoid duplicate URLs
                    if (!qualities[q].some(l => l.url === dl.url)) {
                        qualities[q].push(linkObj);
                        links.direct.push(linkObj);
                        this.stats.directLinks++;
                    }
                }
            }
            
            // Parse MKV downloads (embedded subtitles)
            if (mkvData?.files) {
                for (const file of mkvData.files) {
                    if (!file.url) continue;
                    const size = typeof file.size === 'number' ? this._formatBytes(file.size) : String(file.size || 'Unknown');
                    // MKV files are usually 480p+
                    const q = '480p';
                    if (!qualities[q]) qualities[q] = [];
                    const linkObj = {
                        url: file.url,
                        name: `VidVault: MKV [${size}] (embedded subs)`,
                        type: 'direct',
                        size: size
                    };
                    qualities[q].push(linkObj);
                    links.direct.push(linkObj);
                    this.stats.directLinks++;
                }
            }
            
            if (links.direct.length > 0) {
                this.logger.info(`✅ [VidVault] Found ${links.direct.length} direct download links`);
                return { title: displayName, qualities, links };
            }
            
            this.logger.warn('VidVault: No download links in response');
        } catch (e) {
            this.logger.warn(`VidVault search failed: ${e.message}`);
        }
        return null;
    }

    /**
     * PirateBay — JSON API at apibay.org, returns info_hash for magnet links.
     * No shorteners, direct magnet links. Covers movies (cat=207) and TV (cat=205).
     */
    async _searchPirateBay(title, year, tvInfo = {}) {
        try {
            this.logger.info(`🔍 Searching PirateBay...`);
            const { type, season, episode } = tvInfo;
            let query, cat;
            
            if (type === 'tv' && season) {
                const sNum = String(season).padStart(2, '0');
                const eNum = episode ? String(episode).padStart(2, '0') : null;
                query = episode ? `${title} S${sNum}E${eNum}` : `${title} Season ${season}`;
                cat = 205; // TV shows
            } else {
                query = year ? `${title} ${year}` : title;
                cat = 207; // HD Movies
            }
            
            const url = `https://apibay.org/q.php?q=${encodeURIComponent(query)}&cat=${cat}`;
            const response = await axios.get(url, { timeout: 10000 });
            
            if (!Array.isArray(response.data) || response.data.length === 0) return null;
            // apibay returns [{id:"0",name:"No results"}] when nothing found
            if (response.data[0].id === '0') return null;
            
            const qualities = {};
            const links = { direct: [], magnet: [], torrent: [] };
            const trackers = 'tr=udp://tracker.opentrackr.org:1337/announce&tr=udp://open.demonii.com:1337/announce&tr=udp://tracker.openbittorrent.com:80';
            
            // Filter by strict title match first, then seeders, then take top 8
            const topResults = response.data
                .filter(t => this._isTitleMatch(t.name, title, year) && parseInt(t.seeders) > 0)
                .slice(0, 8);
                
            if (topResults.length === 0) return null;
            
            for (const torrent of topResults) {
                const magnet = `magnet:?xt=urn:btih:${torrent.info_hash}&dn=${encodeURIComponent(torrent.name)}&${trackers}`;
                const size = this._formatBytes(parseInt(torrent.size));
                const q = this._detectQuality(torrent.name) || 'other';
                
                if (!qualities[q]) qualities[q] = [];
                const linkObj = {
                    url: magnet,
                    name: `PirateBay: ${torrent.name} [${size}] [${torrent.seeders} seeds]`,
                    type: 'magnet',
                    size: size
                };
                qualities[q].push(linkObj);
                links.magnet.push(linkObj);
                this.stats.torrentLinks++;
            }
            
            if (links.magnet.length > 0) {
                this.logger.info(`✅ [PirateBay] Found ${links.magnet.length} magnet links`);
                return { title: topResults[0].name, qualities, links };
            }
        } catch (e) {
            this.logger.warn(`PirateBay search failed: ${e.message}`);
        }
        return null;
    }

    /**
     * 1337x — Scrapes search results and individual torrent pages for magnet links.
     * Two-step: search page → torrent page → extract magnet link.
     */
    async _search1337x(title, year, tvInfo = {}) {
        try {
            this.logger.info(`🔍 Searching 1337x...`);
            const { type, season, episode } = tvInfo;
            let query;
            
            if (type === 'tv' && season) {
                const sNum = String(season).padStart(2, '0');
                const eNum = episode ? String(episode).padStart(2, '0') : null;
                query = episode ? `${title} S${sNum}E${eNum}` : `${title} Season ${season}`;
            } else {
                query = year ? `${title} ${year}` : title;
            }
            
            const searchUrl = `https://1337x.to/search/${encodeURIComponent(query)}/1/`;
            const response = await axios.get(searchUrl, {
                headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
                timeout: 12000
            });
            
            const $ = cheerio.load(response.data);
            const resultRows = $('tbody tr').slice(0, 5); // Top 5 results
            
            if (resultRows.length === 0) return null;
            
            const qualities = {};
            const links = { direct: [], magnet: [], torrent: [] };
            
            // Fetch magnet links from individual torrent pages (limit to 3 for speed)
            const torrentLinks = [];
            resultRows.each((i, el) => {
                if (torrentLinks.length >= 3) return; // Max 3 valid pages to keep it fast
                const nameEl = $(el).find('td.name a').eq(1);
                const href = nameEl.attr('href');
                const name = nameEl.text().trim();
                const seeders = $(el).find('td.seeds').text().trim();
                const size = $(el).find('td.size').text().replace(/[\n\r]/g, '').trim();
                
                if (href && parseInt(seeders) > 0 && this._isTitleMatch(name, title, year)) {
                    torrentLinks.push({ href: `https://1337x.to${href}`, name, seeders, size });
                }
            });
            
            if (torrentLinks.length === 0) return null;
            
            // Fetch magnet from each torrent page in parallel
            const magnetPromises = torrentLinks.map(async (t) => {
                try {
                    const pageRes = await axios.get(t.href, {
                        headers: { 'User-Agent': 'Mozilla/5.0' },
                        timeout: 8000
                    });
                    const $$ = cheerio.load(pageRes.data);
                    const magnet = $$('a[href^="magnet:"]').first().attr('href');
                    if (magnet) {
                        return { ...t, magnet };
                    }
                } catch { /* skip this torrent */ }
                return null;
            });
            
            const magnetResults = (await Promise.allSettled(magnetPromises))
                .filter(r => r.status === 'fulfilled' && r.value)
                .map(r => r.value);
            
            for (const torrent of magnetResults) {
                const q = this._detectQuality(torrent.name) || 'other';
                if (!qualities[q]) qualities[q] = [];
                const linkObj = {
                    url: torrent.magnet,
                    name: `1337x: ${torrent.name} [${torrent.size}] [${torrent.seeders} seeds]`,
                    type: 'magnet',
                    size: torrent.size
                };
                qualities[q].push(linkObj);
                links.magnet.push(linkObj);
                this.stats.torrentLinks++;
            }
            
            if (links.magnet.length > 0) {
                this.logger.info(`✅ [1337x] Found ${links.magnet.length} magnet links`);
                return { title: magnetResults[0].name, qualities, links };
            }
        } catch (e) {
            this.logger.warn(`1337x search failed: ${e.message}`);
        }
        return null;
    }

    /**
     * EZTV — JSON API for TV show torrents. Great for episode-specific results.
     * API: https://eztv.re/api/get-torrents?imdb_id=XXXXX
     */
    async _searchEZTV(title, year, tvInfo = {}) {
        try {
            const { type, season, episode, tmdbId } = tvInfo;
            if (type !== 'tv') return null; // EZTV is TV-only
            
            this.logger.info(`🔍 Searching EZTV...`);
            
            // First get IMDb ID from TMDb
            let finalTmdbId = tmdbId;
            if (!finalTmdbId) {
                const tmdbResult = await this._getTmdbId(title, year, 'tv');
                if (!tmdbResult) return null;
                finalTmdbId = tmdbResult.tmdbId;
            }
            
            // Get IMDb ID from TMDb
            let imdbId = null;
            try {
                const tmdbRes = await axios.get(
                    `https://api.themoviedb.org/3/tv/${finalTmdbId}/external_ids?api_key=${TMDB_API_KEY}`,
                    { timeout: 8000 }
                );
                imdbId = tmdbRes.data?.imdb_id;
            } catch { /* skip */ }
            
            if (!imdbId) return null;
            
            // Strip 'tt' prefix for EZTV API
            const imdbNum = imdbId.replace('tt', '');
            const eztvUrl = `https://eztv.re/api/get-torrents?imdb_id=${imdbNum}&limit=30`;
            
            const response = await axios.get(eztvUrl, { timeout: 12000 });
            
            if (!response.data?.torrents || response.data.torrents.length === 0) return null;
            
            const qualities = {};
            const links = { direct: [], magnet: [], torrent: [] };
            
            // Filter for the requested season/episode
            let filteredTorrents = response.data.torrents;
            if (season) {
                filteredTorrents = filteredTorrents.filter(t => {
                    return t.season === String(season) || t.season === season;
                });
                if (episode) {
                    filteredTorrents = filteredTorrents.filter(t => {
                        return t.episode === String(episode) || t.episode === episode;
                    });
                }
            }
            
            // Filter by title match and take top 5
            const topResults = filteredTorrents
                .filter(t => this._isTitleMatch(t.title, title, year) && parseInt(t.seeds) > 0)
                .slice(0, 5);
                
            if (topResults.length === 0) return null;
            
            for (const torrent of topResults) {
                const magnet = torrent.magnet_url;
                if (!magnet) continue;
                
                const size = this._formatBytes(parseInt(torrent.size_bytes || 0));
                const q = this._detectQuality(torrent.title) || 'other';
                
                if (!qualities[q]) qualities[q] = [];
                const linkObj = {
                    url: magnet,
                    name: `EZTV: ${torrent.title} [${size}] [${torrent.seeds} seeds]`,
                    type: 'magnet',
                    size: size
                };
                qualities[q].push(linkObj);
                links.magnet.push(linkObj);
                this.stats.torrentLinks++;
            }
            
            if (links.magnet.length > 0) {
                this.logger.info(`✅ [EZTV] Found ${links.magnet.length} TV magnet links`);
                return { title: topResults[0].title, qualities, links };
            }
        } catch (e) {
            this.logger.warn(`EZTV search failed: ${e.message}`);
        }
        return null;
    }

    async _searchGenericTypesense(title, year, name, baseUrl) {
        try {
            this.logger.info(`🔍 Searching ${name}...`);
            const today = new Date().toISOString().split('T')[0];
            const query = year ? `${title} ${year}` : title;
            const apiUrl = "https://search.pingora.fyi/collections/post/documents/search";
            
            const response = await axios.get(apiUrl, {
                params: {
                    q: query,
                    query_by: 'post_title,category,stars,director,imdb_id',
                    query_by_weights: '4,2,2,2,4',
                    sort_by: 'sort_by_date:desc',
                    limit: 3,
                    highlight_fields: 'none',
                    use_cache: 'true',
                    page: 1,
                    analytics_tag: today
                },
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
                    'Accept': 'application/json, text/plain, */*',
                    'Referer': baseUrl,
                    'Origin': new URL(baseUrl).origin
                },
                timeout: 12000
            });

            if (response.data.hits && response.data.hits.length > 0) {
                // Find best hit
                let hit = null;
                for (const h of response.data.hits) {
                    if (this._isTitleMatch(h.document.post_title, title, year)) {
                        hit = h.document;
                        break;
                    }
                }
                
                if (!hit) {
                    this.logger.info(`⚠️ [${name}] No accurate match found in hits`);
                    return null;
                }

                const movieUrl = hit.permalink.startsWith('http') ? hit.permalink : `${baseUrl}${hit.permalink.startsWith('/') ? hit.permalink.slice(1) : hit.permalink}`;
                
                this.logger.info(`📄 [${name}] Found: ${hit.post_title}`);
                const pageRes = await axios.get(movieUrl, {
                    headers: { 'User-Agent': 'Mozilla/5.0' },
                    timeout: 8000
                });
                
                const $ = cheerio.load(pageRes.data);
                const qualities = {};
                const links = { direct: [], magnet: [], torrent: [] };
                
                // Broad patterns for movie sites
                $('a[href*="gdtot"], a[href*="gdflix"], a[href*="hubcloud"], a[href*="filepress"], a[href*="sharer"], a[href*="drive.google"], a[href*="mega"], a[href*="pixeldrain"], a[href*="gofile"], a[href*="mediafire"], a[href*="droplink"], a[href*="v-cloud"], a[href*="hblinks"], a[href*="unblockedgames"], a[href*="modlist.in"], a[href*="kmhd.eu"], a[href*="katmoviehd"], a[href*="driveleech"], a[href*="drivelinks"], a[href*="fastdl"], a[href*="fastlinks"], a[href*="sendcm"], a[href*="buzzheavier"], a[href*="fc2dl"]').each((i, el) => {
                    const href = $(el).attr('href');
                    const text = $(el).text().trim() || $(el).attr('title') || 'Download';
                    if (!href || href.includes('wp-content') || href.includes('facebook.com')) return;
                    
                    let descriptiveName = text;
                    if (descriptiveName.toLowerCase() === 'download' || descriptiveName.toLowerCase() === 'link' || descriptiveName.length < 5) {
                        const parentText = $(el).parent().text().trim();
                        if (parentText && parentText.length > 5) {
                            descriptiveName = parentText.split('\n')[0].substring(0, 150);
                        }
                    }

                    let q = this._detectQuality(text);
                    if (!q) q = this._detectQuality(hit.post_title);
                    if (!q) q = 'other';
                    
                    if (!qualities[q]) qualities[q] = [];
                    
                    const linkObj = {
                        url: href,
                        name: `${name}: ${descriptiveName}`,
                        type: 'direct',
                        size: this._detectSize(text + ' ' + $(el).parent().text() + ' ' + $(el).closest('div').text()),
                        category: this._detectCategory(text + ' ' + hit.post_title + ' ' + href)
                    };
                    
                    if (!qualities[q].some(l => l.url === href)) {
                        qualities[q].push(linkObj);
                        links.direct.push(linkObj);
                        this.stats.directLinks++;
                    }
                });

                if (links.direct.length > 0) {
                    return { title: hit.post_title, qualities, links };
                }
            }
        } catch (e) {
            this.logger.warn(`${name} search failed: ${e.message}`);
        }
        return null;
    }

    async _searchWordpressSite(title, year, name, baseUrl) {
        try {
            this.logger.info(`🔍 Searching ${name}...`);
            // Clean title for WP search (remove dots, dashes)
            const wpQuery = title.replace(/[\.\-_]/g, ' ').replace(/\s+/g, ' ').trim();
            const connector = baseUrl.includes('?') ? '&' : '?';
            const searchUrl = `${baseUrl}${connector}s=${encodeURIComponent(wpQuery)}`;
            
            const response = await axios.get(searchUrl, {
                headers: { 
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
                    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
                    'Accept-Language': 'en-US,en;q=0.9',
                    'Referer': baseUrl,
                    'DNT': '1'
                },
                timeout: 15000
            });

            if (response.data.includes('cf-challenge') || response.data.includes('cf-browser-verification')) {
                this.logger.warn(`⚠️ [${name}] Blocked by Cloudflare challenge`);
                return null;
            }

            const $ = cheerio.load(response.data);
            // Broader selectors for different WP themes
            const results = $('article a, .post-title a, .result-item a, .entry-title a, .entry-header a, .box-inner-p a, h1 a, h2 a, h3 a');
            
            let bestResult = null;
            if (results.length > 0) {
                results.each((i, el) => {
                    const href = $(el).attr('href');
                    if (!href || href === baseUrl || href.length < baseUrl.length + 3) return;

                    const t = ($(el).text() || $(el).attr('title') || '').trim();
                    if (this._isTitleMatch(t, title, year)) {
                        bestResult = { url: href, title: t };
                        return false; 
                    }
                });
            }

            if (bestResult && bestResult.url) {
                this.logger.info(`📄 [${name}] Found: ${bestResult.title}`);
                const pageRes = await axios.get(bestResult.url, {
                    headers: { 
                        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
                        'Referer': searchUrl
                    },
                    timeout: 12000
                });
                
                const $$ = cheerio.load(pageRes.data);
                const qualities = {};
                const links = { direct: [], magnet: [], torrent: [] };
                
                const extractFromPage = async (dom) => {
                    let found = false;
                    const linkEls = [];
                    dom('a[href*="gdtot"], a[href*="gdflix"], a[href*="hubcloud"], a[href*="filepress"], a[href*="sharer"], a[href*="drive.google"], a[href*="mega"], a[href*="pixeldrain"], a[href*="gofile"], a[href*="mediafire"], a[href*="droplink"], a[href*="v-cloud"], a[href*="hblinks"], a[href*="unblockedgames"], a[href*="modlist.in"], a[href*="kmhd.eu"], a[href*="katmoviehd"], a[href*="driveleech"], a[href*="drivelinks"], a[href*="fastdl"], a[href*="fastlinks"], a[href*="sendcm"], a[href*="buzzheavier"], a[href*="fc2dl"]').each((i, el) => {
                        linkEls.push(el);
                    });

                    for (const el of linkEls) {
                        let href = dom(el).attr('href');
                        const text = dom(el).text().trim() || dom(el).attr('title') || 'Download';
                        
                        if (!href || href.includes('google.com/search') || href.includes('wp-content') || href.includes('facebook.com')) continue;
                        
                        // Resolve known shorteners server-side
                        const shortenerPatterns = ['unblockedgames', 'modlist.in', 'kmhd.eu', 'katmoviehd'];
                        if (shortenerPatterns.some(p => href.includes(p))) {
                            this.logger.info(`Resolving shortener: ${href.substring(0, 60)}...`);
                            const resolved = await this._resolveShortener(href);
                            // If still pointing to shortener (CAPTCHA blocked), keep original so user can click manually
                            if (!shortenerPatterns.some(p => resolved.includes(p)) && !resolved.includes('google.com')) {
                                href = resolved;
                            }
                        }

                        let q = this._detectQuality(text);
                        if (!q) q = this._detectQuality(bestResult.title);
                        if (!q) q = 'other';
                        
                        if (!qualities[q]) qualities[q] = [];
                        
                        let descriptiveName = text;
                        if (descriptiveName.toLowerCase() === 'download' || descriptiveName.toLowerCase() === 'link' || descriptiveName.length < 5) {
                            const parentText = dom(el).parent().text().trim();
                            if (parentText && parentText.length > 5) {
                                descriptiveName = parentText.split('\n')[0].substring(0, 150);
                            }
                        }

                        const linkObj = {
                            url: href,
                            name: `${name}: ${descriptiveName}`,
                            type: 'direct',
                            size: this._detectSize(text + ' ' + dom(el).parent().text() + ' ' + dom(el).closest('div').text()),
                            category: this._detectCategory(text + ' ' + bestResult.title + ' ' + href)
                        };
                        
                        if (!qualities[q].some(l => l.url === href)) {
                            qualities[q].push(linkObj);
                            links.direct.push(linkObj);
                            this.stats.directLinks++;
                            found = true;
                        }
                    }
                    return found;
                };

                const foundAny = await extractFromPage($$);


                // If no direct links found, check for a "Download Links" button/page
                if (!foundAny) {
                    const downloadPageLink = $$('a').filter((i, el) => {
                        const text = $$(el).text().toLowerCase();
                        const href = $$(el).attr('href') || '';
                        return (text.includes('download') || text.includes('links')) && 
                               href.includes(new URL(baseUrl).hostname) && 
                               !href.includes('wp-content');
                    }).first().attr('href');

                    if (downloadPageLink) {
                        try {
                            this.logger.info(`🔗 Following download page: ${downloadPageLink}`);
                            const dlPageRes = await axios.get(downloadPageLink, {
                                headers: { 'User-Agent': 'Mozilla/5.0' },
                                timeout: 10000
                            });
                            const $$$ = cheerio.load(dlPageRes.data);
                            await extractFromPage($$$);
                        } catch (e) {
                            this.logger.warn(`Failed to fetch download page: ${e.message}`);
                        }
                    }
                }

                if (links.direct.length > 0) {
                    return { title: bestResult.title, qualities, links };
                }
            }
        } catch (e) {
            this.logger.warn(`${name} search failed: ${e.message}`);
        }
        return null;
    }

    async searchExactMovie(title, year = null, tvInfo = {}) {
        const { type, season, episode } = tvInfo;
        
        let displayTitle = title;
        let searchQuery = title;

        if (type === 'tv' && season) {
            // For TV shows, we usually want "Season X" or "S01E01"
            const sNum = String(season).padStart(2, '0');
            const eNum = episode ? String(episode).padStart(2, '0') : null;
            
            if (episode) {
                searchQuery = `${title} S${sNum}E${eNum}`;
                displayTitle = `${title} - Season ${season} Episode ${episode}`;
            } else {
                searchQuery = `${title} Season ${season}`;
                displayTitle = `${title} - Season ${season}`;
            }
        } else if (year) {
            searchQuery = `${title} ${year}`;
            displayTitle = `${title} (${year})`;
        }

        this.logger.banner();
        this.logger.info(`🎯 MULTI-SOURCE SEARCH: "${displayTitle}"`);
        
        const results = {
            movie: null,
            meta: {
                searchTitle: displayTitle,
                searchYear: year,
                exactMatchFound: false,
                sourcesTried: []
            }
        };

        try {
            const sources = [
                () => type !== 'tv' ? this._searchYTS(title, year) : Promise.resolve(null),
                () => this._searchVidVault(title, year, tvInfo),
                () => this._searchPirateBay(title, year, tvInfo),
                () => this._search1337x(title, year, tvInfo),
                () => type === 'tv' ? this._searchEZTV(title, year, tvInfo) : Promise.resolve(null),
                () => this._searchGenericTypesense(searchQuery, year, "HDHub4u", "https://new7.hdhub4u.fo/?utm=mn1"),
                () => this._searchGenericTypesense(searchQuery, year, "HDHub4u (Alt)", "https://hdhub4u.fo/"),
                () => this._searchWordpressSite(searchQuery, year, "MoviesVerse", "https://moviesmod.org/"),
                () => this._searchWordpressSite(searchQuery, year, "UHDMovies", "https://uhdmovies.pink/"),
                () => this._searchWordpressSite(searchQuery, year, "MoviezFlix", "https://moviezflix.net/"),
                () => this._searchWordpressSite(searchQuery, year, "MoviezFlix (Alt)", "https://moviezflix.pro/"),
                () => this._searchWordpressSite(searchQuery, year, "BollyFlix", "https://bollyflix.re/"),
                () => this._searchWordpressSite(searchQuery, year, "BollyFlix (Alt)", "https://bollyflix.icu/"),
                () => this._searchWordpressSite(searchQuery, year, "OlaMovies", "https://olamovies.app"),
                () => this._searchWordpressSite(searchQuery, year, "OlaMovies (Alt)", "https://olamovies.icu/"),
                () => this._searchWordpressSite(searchQuery, year, "Movies4u", "https://movies4u.ba"),
                () => this._searchWordpressSite(searchQuery, year, "Movies4u (Alt)", "https://movies4u.vg/"),
                () => this._searchWordpressSite(searchQuery, year, "Movie4in", "https://movie4in.com"),
                () => this._searchWordpressSite(searchQuery, year, "VegaMovies", "https://vegamovies.nf"),
                () => this._searchWordpressSite(searchQuery, year, "VegaMovies (Alt)", "https://vegamovies.mx/"),
                () => this._searchWordpressSite(searchQuery, year, "KatMovieHD", "https://new1.katmoviehd.cymru"),
                () => this._searchWordpressSite(searchQuery, year, "KatMovieHD (Alt)", "https://katmoviehd.to/"),
                () => this._searchWordpressSite(searchQuery, year, "WatchAnimeWorld", "https://watchanimeworld.net"),
                () => this._searchWordpressSite(searchQuery, year, "CineVood", "https://cinevood.com/"),
                () => this._searchWordpressSite(searchQuery, year, "DotMovies", "https://dotmovies.men/"),
                () => this._searchWordpressSite(searchQuery, year, "G-DriveMovies", "https://gdrivemovies.net/"),
                () => this._searchWordpressSite(searchQuery, year, "ExtraMovies", "https://extramovies.ink/"),
                () => this._searchWordpressSite(searchQuery, year, "FilmyZilla", "https://filmyzilla.ink/")
            ];

            const sourceResults = [];
            const wrappedPromises = sources.map(async (s, index) => {
                try {
                    const value = await s();
                    sourceResults[index] = { status: 'fulfilled', value };
                } catch (reason) {
                    sourceResults[index] = { status: 'rejected', reason };
                }
            });

            // Increased limit to 35s to allow for deeper extraction on some sites
            await Promise.race([
                Promise.all(wrappedPromises),
                new Promise(resolve => setTimeout(resolve, 35000))
            ]);
            
            let mergedMovie = null;
            const sourceNames = ['YTS', 'VidVault', 'PirateBay', '1337x', 'EZTV', 'HDHub4u', 'MoviesVerse', 'UHDMovies', 'MoviezFlix', 'BollyFlix', 'OlaMovies', 'Movies4u', 'Movie4in', 'VegaMovies', 'KatMovieHD', 'WatchAnimeWorld'];
            
            sourceNames.forEach((name, index) => {
                results.meta.sourcesTried.push(name);
                const res = sourceResults[index];
                
                if (res && res.status === 'fulfilled' && res.value) {
                    mergedMovie = this._mergeResults(mergedMovie, res.value, title);
                }
            });

            if (mergedMovie) {
                results.movie = mergedMovie;
                results.meta.exactMatchFound = true;
                this.stats.moviesFound = 1;
            }

        } catch (err) {
            this.logger.error(`Search error: ${err.message}`);
            this.stats.errors++;
        }

        const elapsed = ((Date.now() - this.stats.startTime) / 1000).toFixed(1);
        this.stats.timeTaken = `${elapsed}s`;
        return results;
    }

    _mergeResults(existing, incoming, originalTitle) {
        if (!existing && !incoming) return null;
        
        // Use existing or create new base
        const merged = existing || {
            title: incoming?.title || originalTitle,
            qualities: {},
            links: { direct: [], magnet: [], torrent: [] },
            totalLinks: 0
        };
        
        if (!incoming) return merged;

        // Merge qualities
        for (const q in incoming.qualities) {
            if (!merged.qualities[q]) merged.qualities[q] = [];
            
            // Add unique links only (check by URL)
            const seenUrls = new Set(merged.qualities[q].map(l => l.url));
            incoming.qualities[q].forEach(link => {
                if (!seenUrls.has(link.url)) {
                    merged.qualities[q].push(link);
                }
            });
        }

        // Merge raw links list
        if (incoming.links) {
            const seenDirect = new Set(merged.links.direct.map(l => l.url));
            (incoming.links.direct || []).forEach(l => { if (!seenDirect.has(l.url)) merged.links.direct.push(l); });
            
            const seenMagnet = new Set(merged.links.magnet.map(l => l.url));
            (incoming.links.magnet || []).forEach(l => { if (!seenMagnet.has(l.url)) merged.links.magnet.push(l); });
            
            const seenTorrent = new Set(merged.links.torrent.map(l => l.url));
            (incoming.links.torrent || []).forEach(l => { if (!seenTorrent.has(l.url)) merged.links.torrent.push(l); });
        }

        // Update total count
        merged.totalLinks = merged.links.direct.length + merged.links.magnet.length + merged.links.torrent.length;
        
        return merged;
    }

    _detectQuality(str) {
        if (!str) return null;
        const s = str.toLowerCase();
        if (/2160p|4k|uhd/i.test(s)) return '4K';
        if (/1080p|fhd/i.test(s)) return '1080p';
        if (/720p|hd/i.test(s) && !/hdhub|katmoviehd/i.test(s)) return '720p';
        if (/480p|sd/i.test(s)) return '480p';
        if (/360p/i.test(s)) return '360p';
        return null;
    }

    _detectSize(str) {
        const match = str.match(/\[(\d+\.?\d*\s*(GB|MB))\]/i);
        return match ? match[1] : null;
    }

    _detectCategory(str) {
        if (!str) return 'episode';
        const s = str.toLowerCase();
        if (/batch|pack|zip|complete|season \d+|s\d+ complete/i.test(s)) return 'batch';
        return 'episode';
    }

    _isTitleMatch(targetTitle, searchTitle, searchYear) {
        if (!targetTitle || !searchTitle) return false;
        
        const getPureTitle = (str) => {
            let clean = str.toLowerCase().replace(/[^a-z0-9]/g, ' ').replace(/\s+/g, ' ').trim();
            // Remove common prefixes
            clean = clean.replace(/^(download|watch|online|full|movie|free|hd)\s+/g, '');
            const words = clean.split(' ');
            const metadataRegex = /^(19\d{2}|20\d{2}|\d{3,4}p|4k|uhd|hd|sd|s\d+|e\d+|season|episode|complete|batch|pack|dual|audio|hindi|english|tamil|telugu|bluray|webrip|web|dl|x264|x265|hevc|aac|mkv|mp4|avi|rip|dvdrip|hdrip|extended|unrated|directors|cut|remastered|part|hdhub4u|vegamovies|katmoviehd|moviesverse|uhdmovies|olamovies|moviesmod|bollyflix|movies4u|movie4in|watchanimeworld|cymru|fo|app|ba|icu|nf)$/i;
            
            let pureWords = [];
            for (let i = 0; i < words.length; i++) {
                const w = words[i];
                if (i === 0 || !metadataRegex.test(w)) {
                    pureWords.push(w);
                } else {
                    break;
                }
            }
            return pureWords.join(' ');
        };

        const pureTarget = getPureTitle(targetTitle);
        const pureSearch = getPureTitle(searchTitle);

        if (pureTarget === pureSearch) return true;
        
        if (pureTarget.includes(pureSearch) || pureSearch.includes(pureTarget)) {
            if (Math.abs(pureTarget.length - pureSearch.length) < 15) {
                return true;
            }
        }
        return false;
    }
}

module.exports = MovieCrawler;
