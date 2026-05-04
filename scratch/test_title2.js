const Crawler = require('../backend/utils/movieCrawler');
const crawler = new Crawler();

const t1 = "Alice in Wonderland Season 1 Complete";
const s1 = "Alice in Borderland Season 1";

console.log("Match 1:", crawler._isTitleMatch(t1, s1)); // Should be false
