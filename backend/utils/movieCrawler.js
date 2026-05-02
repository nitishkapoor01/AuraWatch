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

    async _searchHDHub4u(title, year) {
        return this._searchGenericTypesense(title, year, "HDHub4u", "https://new7.hdhub4u.fo/");
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
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                    'Referer': baseUrl,
                    'Origin': baseUrl.slice(0, -1)
                },
                timeout: 10000
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
                $('a[href*="hblinks"], a[href*="gdtot"], a[href*="gdflix"], a[href*="hubcloud"], a[href*="v-cloud"], a[href*="fastdl"]').each((i, el) => {
                    const href = $(el).attr('href');
                    const text = $(el).text().trim() || $(el).attr('title') || 'Download';
                    if (!href || href.includes('wp-content')) return;
                    
                    const q = this._detectQuality(text + ' ' + hit.post_title) || 'other';
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
                headers: { 'User-Agent': 'Mozilla/5.0' },
                timeout: 10000
            });

            const $ = cheerio.load(response.data);
            const firstResult = $('article h2 a, .post-title a, .result-item a').first();
            const movieUrl = firstResult.attr('href');
            const movieTitle = firstResult.text().trim();

            if (movieUrl) {
                this.logger.info(`📄 [${name}] Found: ${movieTitle}`);
                const pageRes = await axios.get(movieUrl, {
                    headers: { 'User-Agent': 'Mozilla/5.0' },
                    timeout: 8000
                });
                
                const $$ = cheerio.load(pageRes.data);
                const qualities = {};
                const links = { direct: [], magnet: [], torrent: [] };
                
                $$('a[href*="gdtot"], a[href*="gdflix"], a[href*="hubcloud"], a[href*="filepress"], a[href*="sharer"], a[href*="drive"]').each((i, el) => {
                    const href = $$(el).attr('href');
                    const text = $$(el).text().trim() || $$(el).attr('title') || 'Download';
                    if (!href || href.includes('google.com/search') || href.includes('wp-content')) return;
                    
                    const q = this._detectQuality(text + ' ' + movieTitle) || 'other';
                    if (!qualities[q]) qualities[q] = [];
                    
                    const linkObj = {
                        url: href,
                        name: `${name}: ${text}`,
                        type: 'direct',
                        size: this._detectSize(text + ' ' + $$(el).parent().text())
                    };
                    
                    qualities[q].push(linkObj);
                    links.direct.push(linkObj);
                    this.stats.directLinks++;
                });

                if (links.direct.length > 0) {
                    return { title: movieTitle, qualities, links };
                }
            }
        } catch (e) {
            this.logger.warn(`${name} search failed: ${e.message}`);
        }
        return null;
    }

    async searchExactMovie(title, year = null) {
        this.logger.banner();
        this.logger.info(`🎯 MULTI-SOURCE SEARCH: "${title}" ${year ? `(${year})` : ''}`);
        
        const results = {
            movie: null,
            meta: {
                searchTitle: title,
                searchYear: year,
                exactMatchFound: false,
                sourcesTried: []
            }
        };

        try {
            const sources = [
                () => this._searchYTS(title, year),
                () => this._searchHDHub4u(title, year),
                () => this._searchWordpressSite(title, year, "OlaMovies", "https://olamovies.homes/"),
                () => this._searchWordpressSite(title, year, "VegaMovies", "https://vegamovies.nf/"),
                () => this._searchWordpressSite(title, year, "KatMovieHD", "https://katmoviehd.cymru/")
            ];

            const sourceResults = await Promise.allSettled(sources.map(s => s()));
            
            let mergedMovie = null;
            sourceResults.forEach((res, index) => {
                const sourceNames = ['YTS', 'HDHub4u', 'OlaMovies', 'VegaMovies', 'KatMovieHD'];
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

    _mergeResults(yts, hdhub, originalTitle) {
        if (!yts && !hdhub) return null;
        
        const merged = {
            title: yts?.title || hdhub?.title || originalTitle,
            qualities: {},
            links: { direct: [], magnet: [], torrent: [] }
        };

        const addResults = (res) => {
            if (!res) return;
            // Merge qualities
            for (const q in res.qualities) {
                if (!merged.qualities[q]) merged.qualities[q] = [];
                merged.qualities[q].push(...res.qualities[q]);
            }
            // Merge links
            merged.links.direct.push(...(res.links.direct || []));
            merged.links.magnet.push(...(res.links.magnet || []));
            merged.links.torrent.push(...(res.links.torrent || []));
        };

        addResults(yts);
        addResults(hdhub);

        // Calculate total links
        merged.totalLinks = merged.links.direct.length + merged.links.magnet.length + merged.links.torrent.length;
        
        return merged;
    }

    _detectQuality(str) {
        const s = str.toLowerCase();
        if (/2160p|4k/i.test(s)) return '4K';
        if (/1080p/i.test(s)) return '1080p';
        if (/720p/i.test(s)) return '720p';
        if (/480p/i.test(s)) return '480p';
        return null;
    }

    _detectSize(str) {
        const match = str.match(/\[(\d+\.?\d*\s*(GB|MB))\]/i);
        return match ? match[1] : null;
    }
}

module.exports = MovieCrawler;
