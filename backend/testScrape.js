2const axios = require('axios');
const cheerio = require('cheerio');

async function test() {
  const r = await axios.get('https://new7.hdhub4u.fo/?s=batman', {headers: {'User-Agent': 'Mozilla/5.0'}});
  const fs = require('fs');
  fs.writeFileSync('hdhub4u_test.html', r.data);
  console.log('Saved to hdhub4u_test.html');
}
test();
