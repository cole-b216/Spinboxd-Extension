/* 
scripts/watchlist-scraper.js
Primary controller for the Spinboxd watchlist-scraper. 

This controller module receives information from the Letterboxd site.
Specifically, once on letterboxd.com/<user>/watchlist, the film data from all
watchlist pages will be saved. The data includes film name, slug, URL, and posterURL.

Each page is scraped for important data that is sent to the 
service-worker and slot-machine.

AUTHOR: Cole Bowman
DATE: August 9, 2026
*/

/*
HTML organization for each watchlist item is (roughly) as follows, 
with only key information included (capitalized variables):
    <div class="react-component" data-component-class="LazyPoster" ...
    data-item-name="NAME (YEAR)" data-item-slug="HYPHENATED-SLUG"
    data-item-link="film/LINK" ... >
      <div class="poster film-poster"...>
          <img class="image" src="POSTER_LINK" ...>
    ....
*/

/**
 * Gets the user's Letterboxd username while they are
 * actively in the Letterboxd window.
 *
 * Reads the first path segment of the current URL, e.g. for
 * "https://letterboxd.com/someuser/watchlist/" this returns "someuser".
 *
 * @returns {string|null} The username parsed from the URL, or null if
 *   the path has no segments.
 */
function getUsernameFromURL() {
  const parts = window.location.pathname.split("/").filter(Boolean);
  return parts[0] ?? null;
}

/**
 * Single-page watchlist scraper. Takes any given document and returns
 * an Array of film objects, each containing the film's title, slug,
 * filmURL, and posterURL.
 *
 * @param {Document} doc - The Letterboxd document to scrape.
 *   Precondition: doc must be a valid window.document, either the live
 *   window's document or one produced by DOMParser.
 * @returns {{title: string|null, slug: string|null, filmURL: string|null, posterURL: string|null}[]}
 *   An array of film objects found on the page. Returns an empty array
 *   if no watchlist items are present (e.g. an out-of-range page).
 */

function scrapeFilmsFromDoc(doc) {
  const titleEls = doc.querySelectorAll('.react-component[data-component-class="LazyPoster"]');
  
  return Array.from(titleEls).map((titleEl) => {
    const title = titleEl.getAttribute("data-item-name");
    const slug = titleEl.getAttribute("data-item-slug");
    const linkPath = titleEl.getAttribute("data-item-link");
    const filmURL = linkPath ? `https://letterboxd.com${linkPath}` : null;
    const posterURL = titleEl.querySelector("img")?.src ?? null;

    return { title, slug, filmURL, posterURL };
  });
}

/**
 * Asynchronous function responsible for scraping ALL pages of a user's
 * watchlist. This accesses the current window.document to determine the
 * username, then fetches and scrapes each subsequent watchlist page in turn.
 *
 * Pages are scraped sequentially (page 2, 3, 4, ...) until MAX_PAGE is
 * reached, a page request fails (signaling the end of the watchlist),
 * or a fetched page contains no films.
 *
 * @returns {Promise<{username: string|null, films: Array}>} An object
 *   containing the scraped username and the combined array of films from
 *   every page of the watchlist.
 */

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
    const films = scrapeFilmsFromDoc(doc);

    if (films.length === 0) break; // Another guard when out of films
    allFilms = allFilms.concat(films);
    page++;
  }

  return { username, films: allFilms };
}

/**
 * Entry point. Runs immediately when this content script
 * is injected into a letterboxd.com/<user>/watchlist/ page
 * (see manifest.json's content_scripts config). Scrapes the full watchlist,
 * then hands the result off to service-worker.js through a runtime message.
 */

(async () => {
  const { username, films } = await scrapeEveryPage();
 
  chrome.runtime.sendMessage({
    type: "WATCHLIST_SCRAPED",
    username,
    films,
  });
})();

