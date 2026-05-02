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
    async searchExactMovie(title, year = null) {
        this.logger.banner();
        this.logger.info(`🎯 LIGHTWEIGHT SEARCH: "${title}" ${year ? `(${year})` : ''}`);
        
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
            // Source 1: YTS API (Global Movies)
            const ytsResult = await this._searchYTS(title, year);
            results.meta.sourcesTried.push('YTS');
            
            // Source 2: HDHub4u API + Scraper (Indian/Hindi Movies)
            const hdhubResult = await this._searchHDHub4u(title, year);
            results.meta.sourcesTried.push('HDHub4u');

            // Merge results
            const mergedMovie = this._mergeResults(ytsResult, hdhubResult, title);
            
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
        this.logger.info(`🏁 Search completed in ${elapsed}s`);
        
        return results;
    }

    async _searchYTS(title, year) {
        try {
            this.logger.info(`🔍 Searching YTS...`);
            const query = year ? `${title} ${year}` : title;
            const url = `https://yts.mx/api/v2/list_movies.json?query_term=${encodeURIComponent(query)}&limit=5`;
            const response = await axios.get(url, { timeout: 10000 });
            
            if (response.data.status === 'ok' && response.data.data.movie_count > 0) {
                // Find best match by year
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
                    
                    return {
                        title: match.title,
                        qualities,
                        links
                    };
                }
            }
        } catch (e) {
            this.logger.warn(`YTS search failed: ${e.message}`);
        }
        return null;
    }

    async _searchHDHub4u(title, year) {
        try {
            this.logger.info(`🔍 Searching HDHub4u...`);
            const today = new Date().toISOString().split('T')[0];
            const query = year ? `${title} ${year}` : title;
            const apiUrl = "https://search.pingora.fyi/collections/post/documents/search";
            
            const response = await axios.get(apiUrl, {
                params: {
                    q: query,
                    query_by: 'post_title,category,stars,director,imdb_id',
                    query_by_weights: '4,2,2,2,4',
                    sort_by: 'sort_by_date:desc',
                    limit: 5,
                    highlight_fields: 'none',
                    use_cache: 'true',
                    page: 1,
                    analytics_tag: today
                },
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                    'Referer': 'https://new7.hdhub4u.fo/',
                    'Origin': 'https://new7.hdhub4u.fo'
                },
                timeout: 10000
            });

            if (response.data.hits && response.data.hits.length > 0) {
                // Find best match (simple title check)
                const hit = response.data.hits[0].document;
                const movieUrl = hit.permalink.startsWith('http') ? hit.permalink : `https://new7.hdhub4u.fo${hit.permalink}`;
                
                this.logger.info(`📄 Found movie page: ${hit.post_title}`);
                const pageRes = await axios.get(movieUrl, {
                    headers: { 'User-Agent': 'Mozilla/5.0' },
                    timeout: 10000
                });
                
                const $ = cheerio.load(pageRes.data);
                const qualities = {};
                const links = { direct: [], magnet: [], torrent: [] };
                
                // Specific HDHub4u pattern for download links
                $('a[href*="hblinks"], a[href*="gdtot"], a[href*="gdflix"], a[href*="hubcloud"]').each((i, el) => {
                    const href = $(el).attr('href');
                    const text = $(el).text().trim();
                    if (!href) return;
                    
                    const q = this._detectQuality(text + ' ' + hit.post_title) || 'other';
                    if (!qualities[q]) qualities[q] = [];
                    
                    const linkObj = {
                        url: href,
                        name: text || hit.post_title,
                        type: 'direct',
                        size: this._detectSize(text)
                    };
                    
                    qualities[q].push(linkObj);
                    links.direct.push(linkObj);
                    this.stats.directLinks++;
                });

                if (links.direct.length > 0) {
                    return {
                        title: hit.post_title,
                        qualities,
                        links
                    };
                }
            }
        } catch (e) {
            this.logger.warn(`HDHub4u search failed: ${e.message}`);
        }
        return null;
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
