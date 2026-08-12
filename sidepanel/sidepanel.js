/*
sidepanel/sidepanel.js
Side panel script for the Spinboxd Chrome extension.
 
Runs when the extension's side panel is opened. Reads the films previously
saved to chrome.storage.local by service-worker.js (after a watchlist has
been scraped and TMDb-enriched). Responsible for debugging logs to the console.
This script does not itself scrape or any fetch data.
 
This is an extra-step of verification for slot-machine.js, which actually
handles the UI of the extension.
*/


console.log("working")

chrome.storage.local.get("films", ({ films }) => {
  if (!films) {
    console.log("[SpinBoxd] No films saved yet. Open a watchlist page first.");
    return;
  }
  const filmList = Array.isArray(films) ? films : Object.values(films);
 
  if (filmList.length === 0) {
    console.log("[SpinBoxd] No films saved yet. Open a watchlist page first.");
    return;
  }
 
  console.log(`[SpinBoxd] ${filmList.length} films in storage:`);
  filmList.forEach((film, i) => {
    console.log(`${i + 1}. ${film.title}`);
  });
});
