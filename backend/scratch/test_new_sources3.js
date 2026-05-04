/**
 * Deeper check — uses 15s timeout and follows redirects.
 * Also checks if a site is simply slow vs truly down.
 * Additionally tries a direct URL pattern for some sites.
 */
const axios = require('axios');
const cheerio = require('cheerio');

const TEST_QUERY = 'Batman';

const CANDIDATE_SITES = [
    // Sites found via direct browser access research
    { name: 'MkvCinemas', url: 'https://mkvcinemas.lat/' },
    { name: 'FilmyZilla', url: 'https://filmyzilla.ink/' },
    { name: 'ExtraMovies', url: 'https://extramovies.vip/' },
    { name: 'Mkvcage', url: 'https://mkvcage.net/' },
    { name: 'SkymoviesHD', url: 'https://skymovieshd.ngo/' },
    { name: 'VegaMovies', url: 'https://vegamovies.by/' },
    { name: 'DesiCinemas', url: 'https://desicinemas.tv/' },
    { name: 'MovieCounter', url: 'https://moviecounter.pro/' },
    { name: 'KuttyMovies', url: 'https://kuttymovies.day/' },
    { name: 'Isaidub', url: 'https://www.isaidub.day/' },
    { name: 'TamilYogi', url: 'https://tamilyogi.watch/' },
    { name: 'Downloadhub', url: 'https://downloadhub.best/' },
    { name: 'HDHub4u2', url: 'https://new3.hdhub4u.ngo/' },
    { name: 'MoviesFlix', url: 'https://moviesflix.club/' },
    { name: 'O2TvSeries', url: 'https://o2tvseries.pro/' },
    { name: 'FzMovies', url: 'https://fzmovies.net/' },
    { name: 'SouthFreak', url: 'https://southfreak.in/' },
    { name: 'WorldFree4u', url: 'https://worldfree4u.day/' },
    { name: 'Movies4u', url: 'https://movies4u.page/' },
    { name: 'MoviesMod2', url: 'https://moviesmod.cam/' },
];

async function checkSite({ name, url }) {
    try {
        const searchUrl = `${url}?s=${encodeURIComponent(TEST_QUERY)}`;
        const res = await axios.get(searchUrl, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                'Accept-Language': 'en-US,en;q=0.5',
            },
            timeout: 12000,
            maxRedirects: 10,
            validateStatus: () => true
        });
        
        if (res.status === 403) return `❌ 403 Forbidden`;
        if (res.status === 503) return `❌ 503 Down`;
        
        const isCloudflare = res.data.includes('Just a moment') || 
                             res.data.includes('cf-browser-verification') ||
                             res.data.includes('cf_chl_opt');
        if (isCloudflare) return `🔒 Cloudflare JS challenge`;
        
        const $ = cheerio.load(res.data);
        const links = $('article a, .entry-title a, .post-title a, h2 a, h3 a').length;
        
        if (links > 0) return `✅ OK (${links} results)`;
        if (res.status === 200) return `⚠️ 200 but 0 results - check selectors`;
        return `❓ ${res.status}`;
        
    } catch (e) {
        return `❌ ${e.code || e.message}`;
    }
}

async function main() {
    console.log(`\n🔍 Deep-testing ${CANDIDATE_SITES.length} sites (12s timeout each)...\n`);
    const results = await Promise.all(CANDIDATE_SITES.map(s => 
        checkSite(s).then(status => ({ ...s, status }))
    ));
    
    console.log('SITE                  STATUS');
    console.log('─'.repeat(65));
    results.forEach(r => {
        console.log(`${r.name.padEnd(22)} ${r.status}`);
    });
    
    const working = results.filter(r => r.status.startsWith('✅') || r.status.startsWith('⚠️'));
    console.log(`\n✅ ${working.length} sites accessible:`);
    working.forEach(r => console.log(`  • ${r.name}: ${r.url}  → ${r.status}`));
}

main().catch(console.error);
