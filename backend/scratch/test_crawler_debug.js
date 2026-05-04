const MovieCrawler = require('../utils/movieCrawler');

(async () => {
    const crawler = new MovieCrawler();
    console.log('--- STARTING SEARCH: Batman Ninja vs Yakuza League ---');
    const result = await crawler.searchExactMovie('Batman Ninja vs Yakuza League', 2025);
    console.log('--- SEARCH COMPLETE ---');
    
    if (result.movie) {
        console.log(`Found: ${result.movie.title}`);
        console.log(`Total Links: ${result.movie.totalLinks}`);
        console.log('\n--- DIRECT LINKS ---');
        result.movie.links.direct.forEach(l => {
            console.log(`[${l.name}] => ${l.url.substring(0, 80)}`);
        });
    } else {
        console.log('No movie found.');
    }
})();
