const axios = require('axios');

const NEW_DOMAINS = [
    { name: 'VegaMovies', url: 'https://vegamovies.pk/' },
    { name: 'VegaMovies2', url: 'https://vegamovies.to/' },
    { name: 'MoviesMod', url: 'https://moviesmod.com/' },
    { name: 'MoviezFlix', url: 'https://moviezflix.net/' },
    { name: 'BollyFlix', url: 'https://bollyflix.re/' },
    { name: 'OlaMovies', url: 'https://olamovies.vip/' },
    { name: 'KatMovieHD', url: 'https://katmoviehd.io/' },
    { name: 'MoviesMod.org', url: 'https://moviesmod.org/' }
];

async function checkStatus(name, url) {
    try {
        const res = await axios.get(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
            },
            timeout: 8000,
            validateStatus: () => true
        });
        
        const finalUrl = res.request.res.responseUrl || url;
        return { name, url, finalUrl, status: `✅ ${res.status}` };
    } catch (e) {
        return { name, url, finalUrl: null, status: `❌ ${e.code || e.message}` };
    }
}

async function main() {
    console.log(`\n🔍 Checking new domains...\n`);
    const results = await Promise.all(NEW_DOMAINS.map(s => checkStatus(s.name, s.url)));
    
    console.log('NAME'.padEnd(20) + 'ORIGINAL'.padEnd(35) + 'FINAL/REDIRECT'.padEnd(35) + 'STATUS');
    console.log('─'.repeat(110));
    results.forEach(r => {
        console.log(`${r.name.padEnd(20)} ${r.url.padEnd(35)} ${(r.finalUrl || 'N/A').padEnd(35)} ${r.status}`);
    });
}

main().catch(console.error);
