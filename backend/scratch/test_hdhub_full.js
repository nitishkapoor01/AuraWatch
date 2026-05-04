const axios = require('axios');
const cheerio = require('cheerio');

async function testHDHub4uFull() {
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

        if (response.data.hits && response.data.hits.length > 0) {
            const hit = response.data.hits[0].document;
            const baseOrigin = new URL(baseUrl).origin;
            const movieUrl = hit.permalink.startsWith('http') ? hit.permalink : `${baseOrigin}${hit.permalink.startsWith('/') ? '' : '/'}${hit.permalink}`;
            
            console.log(`✅ Found Post: ${hit.post_title}`);
            console.log(`📄 Fetching Page: ${movieUrl}`);
            
            const pageRes = await axios.get(movieUrl, {
                headers: { 'User-Agent': 'Mozilla/5.0' },
                timeout: 10000
            });
            
            const $ = cheerio.load(pageRes.data);
            const foundLinks = [];
            
            $('a[href*="gdtot"], a[href*="gdflix"], a[href*="hubcloud"], a[href*="filepress"], a[href*="sharer"], a[href*="drive.google"], a[href*="mega"], a[href*="pixeldrain"], a[href*="gofile"], a[href*="mediafire"], a[href*="droplink"], a[href*="v-cloud"], a[href*="hblinks"], a[href*="unblockedgames"], a[href*="modlist.in"], a[href*="kmhd.eu"], a[href*="katmoviehd"]').each((i, el) => {
                const href = $(el).attr('href');
                const text = $(el).text().trim();
                if (href && !href.includes('wp-content')) {
                    foundLinks.push({ text, href });
                }
            });

            if (foundLinks.length > 0) {
                console.log(`🚀 Found ${foundLinks.length} download links!`);
                foundLinks.slice(0, 5).forEach((l, i) => {
                    console.log(`${i+1}. ${l.text} -> ${l.href.substring(0, 50)}...`);
                });
            } else {
                console.log('❌ No download links found on page.');
                // console.log('Page Snippet:', pageRes.data.substring(0, 500));
            }
        } else {
            console.log('❌ No hits found.');
        }
    } catch (e) {
        console.error(`❌ Test failed: ${e.message}`);
    }
}

testHDHub4uFull();
