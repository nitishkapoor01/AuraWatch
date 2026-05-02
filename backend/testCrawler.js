const MovieCrawler = require('./utils/movieCrawler');
(async () => {
  const crawler = new MovieCrawler();
  const result = await crawler.searchExactMovie('Inception', 2010);
  console.log(JSON.stringify(result, null, 2));
})();
