const axios = require('axios');
const cheerio = require('cheerio');

async function testDirectAccess() {
    try {
        const url = 'https://cloud.unblockedgames.world/quantum-computing-the-future-of-encryption/';
        console.log(`Fetching: ${url}`);
        const res = await axios.get(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0'
            }
        });
        
        console.log(`Status: ${res.status}`);
        const $ = cheerio.load(res.data);
        console.log("Title:", $('title').text());
        
        let foundLinks = false;
        $('a').each((i, el) => {
            const href = $(el).attr('href');
            if (href && !href.includes('unblockedgames') && !href.startsWith('#')) {
                console.log(`Link: ${$(el).text().trim()} -> ${href}`);
                foundLinks = true;
            }
        });
        if (!foundLinks) console.log("No external links found.");
    } catch (e) {
        console.error(`Error: ${e.message}`);
    }
}

testDirectAccess();
