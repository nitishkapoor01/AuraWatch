const axios = require('axios');

async function testApi() {
  try {
    const today = new Date().toISOString().split('T')[0];
    const query = 'batman';
    const apiUrl = new URL("https://search.pingora.fyi/collections/post/documents/search");
    apiUrl.searchParams.append('q', query);
    apiUrl.searchParams.append('query_by', 'post_title,category,stars,director,imdb_id');
    apiUrl.searchParams.append('query_by_weights', '4,2,2,2,4');
    apiUrl.searchParams.append('sort_by', 'sort_by_date:desc');
    apiUrl.searchParams.append('limit', 10);
    apiUrl.searchParams.append('highlight_fields', 'none');
    apiUrl.searchParams.append('use_cache', 'true');
    apiUrl.searchParams.append('page', 1);
    apiUrl.searchParams.append('analytics_tag', today);

    console.log('Fetching from:', apiUrl.toString());
    const response = await axios.get(apiUrl.toString(), {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Referer': 'https://new7.hdhub4u.fo/',
        'Origin': 'https://new7.hdhub4u.fo'
      }
    });
    console.log('Results found:', response.data.found);
    if (response.data.hits && response.data.hits.length > 0) {
      const firstResult = response.data.hits[0].document;
      console.log('First result title:', firstResult.post_title);
      console.log('First result link:', firstResult.permalink);
      
      // Now let's try to get the download links from the permalink
      const movieUrl = firstResult.permalink.startsWith('http') ? firstResult.permalink : `https://new7.hdhub4u.fo${firstResult.permalink}`;
      console.log('Fetching download page:', movieUrl);
      const pageRes = await axios.get(movieUrl, {
        headers: { 
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Referer': 'https://new7.hdhub4u.fo/'
        }
      });
      const cheerio = require('cheerio');
      const $ = cheerio.load(pageRes.data);
      const links = [];
      // HDHub4u usually has download links in buttons or specific classes
      $('a[href*="hblinks"], a[href*="gdtot"], a[href*="gdflix"], a[href*="hubcloud"]').each((i, el) => {
        const href = $(el).attr('href');
        const text = $(el).text().trim();
        if (href) {
          links.push({ text, href });
        }
      });
      console.log('Found download-related links:', links.length);
      links.forEach(l => console.log(`- [${l.text}] ${l.href}`));
    }
  } catch (error) {
    console.error('Error:', error.message);
    if (error.response) console.error('Response status:', error.response.status);
  }
}

testApi();
