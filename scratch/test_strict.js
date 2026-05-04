const Crawler = require('../backend/utils/movieCrawler');
const crawler = new Crawler();

const titleMatches = [
    { target: "The Boys (Season 1 - 4) Dual Audio HDHub4u", search: "The Boys Season 1" },
    { target: "Inception 2010 1080p BluRay", search: "Inception" },
    { target: "Inception (2010) HDHub4u", search: "Inception" },
    { target: "Alice in Borderland S01 1080p WEB-DL", search: "Alice in Borderland Season 1" }
];

for (const t of titleMatches) {
    console.log(`Match: "${t.target}" vs "${t.search}" =>`, crawler._isTitleMatch(t.target, t.search));
}
