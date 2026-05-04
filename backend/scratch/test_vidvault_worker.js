const axios = require('axios');

async function testWorker() {
    const origUrl = 'https://cdnxw.hakunaymatata.com/resource/7966e58c1fce472dc5b5de50499c9e9f.mp4?sign=13f3cb21a10c0f29492fc1ac70a2'; // truncated sign for testing
    const cdnUrl = `https://dl.gemlelispe.workers.dev/${encodeURIComponent(origUrl)}`;
    
    try {
        console.log("Testing worker:", cdnUrl);
        const res = await axios.get(cdnUrl, { 
            headers: { 
                'User-Agent': 'Mozilla/5.0',
                'Referer': 'https://aurawatch.fun/'
            }
        });
        console.log("Worker status:", res.status);
        console.log("Worker data:", res.data.substring(0, 100));
    } catch (e) {
        console.log("Worker failed:", e.message);
        if (e.response) {
            console.log("Worker returned:", e.response.data);
        }
    }
}
testWorker();
