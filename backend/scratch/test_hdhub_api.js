const axios = require('axios');

async function testHDHub4u() {
    const title = "Joker";
    const year = 2024;
    const name = "HDHub4u";
    const baseUrl = "https://new7.hdhub4u.fo/?utm=mn1";
    
    try {
        console.log(`🔍 Searching ${name} at ${baseUrl}...`);
        const today = new Date().toISOString().split('T')[0];
        const query = `${title} ${year}`;
        const apiUrl = "https://search.pingora.fyi/collections/post/documents/search";
        
        const response = await axios.get(apiUrl, {
            params: {
                q: query,
                query_by: 'post_title,category,stars,director,imdb_id',
                query_by_weights: '4,2,2,2,4',
                sort_by: 'sort_by_date:desc',
                limit: 3,
                highlight_fields: 'none',
                use_cache: 'true',
                page: 1,
                analytics_tag: today
            },
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
                'Accept': 'application/json, text/plain, */*',
                'Referer': baseUrl,
                'Origin': new URL(baseUrl).origin
            },
            timeout: 12000
        });

        console.log('Response Status:', response.status);
        if (response.data.hits && response.data.hits.length > 0) {
            console.log(`✅ Found ${response.data.hits.length} hits!`);
            response.data.hits.forEach((h, i) => {
                console.log(`${i+1}. ${h.document.post_title} (${h.document.imdb_id})`);
            });
        } else {
            console.log('❌ No hits found.');
            console.log('Response Data:', JSON.stringify(response.data, null, 2));
        }
    } catch (e) {
        console.error(`❌ Search failed: ${e.message}`);
        if (e.response) {
            console.log('Error Data:', e.response.data);
            console.log('Error Headers:', e.response.headers);
        }
    }
}

testHDHub4u();
