const axios = require('axios');
const cheerio = require('cheerio');

async function testRedirect() {
    try {
        const url = 'https://cloud.unblockedgames.world/?sid=aDBQeDhZNVBsY1I5cVlWUzJJM1pva29KaHpRSlVFekV3QkFFK1FHRW9Wbz0=';
        console.log(`Fetching: ${url}`);
        const res = await axios.get(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36'
            }
        });
        
        console.log(`Status: ${res.status}`);
        const $ = cheerio.load(res.data);
        
        console.log("--- Meta Refreshes ---");
        $('meta[http-equiv="refresh"]').each((i, el) => {
            console.log($(el).attr('content'));
        });
        
        console.log("--- Forms ---");
        $('form').each((i, el) => {
            console.log(`Form action: ${$(el).attr('action')}`);
        });

        console.log("--- Links ---");
        $('a').each((i, el) => {
            const href = $(el).attr('href');
            if (href && !href.startsWith('#')) {
                console.log(`Link: ${$(el).text().trim()} -> ${href}`);
            }
        });
        
        // Match typical base64 redirect patterns in scripts
        const scriptMatch = res.data.match(/window\.location\.href\s*=\s*['"]([^'"]+)['"]/);
        if (scriptMatch) {
            console.log(`Script redirect found: ${scriptMatch[1]}`);
        }
        
    } catch (e) {
        console.error(`Error: ${e.message}`);
    }
}

testRedirect();
