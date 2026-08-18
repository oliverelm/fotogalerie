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
    const img = new Image();
    img.onload = () => {
      slide.style.backgroundImage = `url('${src}')`;
    };
    img.src = src;
    delete slide.dataset.bg;
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
