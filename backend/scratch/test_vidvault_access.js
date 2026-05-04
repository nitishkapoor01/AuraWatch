const axios = require('axios');

async function testAccess() {
    try {
        const TMDB_ID = '278'; // Shawshank
        
        console.log("1. Getting token...");
        const tokenRes = await axios.get('https://vidvault.ru/api/get-token');
        const token = tokenRes.data.t;
        
        console.log("2. Fetching downloads...");
        const dlRes = await axios.post('https://vidvault.ru/api/get-downloads', { type: 'movie', tmdbId: TMDB_ID }, {
            headers: { 'x-token': token }
        });
        
        const coreData = dlRes.data?.extractData?.data?.data || dlRes.data?.extractData?.data;
        if (!coreData || !coreData.streams || coreData.streams.length === 0) {
            console.log("No streams found");
            return;
        }
        
        const targetUrl = coreData.streams[0].url;
        console.log("Target URL:", targetUrl);
        
        console.log("\n3a. Testing without Referer...");
        try {
            const res1 = await axios.get(targetUrl, { 
                headers: { 'Range': 'bytes=0-100' },
                timeout: 5000
            });
            console.log("SUCCESS without Referer!", res1.status);
        } catch (e) {
            console.log("FAILED without Referer:", e.response ? e.response.status : e.message);
            if (e.response && e.response.status === 403) {
                console.log("Response HTML:", e.response.data.substring(0, 100));
            }
        }
        
        console.log("\n3b. Testing WITH Referer...");
        try {
            const res2 = await axios.get(targetUrl, { 
                headers: { 
                    'Range': 'bytes=0-100',
                    'Referer': 'https://vidvault.ru/'
                },
                timeout: 5000
            });
            console.log("SUCCESS WITH Referer!", res2.status);
        } catch (e) {
            console.log("FAILED WITH Referer:", e.response ? e.response.status : e.message);
        }
        
    } catch (e) {
        console.error("Test failed:", e.message);
    }
}
testAccess();
