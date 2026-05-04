const axios = require('axios');
const cheerio = require('cheerio');

const TEST_QUERY = 'Batman';

// Fresh/new candidate sites with different/updated domains
const CANDIDATE_SITES = [
    // VegaMovies variants
    { name: 'VegaMovies.ngo', url: 'https://vegamovies.ngo/' },
    { name: 'VegaMovies.dad', url: 'https://vegamovies.dad/' },
    { name: 'VegaMovies.mk', url: 'https://vegamovies.mk/' },
    // MkvCinemas variants
    { name: 'MkvCinemas.com', url: 'https://mkvcinemas.com/' },
    { name: 'MkvCinemas.one', url: 'https://mkvcinemas.one/' },
    { name: 'MkvHub.com', url: 'https://mkvhub.com/' },
    // Indian focus
    { name: 'Bolly4u', url: 'https://bolly4u.ngo/' },
    { name: 'Bolly4u2', url: 'https://bolly4u.ist/' },
    { name: 'SkyMoviesHD', url: 'https://skymovieshd.ngo/' },
    { name: 'FilmyZilla', url: 'https://filmyzilla.lat/' },
    { name: 'FilmyFly', url: 'https://www.filmyfly.cc/' },
    // Multi language
    { name: 'HindiLinks4u', url: 'https://hindilinks4u.one/' },
    { name: 'DotMovies.day', url: 'https://dotmovies.day/' },
    { name: 'DotMovies.pics', url: 'https://dotmovies.pics/' },
    { name: 'CineVoodFlix', url: 'https://cinevoodflix.com/' },
    { name: 'YomoviesHD', url: 'https://yomovies.stream/' },
    { name: 'HDMovies4u', url: 'https://www.hdmovies4u.men/' },
    { name: 'Index-of-movies', url: 'https://index-of-movies.co/' },
    { name: 'GoMovies.run', url: 'https://gomovies.run/' },
    { name: 'mkvcage', url: 'https://mkvcage.ws/' },
];

async function checkSite(name, url) {
    try {
        const searchUrl = `${url}?s=${encodeURIComponent(TEST_QUERY)}`;
        const res = await axios.get(searchUrl, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/121.0.0.0 Safari/537.36',
            },
            timeout: 8000,
            validateStatus: () => true
        });
        
        if (res.status === 403 || res.status === 503 || res.status === 429) {
            return { name, url, status: `❌ ${res.status} Blocked` };
        }
        if (res.data.includes('cf-challenge') || res.data.includes('cf_chl') || res.data.includes('Just a moment')) {
            return { name, url, status: '🔒 Cloudflare block' };
        }
        
        const $ = cheerio.load(res.data);
        const links = $('article a, .entry-title a, .post-title a, h2 a, h3 a').length;
        
        if (links > 0) {
            return { name, url, status: `✅ OK (${links} results)` };
        } else if (res.status === 200) {
            return { name, url, status: `⚠️ 200 but 0 results` };
        }
        return { name, url, status: `❌ ${res.status}` };
    } catch (e) {
        return { name, url, status: `❌ ${e.code || e.message}` };
    }
}

async function main() {
    console.log(`\n🔍 Testing ${CANDIDATE_SITES.length} candidate sites...\n`);
    const checks = CANDIDATE_SITES.map(s => checkSite(s.name, s.url));
    const results = await Promise.all(checks);
    
    console.log('SITE                  STATUS');
    console.log('─'.repeat(60));
    results.forEach(r => {
        console.log(`${r.name.padEnd(22)} ${r.status}`);
    });
    
    const working = results.filter(r => r.status.startsWith('✅'));
    console.log(`\n✅ ${working.length} sites working:`);
    working.forEach(r => console.log(`  • ${r.name}: ${r.url}`));
}

main().catch(console.error);
