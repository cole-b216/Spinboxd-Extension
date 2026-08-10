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
