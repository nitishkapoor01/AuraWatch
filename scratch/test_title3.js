const Crawler = require('../backend/utils/movieCrawler');
const crawler = new Crawler();

const t1 = "Alice in Wonderland (2010) Dual Audio [Hindi + English] HDHub4u";
const s1 = "Alice in Borderland Season 1";

console.log("Match HDHub4u:", crawler._isTitleMatch(t1, s1)); // Should be false
