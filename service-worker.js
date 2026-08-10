// Copy-paste your own API key.
// Will develop box to add API key.
const TMDB_API_KEY = "your_key";

chrome.runtime.onInstalled.addListener(() => {
  chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true });
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.type === "WATCHLIST_SCRAPED") {
    (async () => {
      const enrichedFilms = await mapWithConcurrency(message.films, 6, addTMDbPoster);

      chrome.storage.local.set({ films: enrichedFilms }, () => {
        console.log(`[SpinBoxd] Saved ${enrichedFilms.length} films (TMDb-enriched).`);
        sendResponse({ ok: true });
      });
    })();

    return true; // keeps the message channel open for the async work above
  }
});

// Letterboxd titles look like "Movie Name (Year)", so this separates them
function parseTitleYear(fullTitle) {
  const match = fullTitle?.match(/^(.*)\s\((\d{4})\)$/);
  if (!match) return { title: fullTitle, year: null };
  return { title: match[1], year: match[2] };
}

async function addTMDbPoster(film) {
  const { title, year } = parseTitleYear(film.title);
  if (!title) return film;

  try {
    const params = new URLSearchParams({ query: title, api_key: TMDB_API_KEY });
    if (year) params.set("year", year);

    const result = await fetch(`https://api.themoviedb.org/3/search/movie?${params.toString()}`);
    if (!result.ok) {
      console.warn(`[SpinBoxd] TMDb request failed (${result.status}) for`, film.title);
      return film;
    }

    const data = await result.json();
    const posterPath = data.results?.[0]?.poster_path ?? null;

    // Keep old poster if we can't find one. Might change this to display title.
    if (!posterPath) return film;

    return { ...film, posterURL: `https://image.tmdb.org/t/p/w200${posterPath}` };
  } catch (err) {
    console.warn("[SpinBoxd] TMDb lookup failed for", film.title, err);
    return film;
  }
}

async function mapWithConcurrency(items, limit, mapper) {
  const results = new Array(items.length);
  let nextIndex = 0;

  async function worker() {
    while (nextIndex < items.length) {
      const current = nextIndex++;
      results[current] = await mapper(items[current], current);
    }
  }

  const workers = Array.from({ length: Math.min(limit, items.length) }, worker);
  await Promise.all(workers);
  return results;
}