/*
sidepanel/slot-machine.js
Interactive film-picking UI for the Spinboxd Chrome extension.
 
Runs inside the side panel and drives the visual "slot machine" that
spins through poster images before landing on a randomly chosen film
from the user's watcjhlist (read from chrome.storage.local, 
and saved by service-worker.js).
*/

(function () {

    "use strict";

    // Basic slot machine emojis pulled off the internet
    // Using these for now until I can scrape posters
    const PLACEHOLDER = "❓";
    const FILLER_COUNT = 12 // keep spinning posters small and few for visual clarity.

    const poster_boxes = document.querySelectorAll(".poster-box");
    const spinBtn = document.querySelector("#spin-btn")
    const resultTitle = document.querySelector("#result-title");
    spinBtn.addEventListener("click", spin)

    for (const poster_box of poster_boxes) {
        buildReel(poster_box, [PLACEHOLDER], 0);
    }

    /**
     * Handler for the spin button. Picks one random "winner" film
     * from the films stored in chrome.storage.local, then rebuilds every
     * reel (.poster-box) with a shuffled filler pool ending on that same
     * winner, so all reels land on the winner.
     *
     * Disables the spin button for the duration of the animation and
     * updates #result-title with the winning film's title.
     *
     * @returns {Promise<void>}
     */
    async function spin() {
        const { films } = await chrome.storage.local.get("films");

        if (!films || films.length === 0) {
            console.log("[Spinboxd] has no films loaded. Open a watchlist first.")
            return;
        }

        spinBtn.disabled = true; // Turn off spinning while already spinning

        // Pick one winner always. This will be displayed across each 'reel'
        // of the slot machine.
        const target = films[Math.floor(Math.random() * films.length)];
    
        const duration = 2;

        for (const poster_box of poster_boxes) {
            // Visual spinning flair -- winner is still already chosen from above.
            const filler = shuffle(films).slice(0, FILLER_COUNT);
            const pool = [PLACEHOLDER, ...filler, target];
            buildReel(poster_box, pool, duration);
        }
    
        await new Promise((resolve) => setTimeout(resolve, duration * 1000));
        spinBtn.disabled = false;

        resultTitle.textContent = target.title;

        console.log("Chose: ", target.title);
    }
    
    /**
     * Rebuilds a single "reel"'s contents and animates it scrolling up to
     * reveal the last item in "pool" (the winner). Replaces the reel's
     * ".posters" container with a fresh one populated from pool, starts
     * it scrolled to the top item, then (if duration > 0) transitions it
     * into view and leaves the winning film in the DOM.
     *
     * @param {Element} poster_box - The ".poster-box" element containing
     *   the ".posters" reel to rebuild.
     * @param {Array<string|{title: string, posterURL: string}>} pool - The
     *   ordered list of items to render into the reel, last item first in
     *   the DOM so it settles into view. Items are either the PLACEHOLDER
     *   string or a film object.
     * @param {number} duration - Animation duration in seconds. A value of
     *   0 renders the reel statically with no transition (used for the
     *   initial placeholder state).
     * @returns {void}
     */
    function buildReel(poster_box, pool, duration) {
        const oldPosters = poster_box.querySelector(".posters");
        const newPosters = oldPosters.cloneNode(false);
    
        for (let i = pool.length - 1; i >= 0; i--) {
        const box = document.createElement("div");
        box.classList.add("box");
        box.style.width = poster_box.clientWidth + "px";
        box.style.height = poster_box.clientHeight + "px";
        renderBoxContent(box, pool[i]);
        newPosters.appendChild(box);
        }
    
        // Start spinning on a "❓" icon for the FIRST spin.
        newPosters.style.transitionDuration = `${duration}s`;
        newPosters.style.transform = `translateY(-${
        poster_box.clientHeight * (pool.length - 1)
        }px)`;
    
        poster_box.replaceChild(newPosters, oldPosters);
    
        if (duration > 0) {
        newPosters.addEventListener(
            "transitionstart",
            () => {
            newPosters.querySelectorAll(".box").forEach((box) => {
                box.style.filter = "blur(1px)";
            });
            },
            { once: true }
        );
    
        newPosters.addEventListener(
            "transitionend",
            function () {
            this.querySelectorAll(".box").forEach((box, index) => {
                box.style.filter = "blur(0)";
                if (index > 0) this.removeChild(box); // keep only the winner
            });
            },
            { once: true }
        );
    
        // Changing transform AFTER insertion and THEN trigger
        // the CSS transition.
        requestAnimationFrame(() => {
            newPosters.style.transform = "translateY(0)";
        });
        }
    }

    /**
     * Renders a single reel box's content: either placeholder text (for
     * the "❓" string item) or a film's poster image.
     *
     * @param {HTMLDivElement} box - The box element to render into.
     * @param {string|{title: string, posterURL: string}} item - Either the
     *   PLACEHOLDER string or a film object with title/posterURL.
     * @returns {void}
     */
    function renderBoxContent(box, item) {
        if (typeof item === "string") {
        box.textContent = item;
        return; // Testing film titles.
        }
    
        const img = document.createElement("img");
        img.src = item.posterURL;
        img.alt = item.title;
        img.onerror = () => {
            console.warn("[SpinBoxd] Poster failed to load:", item.title, item.posterURL);
        };
        box.appendChild(img);
    }

    /**
     * Returns a new array containing the same elements as "arr" in random
     * order. Does not change the input array in any way.
     *
     * @param {Array} arr - The array to shuffle.
     * @returns {Array} A new, randomly-ordered array.
     */

    function shuffle([...arr]) {
        let m = arr.length;
        while (m) {
        const i = Math.floor(Math.random() * m--);
        [arr[m], arr[i]] = [arr[i], arr[m]];
        }
        return arr;
    }
    
})();
