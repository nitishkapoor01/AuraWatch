/**
 * Detailed test to see exactly what URL the crawler picks for a search
 * and what links it finds on that page.
 */
const axios = require('axios');
const cheerio = require('cheerio');

const MOVIE_TITLE = 'Batman Ninja vs Yakuza League';
const MOVIE_YEAR = 2025;
const BASE_URL = 'https://uhdmovies.pink/';

async function run() {
    const wpQuery = MOVIE_TITLE.replace(/[.\-_]/g, ' ').replace(/\s+/g, ' ').trim();
    const searchUrl = `${BASE_URL}?s=${encodeURIComponent(wpQuery)}`;
    console.log(`Searching: ${searchUrl}`);
    
    const response = await axios.get(searchUrl, {
        headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
            'Referer': BASE_URL,
        },
        timeout: 15000
    });
    
    const $ = cheerio.load(response.data);
    const results = $('article a, .post-title a, .result-item a, .entry-title a, .entry-header a, .box-inner-p a, h1 a, h2 a, h3 a');
    
    console.log(`\n--- Found ${results.length} search result links ---`);
    results.each((i, el) => {
        const href = $(el).attr('href') || '';
        const t = ($(el).text() || $(el).attr('title') || '').trim();
        if (href && href !== BASE_URL && href.length > BASE_URL.length + 3) {
            console.log(`[${i}] Title: "${t.substring(0, 80)}" | URL: ${href}`);
        }
    });
    
    // Simulate the title-match filter
    function isTitleMatch(found, expected, year) {
        if (!found) return false;
        const normalize = s => s.toLowerCase().replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();
        const f = normalize(found);
        const e = normalize(expected);
        const words = e.split(' ').filter(w => w.length > 2);
        const matchCount = words.filter(w => f.includes(w)).length;
        if (year && f.includes(String(year))) return matchCount >= Math.ceil(words.length * 0.5);
        return matchCount >= Math.ceil(words.length * 0.7);
    }
    
    console.log(`\n--- Matching against: "${MOVIE_TITLE}" (${MOVIE_YEAR}) ---`);
    results.each((i, el) => {
        const href = $(el).attr('href') || '';
        const t = ($(el).text() || $(el).attr('title') || '').trim();
        if (href && href !== BASE_URL && href.length > BASE_URL.length + 3 && t) {
            const match = isTitleMatch(t, MOVIE_TITLE, MOVIE_YEAR);
            console.log(`[${match ? '✅' : '❌'}] "${t.substring(0, 80)}"`);
        }
    });
}

run().catch(e => console.error('Error:', e.message));
