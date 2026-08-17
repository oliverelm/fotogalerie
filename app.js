window.addEventListener("load", () => {
  // Klick auf den neuen Galerie-Button auf der Startseite:
  const openGalleryBtn = document.getElementById("open-gallery-btn");
  if (openGalleryBtn) {
    openGalleryBtn.addEventListener("click", () => {
      document.getElementById("view-home").classList.add("hidden");
      document.getElementById("view-gallery-section").classList.remove("hidden");
      init(); // Startet erst jetzt das Laden der Kategorien!
    });
  }

  // Restliche Event-Listener wie gewohnt...
  if (!el.categoryGrid) return;
  
  el.retryBtn.addEventListener("click", () => loadFolder(currentPath));
  el.backBtn.addEventListener("click", () => loadFolder(currentPath.slice(0, -1)));
  // ... (der Rest deiner Event-Listener bleibt exakt gleich)
});
