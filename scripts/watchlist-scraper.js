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

function scrapeFilmFromDoc(doc) {
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

function scrapeCurrentPage() {
  const frameEles = document.querySelectorAll("a.frame[data-original-title]");

  return Array.from(frameEls).map((frameEl) => {
    const title = frameEl.getAttribute("data-original-title"); // EX: "Punch-Drunk Love (2002)"

    const href = frameEl.getAttribute("href");
    const slug = href ? href.split("/").filter(Boolean).pop() : null;
    const filmUrl = href ? `https://letterboxd.com${href}` : null;
    const posterEl = frameEl.previousElementSibling;
    const posterUrl = posterEl?.querySelector("img")?.src ?? null;

    return { title, slug, filmUrl, posterUrl };
  });
}

const films = scrapeCurrentPage();

chrome.runtime.sendMessage({
  type: "WATCHLIST_SCRAPED",
  films,
});
