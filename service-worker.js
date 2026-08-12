/* 
service-worker.js
Primary controller for the Spinboxd's background tasks. 

This controller module waits until the watchlist has been scraped. 
Once watchlist-scraper has scraped all items of a watchlist, it is responsible
for communicating with The Movie Database to receive functional poster URLs. 

Additionally, the TMDb information is cached, reducing need to return to old
films previously scraped. 

The posters are then displayed by slot-machine.js, in the interactive
film randomizer.

AUTHOR: Cole Bowman
DATE: August 8, 2026
*/

// Please copy-paste your own API key to TMDB here.
const TMDB_API_KEY = "your_key";

/**
 * Runs once when the extension is installed or updated. Sets up the
 * side panel so it opens when the user clicks the toolbar button.
 */
chrome.runtime.onInstalled.addListener(() => {
  chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true });
});

/**
 * Listens for messages from other extension contexts (specifically
 * watchlist-scraper.js's content script). On a "WATCHLIST_SCRAPED"
 * message, this:
 *   1. Loads the existing TMDb poster cache from chrome.storage.local.
 *   2. Enriches every scraped film with a TMDb poster URL,
 *      looking up films concurrently (bound by mapWithConcurrency)
 *      and reusing cached results where available.
 *   3. Stores the updated cache and the enriched film list back to
 *      chrome.storage.local for slot-machine.js and sidepanel.js to read.
 *
 * @param {{type: string, username: string|null, films: Array}} message -
 *   The runtime message. Only messages with type "WATCHLIST_SCRAPED" are handled.
 * @param {chrome.runtime.MessageSender} sender - Standard sender info.
 * @param {(response: {ok: boolean}) => void} sendResponse - Callback invoked
 *   once enrichment and storage are complete.
 * @returns {boolean|undefined} Returns true for "WATCHLIST_SCRAPED" messages
 *   to keep the message channel open while the async enrichment work runs;
 *   otherwise returns undefined (no response expected).
 */
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


/**
 * Loads the persisted TMDb poster cache from chrome.storage.local.
 * Caching movie posters reduces the number of TMDb requests needed and
 * helps avoid hitting TMDb's rate limit.
 *
 * @returns {Promise<Object<string, {posterURL: string}>>} A map of film
 *   slug -> cached poster info. Returns an empty object if no cache exists yet.
 */
async function loadTmdbCache() {
  const { tmdbCache } = await chrome.storage.local.get("tmdbCache");
  return tmdbCache ?? {};
}

/**
 * Stores the given TMDb poster cache to chrome.storage.local, overwriting
 * any previously stored cache.
 *
 * @param {Object<string, {posterURL: string}>} cache - The cache to save.
 * @returns {Promise<void>}
 */
async function saveTmdbCache(cache) {
  await chrome.storage.local.set({ tmdbCache: cache });
}

/**
 * Splits a Letterboxd title into its title and release year.
 * Letterboxd titles look like "Movie Name (Year)", so this separates them
 * into their component parts for use as TMDb search parameters.
 *
 * @param {string|undefined} fullTitle - The raw title as scraped from
 *   Letterboxd.
 * @returns {{title: string|undefined, year: string|null}} The parsed title
 *   and 4-digit year string. If fullTitle doesn't match the expected
 *   "Name (YYYY)" pattern, title is returned unchanged and year is null.
 */
function parseTitleYear(fullTitle) {
  const match = fullTitle?.match(/^(.*)\s\((\d{4})\)$/);
  if (!match) return { title: fullTitle, year: null };
  return { title: match[1], year: match[2] };
}

/**
 * Fetches a URL, automatically retrying if TMDb responds with a 429
 * (rate limited) status. 
 * 
 * @param {string} url - The URL to fetch.
 * @param {number} [maxRetries=2] - Maximum number of retry attempts after
 *   a 429 response before giving up.
 * @returns {Promise<Response>} The fetch Response, which may still be a
 *   429 once out of retries.
 */
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

/**
 * Attaches a working TMDb poster URL to a scraped film. Checks the cache
 * first (keyed by film slug).
 * On a cache miss:
 *    Queries the TMDb search endpoint by title (and year, if known) 
 *    and stores the result in the provided cache for future lookups.
 *
 * If TMDb has no match, has no poster for the match, or the request fails: 
 *    The original film object is returned unchanged.
 *
 * @param {{title: string, slug: string|null, filmURL: string|null, posterURL: string|null}} film -
 *   A single scraped film object.
 * @param {Object<string, {posterURL: string}>} cache - The TMDb poster
 *   cache, keyed by film slug. Mutated in place when a new poster is found.
 * @returns {Promise<Object>} The film object, with posterURL replaced by
 *   a TMDb-hosted poster URL when one could be found.
 */
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

/**
 * Runs an async mapper function over a list of items with a bounded
 * number of concurrent operations.
 * Input order must be preserved. 
 * This attempts to prevent rate limiting.
 *
 * @template T, R
 * @param {T[]} items - The items to process.
 * @param {number} limit - Maximum number of items to process concurrently.
 * @param {(item: T, index: number) => Promise<R>} mapper - Async function
 *   applied to each item.
 * @returns {Promise<R[]>} Results in the same order as the input items.
 */
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
