// Copy-paste your own API key.
// Will develop box to add API key.
const TMDB_API_KEY = "your_key";

chrome.runtime.onInstalled.addListener(() => {
  chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true });
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.type === "WATCHLIST_SCRAPED") {
    (async () => {
      const cache = await loadTmdbCache();
      const enrichedFilms = await mapWithConcurrency(message.films, 6, (film) =>
        addTMDbPoster(film, cache)
      );
      await saveTmdbCache(cache);
 
      chrome.storage.local.set({ films: enrichedFilms }, () => {
        console.log(`[SpinBoxd] Saved ${enrichedFilms.length} films (TMDb-enriched).`);
        sendResponse({ ok: true });
      });
    })();
 
    return true; // keeps the message channel open for the async work above
  }
});


// Cache movie posters -- reduce any problems with rate limit
async function loadTmdbCache() {
  const { tmdbCache } = await chrome.storage.local.get("tmdbCache");
  return tmdbCache ?? {};
}

async function saveTmdbCache(cache) {
  await chrome.storage.local.set({ tmdbCache: cache });
}

// Letterboxd titles look like "Movie Name (Year)", so this separates them
function parseTitleYear(fullTitle) {
  const match = fullTitle?.match(/^(.*)\s\((\d{4})\)$/);
  if (!match) return { title: fullTitle, year: null };
  return { title: match[1], year: match[2] };
}

// Retry maxRetries if there is a 429 error
async function fetchWithRetry(url, maxRetries = 2) {
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const res = await fetch(url);
    if (res.status !== 429) return res;
 
    const retryAfterSeconds = Number(res.headers.get("Retry-After")) || 1;
    console.warn(`[SpinBoxd] TMDb rate limited. Waiting ${retryAfterSeconds}s (attempt ${attempt + 1})`);
    await new Promise((resolve) => setTimeout(resolve, retryAfterSeconds * 1000));
  }
  return fetch(url); // last effort
}


async function addTMDbPoster(film, cache) {
  // Skip TMDb IF CACHED
  if (film.slug && cache[film.slug]) {
    return { ...film, posterURL: cache[film.slug].posterURL };
  }
 
  const { title, year } = parseTitleYear(film.title);
  if (!title) return film;
 
  try {
    const params = new URLSearchParams({ query: title, api_key: TMDB_API_KEY });
    if (year) params.set("year", year);
 
    const result = await fetchWithRetry(`https://api.themoviedb.org/3/search/movie?${params.toString()}`);
    if (!result.ok) {
      console.warn(`[SpinBoxd] TMDb request failed (${result.status}) for`, film.title);
      return film;
    }
 
    const data = await result.json();
    const posterPath = data.results?.[0]?.poster_path ?? null;
 
    // No TMDb match, or the match has no poster -> keep anything that was there.
    // Still might change to simple title display.
    if (!posterPath) return film;
 
    const posterURL = `https://image.tmdb.org/t/p/w200${posterPath}`;
    if (film.slug) cache[film.slug] = { posterURL };
 
    return { ...film, posterURL };
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
