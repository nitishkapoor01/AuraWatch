const axios = require('axios');

async function testDirect() {
    const origUrl = 'https://cdnxw.hakunaymatata.com/resource/7966e58c1fce472dc5b5de50499c9e9f.mp4?sign=13f3cb21a10c0f29492fc1ac70a2';
    try {
        console.log("Testing direct URL:", origUrl);
        const res = await axios.head(origUrl, { headers: { 'User-Agent': 'Mozilla/5.0' }});
        console.log("Direct status:", res.status);
    } catch (e) {
        console.log("Direct failed:", e.message);
        if (e.response) console.log(e.response.status, e.response.statusText);
    }
}
testDirect();
