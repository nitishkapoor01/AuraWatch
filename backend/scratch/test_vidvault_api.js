const axios = require('axios');

async function testVidVaultApi() {
    try {
        const TMDB_ID = '278'; // Shawshank
        
        console.log("Getting token...");
        const tokenRes = await axios.get('https://vidvault.ru/api/get-token');
        const token = tokenRes.data.t;
        console.log("Token:", token);
        
        const payload = { type: 'movie', tmdbId: TMDB_ID };
        console.log("Fetching downloads...");
        const dlRes = await axios.post('https://vidvault.ru/api/get-downloads', payload, {
            headers: { 'x-token': token }
        });
        
        const extractData = dlRes.data?.extractData;
        const coreData = extractData?.data?.data || extractData?.data;
        
        console.log(JSON.stringify(coreData, null, 2));
    } catch (e) {
        console.error("Failed:", e.message);
    }
}
testVidVaultApi();
