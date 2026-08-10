(function () {

    "use strict";

    // Basic slot machine emojis pulled off the internet
    // Using these for now until I can scrape posters
    const PLACEHOLDER = "❓";

    const poster_boxes = document.querySelectorAll(".poster-box");
    const spinBtn = document.querySelector("#spin-btn")
    spinBtn.addEventListener("click", spin)

    for (const poster_box of poster_boxes) {
        buildReel(poster_box, [PLACEHOLDER], 0);
    }

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
            const filler = shuffle(films);
            const pool = [PLACEHOLDER, ...filler, target];
            buildReel(poster_box, pool, duration);
        }
    
        await new Promise((resolve) => setTimeout(resolve, duration * 1000));
        spinBtn.disabled = false;

        console.log("Chose: ", target.title);
    }
    
    function buildReel(poster_box, pool, duration) {
        const oldPosters = poster_box.querySelector(".posters");
        const newPosters = oldPosters.cloneNode(false);
    
        for (let i = pool.length - 1; i >= 0; i--) {
        const box = document.createElement("div");
        box.classList.add("box");
        box.style.width = poster_box.clientWidth + "px";
        box.style.height = poster_box.clientHeight + "px";
        box.textContent = pool[i];
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

    function shuffle([...arr]) {
        let m = arr.length;
        while (m) {
        const i = Math.floor(Math.random() * m--);
        [arr[m], arr[i]] = [arr[i], arr[m]];
        }
        return arr;
    }
    
})();
