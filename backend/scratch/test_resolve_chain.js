const axios = require('axios');
const cheerio = require('cheerio');

// Test the full resolution chain for cloud.unblockedgames.world
async function resolveUnblockedGames(shortUrl) {
    console.log(`\n==== Resolving: ${shortUrl} ====`);
    
    const headers = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
    };
    
    // Step 1: Fetch the shortener page
    const step1 = await axios.get(shortUrl, { headers });
    const $1 = cheerio.load(step1.data);
    
    // Extract the _wp_http hidden field
    const wpHttp = $1('input[name="_wp_http"]').val() || $1('input[name="_wp_http2"]').val();
    const formAction = $1('form').attr('action');
    console.log(`Step 1 - Form action: ${formAction}, _wp_http: ${wpHttp}`);
    
    if (!wpHttp) {
        console.log("No form found, might be direct link or different flow");
        return;
    }
    
    // Step 2: POST to the form action
    const params = new URLSearchParams();
    params.append('_wp_http', wpHttp);
    
    const step2 = await axios.post(formAction || 'https://cloud.unblockedgames.world/', params, {
        headers: {
            ...headers,
            'Content-Type': 'application/x-www-form-urlencoded',
            'Referer': shortUrl
        },
        maxRedirects: 5
    });
    
    const $2 = cheerio.load(step2.data);
    console.log(`Step 2 URL: ${step2.request?.res?.responseUrl || step2.config?.url}`);
    
    // Look for another form
    const wpHttp2 = $2('input[name="_wp_http2"]').val() || $2('input[name="_wp_http"]').val();
    const formAction2 = $2('form').attr('action');
    console.log(`Step 2 - Form action: ${formAction2}, _wp_http2: ${wpHttp2}`);
    
    // Look for direct download links
    const allLinks = [];
    $2('a[href]').each((i, el) => {
        const href = $2(el).attr('href');
        if (href && !href.includes('unblockedgames') && !href.startsWith('#')) {
            allLinks.push({ text: $2(el).text().trim(), href });
        }
    });
    console.log("Links found in step 2:", allLinks);
    
    if (!wpHttp2 && allLinks.length === 0) {
        // Check for script-based redirect or other patterns
        const scriptContent = step2.data;
        const locationMatch = scriptContent.match(/window\.location(?:\.href)?\s*=\s*['"]([^'"]+)['"]/);
        if (locationMatch) {
            console.log(`Script redirect: ${locationMatch[1]}`);
        }
        return;
    }
    
    // Step 3: If there's another form, POST again
    if (wpHttp2 && formAction2) {
        const params2 = new URLSearchParams();
        params2.append('_wp_http2', wpHttp2);
        
        const step3 = await axios.post(formAction2, params2, {
            headers: {
                ...headers,
                'Content-Type': 'application/x-www-form-urlencoded',
                'Referer': step2.request?.res?.responseUrl || formAction
            },
            maxRedirects: 5
        });
        
        const $3 = cheerio.load(step3.data);
        console.log(`Step 3 URL: ${step3.request?.res?.responseUrl || step3.config?.url}`);
        
        // Final links
        $3('a[href]').each((i, el) => {
            const href = $3(el).attr('href');
            const text = $3(el).text().trim();
            if (href && !href.includes('unblockedgames') && !href.startsWith('#')) {
                console.log(`FINAL LINK: [${text}] => ${href}`);
            }
        });
        
        // Check script redirect
        const locationMatch = step3.data.match(/window\.location(?:\.href)?\s*=\s*['"]([^'"]+)['"]/);
        if (locationMatch) {
            console.log(`FINAL Script redirect: ${locationMatch[1]}`);
        }
    }
}

resolveUnblockedGames('https://cloud.unblockedgames.world/?sid=aDBQeDhZNVBsY1I5cVlWUzJJM1pva29KaHpRSlVFekV3QkFFK1FHRW9Wbz0=')
    .catch(e => console.error('Fatal error:', e.message));
