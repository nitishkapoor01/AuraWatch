const axios = require('axios');
const cheerio = require('cheerio');

async function test() {
    try {
        const url = "https://uhdmovies.pink/download-batman-ninja-vs-yakuza-league-2025-english-audio-2160p-4k-1080p-x264-hevc-web-dl-esubs/";
        console.log(`Fetching ${url}`);
        const res = await axios.get(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36'
            }
        });
        const $ = cheerio.load(res.data);
        console.log("--- ALL LINKS ---");
        $('a').each((i, el) => {
            const href = $(el).attr('href');
            const text = $(el).text().trim();
            if (href && !href.startsWith('/') && !href.includes('wp-content') && !href.includes('uhdmovies')) {
                console.log(`Text: ${text.substring(0, 30)} | Href: ${href}`);
            }
        });
    } catch (e) {
        console.error("Error:", e.message);
    }
}
test();
