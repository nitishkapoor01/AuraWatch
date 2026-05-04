const axios = require('axios');
const cheerio = require('cheerio');

const TEST_QUERY = 'Batman';

const CANDIDATE_SITES = [
    { name: 'FilmyZilla', url: 'https://filmyzilla.com.co/' },
    { name: 'MkvCinemas', url: 'https://mkvcinemas.com.biz/' },
    { name: 'DotMovies', url: 'https://dotmovies.pe/' },
    { name: 'MoviesDa', url: 'https://moviesda.rest/' },
    { name: 'MLwBD', url: 'https://mlwbd.best/' },
    { name: 'CineVood', url: 'https://cinevood.today/' },
    { name: 'TamilBlasters', url: 'https://tamilblasters.uno/' },
    { name: 'FilmyWap', url: 'https://www.filmy4wap.app/' },
    { name: 'MoviesMod', url: 'https://moviesmod.com/' },
    { name: 'HDMoviesHub', url: 'https://hdmovieshub.best/' },
    { name: 'PahlePhir', url: 'https://www.pahlepileseriyon.com/' },
    { name: 'SkymoviesHD', url: 'https://www.skymovieshd.photos/' },
    { name: 'Filmy4wap', url: 'https://filmy4wap.site/' },
    { name: 'GDrivePlayer', url: 'https://gdrivefilms.com/' },
    { name: 'ExtraMovies', url: 'https://extramovies.plus/' },
    { name: 'FilmyFly', url: 'https://www.filmyfly.world/' },
    { name: 'VegaMovies2', url: 'https://vegamovies.re/' },
    { name: 'KatMovieHD2', url: 'https://katmoviehd.to/' },
    { name: 'NewHDMovies4u', url: 'https://newhdmovies4u.com/' },
    { name: 'MLSBD', url: 'https://mlsbd.shop/' },
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
        if (res.data.includes('cf-challenge') || res.data.includes('cf_chl')) {
            return { name, url, status: '🔒 Cloudflare block' };
        }
        
        const $ = cheerio.load(res.data);
        const links = $('article a, .entry-title a, .post-title a, h2 a, h3 a').length;
        
        if (links > 0) {
            return { name, url, status: `✅ OK (${links} results)` };
        } else if (res.status === 200) {
            return { name, url, status: `⚠️ 200 but 0 results (different selector?)` };
        }
        return { name, url, status: `❌ ${res.status}` };
    } catch (e) {
        return { name, url, status: `❌ Error: ${e.code || e.message}` };
    }
}

async function main() {
    console.log(`\n🔍 Testing ${CANDIDATE_SITES.length} candidate sites for "${TEST_QUERY}"...\n`);
    const checks = CANDIDATE_SITES.map(s => checkSite(s.name, s.url));
    const results = await Promise.all(checks);
    
    console.log('SITE                  STATUS');
    console.log('─'.repeat(60));
    results.forEach(r => {
        console.log(`${r.name.padEnd(22)} ${r.status}`);
    });
    
    const working = results.filter(r => r.status.startsWith('✅'));
    console.log(`\n✅ ${working.length} sites are working and ready to add!`);
}

main().catch(console.error);
