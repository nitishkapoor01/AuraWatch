const axios = require('axios');

const EXISTING_DOMAINS = [
    { name: 'HDHub4u', url: 'https://new7.hdhub4u.fo/' },
    { name: 'MoviesMod', url: 'https://moviesmod.org/' },
    { name: 'UHDMovies', url: 'https://uhdmovies.pink/' },
    { name: 'MoviezFlix', url: 'https://moviezflix.pro/' },
    { name: 'BollyFlix', url: 'https://bollyflix.icu/' },
    { name: 'OlaMovies', url: 'https://olamovies.icu/' },
    { name: 'Movies4u', url: 'https://movies4u.ba/' },
    { name: 'Movie4in', url: 'https://movie4in.com/' },
    { name: 'VegaMovies', url: 'https://vegamovies.ngo/' },
    { name: 'KatMovieHD', url: 'https://katmoviehd.nz/' },
    { name: 'WatchAnimeWorld', url: 'https://watchanimeworld.net/' }
];

async function checkRedirect(name, url) {
    try {
        const res = await axios.get(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
            },
            timeout: 10000,
            maxRedirects: 5,
            validateStatus: () => true
        });
        
        const finalUrl = res.request.res.responseUrl || url;
        if (res.status === 200) {
            return { name, url, finalUrl, status: `✅ 200 OK` };
        } else {
            return { name, url, finalUrl, status: `❌ ${res.status}` };
        }
    } catch (e) {
        return { name, url, finalUrl: null, status: `❌ ${e.code || e.message}` };
    }
}

async function main() {
    console.log(`\n🔍 Checking existing domains for redirects...\n`);
    const results = await Promise.all(EXISTING_DOMAINS.map(s => checkRedirect(s.name, s.url)));
    
    console.log('NAME'.padEnd(20) + 'ORIGINAL'.padEnd(35) + 'FINAL/REDIRECT'.padEnd(35) + 'STATUS');
    console.log('─'.repeat(110));
    results.forEach(r => {
        console.log(`${r.name.padEnd(20)} ${r.url.padEnd(35)} ${(r.finalUrl || 'N/A').padEnd(35)} ${r.status}`);
    });
}

main().catch(console.error);
