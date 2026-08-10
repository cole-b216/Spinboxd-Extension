// scripts/watchlist-scraper.js
//
// Once on the letterboxd.com/<user>/watchlist page, scrape data.
// HTML Organization is (roughly) as follows (key info included):
//    <div class="react-component" data-component-class="LazyPoster"
//         data-item-name"Movie Name (Date)"
//         ...
//    />
//         <div class="poster film-poster">
//              <img src="LINK">
//    ....
// Scrape each page for important data to send to the slot-machine.

function getUsernameFromURL() {
  const parts = window.location.pathname.split("/").filter(Boolean);
  return parts[0] ?? null;
}

function scrapeFilmsFromDoc(doc) {
  const titleEls = doc.querySelectorAll('.react-component[data-component-class="LazyPoster"]');
  
  return Array.from(titleEls).map((titleEl) => {
    const title = titleEl.getAttribute("data-item-name");
    const slug = titleEl.getAttribute("data-item-slug");
    const linkPath = titleEl.getAttribute("data-item-link");
    const filmURL = linkPath ? 'https://letterboxd.com${linkPath}' : null;
    const posterURL = titleEl.querySelector("img")?.src ?? null;

    return { title, slug, filmURL, posterURL };
  });
}

async function scrapeEveryPage() {
  const username = getUsernameFromURL();
  let allFilms = scrapeFilmsFromDoc(document);

  const MAX_PAGE = 100;
  let page = 2;

  while (page <= MAX_PAGE) {
    const url = `${window.location.origin}/${username}/watchlist/page/${page}/`;
    const res = await fetch(url);
    if (!res.ok) break; // Guard when past user's last watchlist page

    const html = await res.text();
    const doc = new DOMParser().parseFromString(html, "text/html");
    const films = scrapeFilmsFromDocument(doc);

    if (films.length === 0) break; // Another guard when out of films
    allFilms = allFilms.concat(films);
    page++;
  }

  return { username, films: allFilms };
}

const films = scrapeEveryPage();

chrome.runtime.sendMessage({
  type: "WATCHLIST_SCRAPED",
  films,
});
