const Crawler = require('../backend/utils/movieCrawler');
const crawler = new Crawler();

const t1 = "Alice In Wonderland 2010 1080p BluRay";
const s1 = "Alice in Borderland";

console.log("Match 1:", crawler._isTitleMatch(t1, s1)); // Should be false

const t2 = "The Boys I've Loved Before";
const s2 = "The Boys";

console.log("Match 2:", crawler._isTitleMatch(t2, s2)); // Should be false

const t3 = "Alice in Borderland Season 1 1080p WebDL";
const s3 = "Alice in Borderland";

console.log("Match 3:", crawler._isTitleMatch(t3, s3)); // Should be true

// What about type matching? TV shows usually have S01E01 or Season 1
// If the user searches for "Alice in Borderland" via frontend, what is the 'title' parameter?
