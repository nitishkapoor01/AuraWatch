const axios = require('axios');
const cheerio = require('cheerio');

async function testRedirect() {
    try {
        const url = 'https://cloud.unblockedgames.world/?sid=aDBQeDhZNVBsY1I5cVlWUzJJM1pva29KaHpRSlVFekV3QkFFK1FHRW9Wbz0=';
        const res = await axios.get(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0'
            }
        });
        const $ = cheerio.load(res.data);
        
        $('form').each((i, form) => {
            console.log(`\nForm Action: ${$(form).attr('action')}`);
            console.log(`Form Method: ${$(form).attr('method')}`);
            $(form).find('input').each((j, input) => {
                console.log(`Input: ${$(input).attr('name')} = ${$(input).attr('value')} (type: ${$(input).attr('type')})`);
            });
        });
        
    } catch (e) {
        console.error(`Error: ${e.message}`);
    }
}

testRedirect();
