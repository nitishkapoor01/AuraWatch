const MovieCrawler = require('../Scrapper/movieCrawler');

async function test() {
    // Increased concurrency to handle multiple shortlink bypasses simultaneously
    const crawler = new MovieCrawler({ maxDepth: 1, concurrency: 10, headless: true });
    
    console.log("Searching Exact Movie...");
    const results = await crawler.searchExactMovie("Batman Ninja vs. Yakuza League", 2025);
    
    console.log("--- BEST MATCH ---");
    if (results.movie) {
        console.log(`Title: ${results.movie.title}`);
        console.log(`Source: ${results.movie.source}`);
        console.log(`Links Found: ${results.movie.totalLinks}`);
        console.log("Qualities:", Object.keys(results.movie.qualities));
    } else {
        console.log("NO EXACT MATCH FOUND");
    }
    
    console.log("--- ALL MOVIES FOUND ---");
    if (results.all) {
        results.all.forEach(m => {
            console.log(`Movie: ${m.title} (${m.links.direct.length} direct links) | Source: ${m.source}`);
        });
    }
}

test().catch(console.error);
