const axios = require('axios');
const cheerio = require('cheerio');
const { Logger } = require('./logger');

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
                const movies = response.data.data.movies;
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
                    'Origin': baseUrl.slice(0, -1)
                },
                timeout: 12000
            });

            if (response.data.hits && response.data.hits.length > 0) {
                const hit = response.data.hits[0].document;
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
                $('a[href*="hblinks"], a[href*="gdtot"], a[href*="gdflix"], a[href*="hubcloud"], a[href*="v-cloud"], a[href*="fastdl"], a[href*="mediafire"]').each((i, el) => {
                    const href = $(el).attr('href');
                    const text = $(el).text().trim() || $(el).attr('title') || 'Download';
                    if (!href || href.includes('wp-content')) return;
                    
                    // Prioritize detecting quality from the button text first
                    let q = this._detectQuality(text);
                    if (!q) q = this._detectQuality(hit.post_title);
                    if (!q) q = 'other';
                    
                    if (!qualities[q]) qualities[q] = [];
                    
                    const linkObj = {
                        url: href,
                        name: `${name}: ${text}`,
                        type: 'direct',
                        size: this._detectSize(text + ' ' + $(el).parent().text())
                    };
                    
                    qualities[q].push(linkObj);
                    links.direct.push(linkObj);
                    this.stats.directLinks++;
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
            const query = year ? `${title} ${year}` : title;
            const searchUrl = `${baseUrl}?s=${encodeURIComponent(query)}`;
            
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

            const $ = cheerio.load(response.data);
            // Try different selectors for different WP themes
            const results = $('article h2 a, .post-title a, .result-item a, .entry-title a, .entry-header h2 a');
            
            let bestResult = null;
            if (results.length > 0) {
                // Find the best title match
                results.each((i, el) => {
                    const t = $(el).text().trim().toLowerCase();
                    if (t.includes(title.toLowerCase())) {
                        bestResult = { url: $(el).attr('href'), title: $(el).text().trim() };
                        return false; // Break loop
                    }
                });
                
                // Fallback to first result if no "best" match found but we have results
                if (!bestResult) bestResult = { url: results.first().attr('href'), title: results.first().text().trim() };
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
                
                // Broad patterns for download buttons and links
                $$('a[href*="gdtot"], a[href*="gdflix"], a[href*="hubcloud"], a[href*="filepress"], a[href*="sharer"], a[href*="drive"], a[href*="mega"], a[href*="pixeldrain"], a[href*="gofile"], a[href*="mediafire"], a[href*="droplink"], a[href*="v-cloud"]').each((i, el) => {
                    const href = $$(el).attr('href');
                    const text = $$(el).text().trim() || $$(el).attr('title') || 'Download';
                    
                    if (!href || href.includes('google.com/search') || href.includes('wp-content') || href.includes('facebook.com')) return;
                    
                    let q = this._detectQuality(text);
                    if (!q) q = this._detectQuality(bestResult.title);
                    if (!q) q = 'other';
                    
                    if (!qualities[q]) qualities[q] = [];
                    
                    const linkObj = {
                        url: href,
                        name: `${name}: ${text}`,
                        type: 'direct',
                        size: this._detectSize(text + ' ' + $$(el).parent().text() + ' ' + $$(el).closest('div').text())
                    };
                    
                    // Avoid duplicates from the same source link
                    if (!qualities[q].some(l => l.url === href)) {
                        qualities[q].push(linkObj);
                        links.direct.push(linkObj);
                        this.stats.directLinks++;
                    }
                });

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
                () => this._searchGenericTypesense(searchQuery, year, "HDHub4u", "https://new7.hdhub4u.fo/"),
                () => this._searchWordpressSite(searchQuery, year, "OlaMovies", "https://olamovies.app/"),
                () => this._searchWordpressSite(searchQuery, year, "Movies4u", "https://movies4u.ba/"),
                () => this._searchWordpressSite(searchQuery, year, "Movie4in", "https://movie4in.com/"),
                () => this._searchWordpressSite(searchQuery, year, "VegaMovies", "https://vegamovies.nf/"),
                () => this._searchWordpressSite(searchQuery, year, "KatMovieHD", "https://new1.katmoviehd.cymru/"),
                () => this._searchWordpressSite(searchQuery, year, "WatchAnimeWorld", "https://watchanimeworld.net/")
            ];

            const sourceResults = await Promise.allSettled(sources.map(s => s()));
            
            let mergedMovie = null;
            const sourceNames = ['YTS', 'HDHub4u', 'OlaMovies', 'Movies4u', 'Movie4in', 'VegaMovies', 'KatMovieHD', 'WatchAnimeWorld'];
            
            sourceResults.forEach((res, index) => {
                results.meta.sourcesTried.push(sourceNames[index]);
                
                if (res.status === 'fulfilled' && res.value) {
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
}

module.exports = MovieCrawler;
