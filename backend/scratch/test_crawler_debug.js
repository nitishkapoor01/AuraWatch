const MovieCrawler = require('../utils/movieCrawler');

(async () => {
    const crawler = new MovieCrawler();
    console.log('--- STARTING SEARCH: Hoppers ---');
    const result = await crawler.searchExactMovie('Hoppers', 2025);
    console.log('--- SEARCH COMPLETE ---');
    
    if (result.movie) {
        console.log(`Found: ${result.movie.title}`);
        console.log(`Total Links: ${result.movie.totalLinks}`);
        
        const sources = new Set();
        result.movie.links.direct.forEach(l => {
            const sourceMatch = l.name.match(/^([^:]+):/);
            if (sourceMatch) sources.add(sourceMatch[1]);
        });
        
        console.log('Sources found:', Array.from(sources).join(', '));
    } else {
        console.log('No movie found.');
    }
})();
