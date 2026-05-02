const axios = require('axios');

class LinkResolver {
    constructor() {
        this.cache = new Map();
    }

    /**
     * Resolves a shortened link to its final destination.
     * @param {string} url - The URL to resolve.
     * @returns {Promise<string>} - The final destination URL.
     */
    async resolve(url) {
        if (this.cache.has(url)) {
            return this.cache.get(url);
        }

        try {
            // Using HEAD request first to be efficient
            const response = await axios.head(url, {
                maxRedirects: 5,
                timeout: 5000,
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
                }
            });
            const finalUrl = response.request.res.responseUrl || url;
            this.cache.set(url, finalUrl);
            return finalUrl;
        } catch (error) {
            // Fallback to GET if HEAD is not supported by the server
            try {
                const response = await axios.get(url, {
                    maxRedirects: 5,
                    timeout: 5000,
                    headers: {
                        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
                    }
                });
                const finalUrl = response.request.res.responseUrl || url;
                this.cache.set(url, finalUrl);
                return finalUrl;
            } catch (innerError) {
                // If it fails, just return the original URL
                return url;
            }
        }
    }

    /**
     * Checks if a URL is likely a shortened link.
     * @param {string} url - The URL to check.
     * @returns {boolean}
     */
    isShortLink(url) {
        const shorteners = [
            'bit.ly', 't.co', 'goo.gl', 'tinyurl.com', 'is.gd', 'buff.ly', 
            'adf.ly', 'bit.do', 'mcaf.ee', 'su.pr', 'ow.ly'
        ];
        try {
            const domain = new URL(url).hostname.replace('www.', '');
            return shorteners.includes(domain);
        } catch (e) {
            return false;
        }
    }
}

module.exports = new LinkResolver();
