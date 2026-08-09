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
