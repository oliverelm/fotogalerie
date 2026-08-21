// Crossfade-Slideshow für den Hero-Bereich — mit Lazy Loading.
// Nur das erste Bild lädt sofort (steht schon im HTML). Jedes weitere Bild
// wird erst kurz bevor es dran ist per JavaScript nachgeladen (immer eines
// im Voraus), damit die Startseite schnell aufgebaut ist, die Überblendung
// aber trotzdem nahtlos bleibt.
(function () {
  const slides = document.querySelectorAll(".slide");
  if (slides.length <= 1) return;

  const prefersReducedMotion = window.matchMedia(
    "(prefers-reduced-motion: reduce)"
  ).matches;
  if (prefersReducedMotion) return; // erstes Bild bleibt einfach stehen, Rest wird gar nicht geladen

  function loadSlide(slide) {
    const src = slide.dataset.bg;
    if (!src) return; // schon geladen (oder das erste, fest im HTML gesetzte Bild)
    const fallback = slide.dataset.fallback;

    const tryLoad = (url, onFail) => {
      const img = new Image();
      img.onload = () => {
        slide.style.backgroundImage = `url('${url}')`;
      };
      if (onFail) img.onerror = onFail;
      img.src = url;
    };

    // WebP zuerst versuchen (deutlich kleiner); nur falls der Browser das
    // nicht laden kann (z.B. sehr alter Browser), automatisch auf JPG
    // zurückfallen.
    if (fallback) {
      tryLoad(src, () => tryLoad(fallback));
    } else {
      tryLoad(src);
    }

    delete slide.dataset.bg;
    delete slide.dataset.fallback;
  }

  let current = 0;
  const intervalMs = 6000;

  // Direkt nach dem Laden schon mal das zweite Bild im Hintergrund vorbereiten,
  // damit die erste Überblendung nicht auf ein leeres Bild trifft.
  loadSlide(slides[1 % slides.length]);

  setInterval(() => {
    slides[current].classList.remove("active");
    current = (current + 1) % slides.length;
    slides[current].classList.add("active");

    // Bereits das übernächste Bild vorladen, während das aktuelle zu sehen ist.
    const upcoming = (current + 1) % slides.length;
    loadSlide(slides[upcoming]);
  }, intervalMs);
})();

// Gesamtstatistik (Anzahl Fotos, Anzahl Länder) nachladen — beeinträchtigt
// den ersten Seitenaufbau nicht, füllt sich erst nach der Antwort.
(function () {
  const statsEl = document.getElementById("hero-stats");
  if (!statsEl) return;

  fetch("/api/stats")
    .then((res) => (res.ok ? res.json() : Promise.reject()))
    .then((data) => {
      const photos = data.totalImages || 0;
      const countries = data.totalCountries || 0;
      const photoWord = photos === 1 ? "Foto" : "Fotos";
      const countryWord = countries === 1 ? "Land" : "Ländern";
      statsEl.textContent = `${photos.toLocaleString("de-DE")} ${photoWord} aus ${countries} ${countryWord}`;
    })
    .catch(() => {
      // Bei Fehlern einfach nichts anzeigen — kein kaputter Zustand sichtbar.
    });
})();
