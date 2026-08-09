console.log("working")

chrome.storage.local.get("films", ({ films }) => {
  if (!films || films.length === 0) {
    console.log("[SpinBoxd] No films saved yet — open a watchlist page first.");
    return;
  }
  console.log(`[SpinBoxd] ${films.length} films in storage:`, films)
   for (const element of films) {
        console.log(element)
    }
});
 
