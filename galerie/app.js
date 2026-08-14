// ============================================================
// Fotogalerie — öffentlich, Bilder kommen über eigene /api-Routen
// (kein Google-Login im Browser mehr nötig; der Server greift mit
// Olivers dauerhaft hinterlegtem Zugang auf Google Drive zu)
// ============================================================

let currentCategoryImages = [];
let currentLightboxIndex = -1;
let lightboxTriggerEl = null; // Element, das die Lightbox geöffnet hat (für Fokus-Rückgabe)

// -------------------- Elemente --------------------
const el = {
  views: {
    loading: document.getElementById("view-loading"),
    error: document.getElementById("view-error"),
    categories: document.getElementById("view-categories"),
    detail: document.getElementById("view-category-detail"),
  },
  loadingLabel: document.getElementById("loading-label"),
  errorLabel: document.getElementById("error-label"),
  retryBtn: document.getElementById("retry-btn"),
  categoryGrid: document.getElementById("category-grid"),
  backBtn: document.getElementById("back-btn"),
  detailTitle: document.getElementById("detail-title"),
  detailCount: document.getElementById("detail-count"),
  thumbGrid: document.getElementById("thumb-grid"),
  lightbox: document.getElementById("lightbox"),
  lightboxImg: document.getElementById("lightbox-img"),
  lightboxCaption: document.getElementById("lightbox-caption"),
  lightboxClose: document.getElementById("lightbox-close"),
  lightboxPrev: document.getElementById("lightbox-prev"),
  lightboxNext: document.getElementById("lightbox-next"),
  lightboxDownload: document.getElementById("lightbox-download"),
  lightboxNameText: document.getElementById("lightbox-name-text"),
  lightboxLocationCell: document.getElementById("lightbox-location-cell"),
  lightboxLocationText: document.getElementById("lightbox-location-text"),
  lightboxNoteCell: document.getElementById("lightbox-note-cell"),
  lightboxNoteText: document.getElementById("lightbox-note-text"),
};

function showView(name) {
  Object.values(el.views).forEach((v) => v.classList.add("hidden"));
  el.views[name].classList.remove("hidden");
}

function showError(message) {
  el.errorLabel.textContent = message;
  showView("error");
}

window.addEventListener("load", () => {
  el.retryBtn.addEventListener("click", () => loadCategories());
  el.backBtn.addEventListener("click", () => showView("categories"));
  el.lightboxClose.addEventListener("click", closeLightbox);
  el.lightbox.addEventListener("click", (e) => {
    if (e.target === el.lightbox) closeLightbox();
  });
  el.lightboxPrev.addEventListener("click", (e) => {
    e.stopPropagation();
    showPrevImage();
  });
  el.lightboxNext.addEventListener("click", (e) => {
    e.stopPropagation();
    showNextImage();
  });
  el.lightboxDownload.addEventListener("click", (e) => {
    e.stopPropagation();
    const file = currentCategoryImages[currentLightboxIndex];
    if (!file) return;
    window.location.href = `/api/download?id=${file.id}`;
  });

  document.addEventListener("keydown", (e) => {
    if (el.lightbox.classList.contains("hidden")) return;
    if (e.key === "ArrowLeft") showPrevImage();
    else if (e.key === "ArrowRight") showNextImage();
    else if (e.key === "Escape") closeLightbox();
    else if (e.key === "Tab") trapFocusInLightbox(e);
  });

  loadCategories();
});

// Hält den Tastaturfokus innerhalb der geöffneten Lightbox (Focus-Trap),
// damit man sich mit Tab nicht "dahinter" in die restliche Seite bewegt.
function trapFocusInLightbox(e) {
  const focusable = el.lightbox.querySelectorAll(
    'button, a[href], [tabindex]:not([tabindex="-1"])'
  );
  if (focusable.length === 0) return;
  const first = focusable[0];
  const last = focusable[focusable.length - 1];

  if (e.shiftKey && document.activeElement === first) {
    e.preventDefault();
    last.focus();
  } else if (!e.shiftKey && document.activeElement === last) {
    e.preventDefault();
    first.focus();
  }
}

// -------------------- Vorschaubilder --------------------

function getThumbnailUrl(item, size) {
  if (!item.thumbnailLink && !item.coverThumbnailLink) return null;
  const link = item.thumbnailLink || item.coverThumbnailLink;
  return link.replace(/=s\d+/, `=s${size}`);
}

// Setzt img.src auf die Vorschau; schlägt das fehl, wird auf die
// Originaldatei über unsere eigene Download-Route zurückgefallen.
function setImageWithFallback(imgEl, item, size) {
  const thumbUrl = getThumbnailUrl(item, size);
  if (!thumbUrl) {
    imgEl.src = `/api/download?id=${item.id}&inline=1`;
    return;
  }
  imgEl.src = thumbUrl;
  imgEl.onerror = () => {
    imgEl.onerror = null;
    imgEl.src = `/api/download?id=${item.id}&inline=1`;
  };
}

function getLocation(file) {
  const loc = file.imageMediaMetadata && file.imageMediaMetadata.location;
  if (!loc || typeof loc.latitude !== "number" || typeof loc.longitude !== "number") {
    return null;
  }
  return { lat: loc.latitude, lng: loc.longitude };
}

// -------------------- Kategorien-Ansicht --------------------

async function loadCategories() {
  el.loadingLabel.textContent = "Kategorien werden geladen …";
  showView("loading");

  try {
    const res = await fetch("/api/categories");
    if (!res.ok) throw new Error("Kategorien konnten nicht geladen werden.");
    const data = await res.json();
    const categories = data.categories || [];

    if (categories.length === 0) {
      showError("Es wurden noch keine Kategorien gefunden.");
      return;
    }

    el.categoryGrid.innerHTML = "";
    showView("categories");

    categories.forEach((cat) => {
      const card = document.createElement("div");
      card.className = "category-card";
      card.setAttribute("role", "button");
      card.setAttribute("tabindex", "0");
      card.setAttribute("aria-label", `Kategorie ${cat.name} öffnen`);
      card.addEventListener("click", () => openCategory(cat.id, cat.name));
      card.addEventListener("keydown", (e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          openCategory(cat.id, cat.name);
        }
      });

      if (cat.coverThumbnailLink) {
        const img = document.createElement("img");
        img.alt = cat.name;
        setImageWithFallback(img, cat, 500);
        card.appendChild(img);
      }

      const plaque = document.createElement("div");
      plaque.className = "plaque";
      plaque.innerHTML = `
        <p class="plaque-name">${escapeHtml(cat.name)}</p>
        <p class="plaque-count">${cat.count} Bild${cat.count === 1 ? "" : "er"}</p>
      `;
      card.appendChild(plaque);
      el.categoryGrid.appendChild(card);
    });
  } catch (e) {
    showError(e.message || "Unbekannter Fehler beim Laden der Kategorien.");
  }
}

// -------------------- Kategorie-Detail-Ansicht --------------------

async function openCategory(folderId, folderName) {
  el.loadingLabel.textContent = `„${folderName}“ wird geöffnet …`;
  showView("loading");

  try {
    const res = await fetch(`/api/category?id=${folderId}`);
    if (!res.ok) throw new Error("Kategorie konnte nicht geladen werden.");
    const data = await res.json();
    const images = data.images || [];

    currentCategoryImages = images;
    el.detailTitle.textContent = folderName;
    el.detailCount.textContent = `${images.length} Bild${images.length === 1 ? "" : "er"}`;
    el.thumbGrid.innerHTML = "";
    showView("detail");

    images.forEach((file, index) => {
      const thumb = document.createElement("div");
      thumb.className = "thumb";
      thumb.setAttribute("role", "button");
      thumb.setAttribute("tabindex", "0");
      thumb.setAttribute(
        "aria-label",
        `${folderName}, Bild ${index + 1} von ${images.length} vergrößern`
      );
      thumb.addEventListener("click", () => openLightbox(index));
      thumb.addEventListener("keydown", (e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          openLightbox(index);
        }
      });

      const img = document.createElement("img");
      img.alt = `${folderName}, Bild ${index + 1} von ${images.length}`;
      img.loading = "lazy";
      setImageWithFallback(img, file, 300);
      thumb.appendChild(img);

      if (getLocation(file)) {
        const pin = document.createElement("span");
        pin.className = "geo-pin";
        pin.title = "Mit Standort";
        pin.textContent = "📍";
        thumb.appendChild(pin);
      }

      el.thumbGrid.appendChild(thumb);
    });
  } catch (e) {
    showError(e.message || "Fehler beim Laden der Kategorie.");
  }
}

// -------------------- Lightbox --------------------

function openLightbox(index) {
  currentLightboxIndex = index;
  const file = currentCategoryImages[index];
  if (!file) return;

  lightboxTriggerEl = document.activeElement;
  el.lightbox.classList.remove("hidden");
  el.lightboxClose.focus();
  updateLightboxNavButtons();

  setImageWithFallback(el.lightboxImg, file, 1600);
  el.lightboxImg.alt = `${el.detailTitle.textContent}, Bild ${index + 1} von ${currentCategoryImages.length}`;
  el.lightboxCaption.textContent = `${index + 1} / ${currentCategoryImages.length}`;
  el.lightboxNameText.textContent = file.name;

  const loc = getLocation(file);
  if (loc) {
    el.lightboxLocationText.textContent = `${loc.lat.toFixed(5)}, ${loc.lng.toFixed(5)}`;
    el.lightboxLocationCell.href = `https://www.google.com/maps?q=${loc.lat},${loc.lng}`;
    el.lightboxLocationCell.classList.remove("hidden");
  } else {
    el.lightboxLocationCell.classList.add("hidden");
  }

  if (file.description && file.description.trim()) {
    el.lightboxNoteText.textContent = file.description.trim();
    el.lightboxNoteCell.classList.remove("hidden");
  } else {
    el.lightboxNoteCell.classList.add("hidden");
  }
}

function showPrevImage() {
  if (currentLightboxIndex > 0) openLightbox(currentLightboxIndex - 1);
}

function showNextImage() {
  if (currentLightboxIndex < currentCategoryImages.length - 1) {
    openLightbox(currentLightboxIndex + 1);
  }
}

function updateLightboxNavButtons() {
  el.lightboxPrev.classList.toggle("hidden", currentLightboxIndex <= 0);
  el.lightboxNext.classList.toggle(
    "hidden",
    currentLightboxIndex >= currentCategoryImages.length - 1
  );
}

function closeLightbox() {
  el.lightbox.classList.add("hidden");
  currentLightboxIndex = -1;
  if (lightboxTriggerEl && typeof lightboxTriggerEl.focus === "function") {
    lightboxTriggerEl.focus();
  }
  lightboxTriggerEl = null;
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}
