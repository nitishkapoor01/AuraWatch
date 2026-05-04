const MovieCrawler = require('./backend/utils/movieCrawler');

async function test() {
    const crawler = new MovieCrawler();
    console.log("Searching for Alice in Borderland Season 1...");
    const results = await crawler.searchExactMovie("Alice in Borderland", null, {
        type: 'tv',
        season: 1
    });
    console.log("Found:", results.movie ? results.movie.title : "Not found");
    if (results.movie) {
        console.log(JSON.stringify(results.movie.qualities, null, 2));
    }
}
test();
