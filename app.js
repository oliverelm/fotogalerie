// ============================================================
// Fotogalerie — öffentlich, Bilder über eigene /api-Routen.
// Unterstützt beliebig tief verschachtelte Unterkategorien, eine
// Volltextsuche (Titel/Bemerkung/Land) und Teilen-Links für einzelne Bilder.
// ============================================================

let currentPath = [];           // [{id, name}, ...] — aktueller Kategorie-Pfad
let currentImages = [];         // Bilder der aktuell offenen Ansicht (Kategorie, Suche oder Teilen-Link)
let currentImagesLabel = "";    // Kontext-Label für Alt-Texte ("Italien", "Suchergebnisse", …)
let currentLightboxIndex = -1;
let lightboxTriggerEl = null;   // Element, das die Lightbox geöffnet hat (Fokus-Rückgabe)
let preSearchState = null;      // { path, wasLeaf } — zum Zurückspringen nach der Suche
let searchDebounceTimer = null;

// -------------------- Elemente --------------------
const el = {
  views: {
    loading: document.getElementById("view-loading"),
    error: document.getElementById("view-error"),
    categories: document.getElementById("view-categories"),
    detail: document.getElementById("view-category-detail"),
    search: document.getElementById("view-search"),
  },
  loadingLabel: document.getElementById("loading-label"),
  errorLabel: document.getElementById("error-label"),
  retryBtn: document.getElementById("retry-btn"),

  breadcrumbCategories: document.getElementById("breadcrumb-categories"),
  categoriesEyebrow: document.getElementById("categories-eyebrow"),
  categoriesTitle: document.getElementById("categories-title"),
  categoryGrid: document.getElementById("category-grid"),

  breadcrumbDetail: document.getElementById("breadcrumb-detail"),
  backBtn: document.getElementById("back-btn"),
  detailTitle: document.getElementById("detail-title"),
  detailCount: document.getElementById("detail-count"),
  thumbGrid: document.getElementById("thumb-grid"),

  searchForm: document.getElementById("search-form"),
  searchInput: document.getElementById("search-input"),
  searchClear: document.getElementById("search-clear"),
  searchGrid: document.getElementById("search-grid"),
  searchEyebrow: document.getElementById("search-eyebrow"),
  searchTitle: document.getElementById("search-title"),

  lightbox: document.getElementById("lightbox"),
  lightboxImg: document.getElementById("lightbox-img"),
  lightboxCaption: document.getElementById("lightbox-caption"),
  lightboxClose: document.getElementById("lightbox-close"),
  lightboxPrev: document.getElementById("lightbox-prev"),
  lightboxNext: document.getElementById("lightbox-next"),
  lightboxDownload: document.getElementById("lightbox-download"),
  lightboxShare: document.getElementById("lightbox-share"),
  lightboxNameText: document.getElementById("lightbox-name-text"),
  lightboxLocationCell: document.getElementById("lightbox-location-cell"),
  lightboxLocationText: document.getElementById("lightbox-location-text"),
  lightboxNoteCell: document.getElementById("lightbox-note-cell"),
  lightboxNoteText: document.getElementById("lightbox-note-text"),

  toast: document.getElementById("toast"),
};

function showView(name) {
  Object.values(el.views).forEach((v) => v.classList.add("hidden"));
  el.views[name].classList.remove("hidden");
}

function showError(message) {
  el.errorLabel.textContent = message;
  showView("error");
}

function showToast(message) {
  el.toast.textContent = message;
  el.toast.classList.remove("hidden");
  clearTimeout(showToast._t);
  showToast._t = setTimeout(() => el.toast.classList.add("hidden"), 2500);
}

// -------------------- Start --------------------

window.addEventListener("load", () => {
  el.retryBtn.addEventListener("click", () => loadFolder(currentPath));
  el.backBtn.addEventListener("click", () => loadFolder(currentPath.slice(0, -1)));

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
    const file = currentImages[currentLightboxIndex];
    if (!file) return;
    window.location.href = `/api/download?id=${file.id}`;
  });
  el.lightboxShare.addEventListener("click", (e) => {
    e.stopPropagation();
    shareCurrentImage();
  });

  document.addEventListener("keydown", (e) => {
    if (el.lightbox.classList.contains("hidden")) return;
    if (e.key === "ArrowLeft") showPrevImage();
    else if (e.key === "ArrowRight") showNextImage();
    else if (e.key === "Escape") closeLightbox();
    else if (e.key === "Tab") trapFocusInLightbox(e);
  });

  el.searchForm.addEventListener("submit", (e) => e.preventDefault());
  el.searchInput.addEventListener("input", () => {
    const q = el.searchInput.value.trim();
    el.searchClear.classList.toggle("hidden", q.length === 0);
    clearTimeout(searchDebounceTimer);
    if (q.length === 0) {
      exitSearch();
      return;
    }
    searchDebounceTimer = setTimeout(() => runSearch(q), 400);
  });
  el.searchClear.addEventListener("click", () => {
    el.searchInput.value = "";
    el.searchClear.classList.add("hidden");
    exitSearch();
  });

  init();
});

async function init() {
  await loadFolder([]);

  const sharedId = new URLSearchParams(window.location.search).get("bild");
  if (sharedId) {
    openSharedImage(sharedId);
  }
}

// Hält den Tastaturfokus innerhalb der geöffneten Lightbox (Focus-Trap).
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
  const link = item.thumbnailLink || item.coverThumbnailLink;
  if (!link) return null;
  return link.replace(/=s\d+/, `=s${size}`);
}

function setImageWithFallback(imgEl, item, size, isImageFile = true) {
  const thumbUrl = getThumbnailUrl(item, size);
  if (!thumbUrl) {
    if (isImageFile) imgEl.src = `/api/download?id=${item.id}&inline=1`;
    return;
  }
  imgEl.src = thumbUrl;
  imgEl.onerror = () => {
    imgEl.onerror = null;
    if (isImageFile) imgEl.src = `/api/download?id=${item.id}&inline=1`;
    else imgEl.style.display = "none";
  };
}

function getLocation(file) {
  const loc = file.imageMediaMetadata && file.imageMediaMetadata.location;
  if (!loc || typeof loc.latitude !== "number" || typeof loc.longitude !== "number") {
    return null;
  }
  return { lat: loc.latitude, lng: loc.longitude };
}

// -------------------- Breadcrumb --------------------

function renderBreadcrumb(navEl, path, onNavigate) {
  navEl.innerHTML = "";

  const rootCrumb = document.createElement(path.length === 0 ? "span" : "a");
  rootCrumb.textContent = "Kategorien";
  rootCrumb.className = "breadcrumb-item";
  if (path.length > 0) {
    rootCrumb.href = "#";
    rootCrumb.addEventListener("click", (e) => {
      e.preventDefault();
      onNavigate([]);
    });
  } else {
    rootCrumb.setAttribute("aria-current", "page");
  }
  navEl.appendChild(rootCrumb);

  path.forEach((entry, i) => {
    const sep = document.createElement("span");
    sep.className = "breadcrumb-sep";
    sep.textContent = "›";
    navEl.appendChild(sep);

    const isLast = i === path.length - 1;
    const crumb = document.createElement(isLast ? "span" : "a");
    crumb.textContent = entry.name;
    crumb.className = "breadcrumb-item";
    if (!isLast) {
      crumb.href = "#";
      crumb.addEventListener("click", (e) => {
        e.preventDefault();
        onNavigate(path.slice(0, i + 1));
      });
    } else {
      crumb.setAttribute("aria-current", "page");
    }
    navEl.appendChild(crumb);
  });
}

// -------------------- Kategorien / Unterkategorien --------------------

async function loadFolder(path) {
  currentPath = path;
  el.loadingLabel.textContent = "Wird geladen …";
  showView("loading");

  try {
    const parentId = path.length ? path[path.length - 1].id : null;
    const url = parentId ? `/api/categories?id=${parentId}` : "/api/categories";
    const res = await fetch(url);
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Kategorien konnten nicht geladen werden.");
    const categories = data.categories || [];

    if (categories.length === 0) {
      showError(
        path.length === 0
          ? "Es wurden noch keine Kategorien gefunden."
          : "Diese Kategorie ist noch leer."
      );
      return;
    }

    renderBreadcrumb(el.breadcrumbCategories, path, loadFolder);
    el.categoriesEyebrow.textContent = path.length ? "Unterkategorien" : "Kategorien";
    el.categoriesTitle.textContent = path.length ? path[path.length - 1].name : "Kategorien";

    el.categoryGrid.innerHTML = "";
    showView("categories");

    categories.forEach((cat) => {
      const card = document.createElement("div");
      card.className = "category-card";
      card.setAttribute("role", "button");
      card.setAttribute("tabindex", "0");
      card.setAttribute("aria-label", `Kategorie ${cat.name} öffnen`);

      const openThis = () => {
        const newPath = [...path, { id: cat.id, name: cat.name }];
        if (cat.hasSubcategories) loadFolder(newPath);
        else loadLeaf(newPath);
      };
      card.addEventListener("click", openThis);
      card.addEventListener("keydown", (e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          openThis();
        }
      });

      if (cat.coverThumbnailLink) {
        const img = document.createElement("img");
        img.alt = cat.name;
        setImageWithFallback(img, cat, 500, false);
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

// -------------------- Blatt-Kategorie (Bilder) --------------------

async function loadLeaf(path) {
  currentPath = path;
  const folder = path[path.length - 1];
  el.loadingLabel.textContent = `„${folder.name}“ wird geöffnet …`;
  showView("loading");

  try {
    const res = await fetch(`/api/category?id=${folder.id}`);
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Kategorie konnte nicht geladen werden.");
    const images = data.images || [];

    currentImages = images;
    currentImagesLabel = folder.name;

    renderBreadcrumb(el.breadcrumbDetail, path, loadFolder);
    el.backBtn.textContent =
      path.length >= 2 ? `← Zurück zu „${path[path.length - 2].name}“` : "← Alle Kategorien";
    el.detailTitle.textContent = folder.name;
    el.detailCount.textContent = `${images.length} Bild${images.length === 1 ? "" : "er"}`;
    el.thumbGrid.innerHTML = "";
    showView("detail");

    images.forEach((file, index) => {
      el.thumbGrid.appendChild(buildThumb(file, index, images, folder.name));
    });
  } catch (e) {
    showError(e.message || "Fehler beim Laden der Kategorie.");
  }
}

function buildThumb(file, index, imagesArray, labelForAlt) {
  const thumb = document.createElement("div");
  thumb.className = "thumb";
  thumb.setAttribute("role", "button");
  thumb.setAttribute("tabindex", "0");
  thumb.setAttribute(
    "aria-label",
    `${labelForAlt}, Bild ${index + 1} von ${imagesArray.length} vergrößern`
  );
  const open = () => {
    currentImages = imagesArray;
    currentImagesLabel = labelForAlt;
    openLightbox(index);
  };
  thumb.addEventListener("click", open);
  thumb.addEventListener("keydown", (e) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      open();
    }
  });

  const img = document.createElement("img");
  img.alt = `${labelForAlt}, Bild ${index + 1} von ${imagesArray.length}`;
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

  if (file.breadcrumb) {
    const tag = document.createElement("span");
    tag.className = "thumb-breadcrumb";
    tag.textContent = file.breadcrumb.join(" › ");
    thumb.appendChild(tag);
  }

  return thumb;
}

// -------------------- Suche --------------------

function runSearch(q) {
  if (!preSearchState) {
    preSearchState = {
      path: currentPath.slice(),
      wasLeaf: !el.views.detail.classList.contains("hidden"),
    };
  }
  doSearch(q);
}

async function doSearch(q) {
  el.searchEyebrow.textContent = "Suche";
  el.searchTitle.textContent = `Suche nach „${q}“`;
  el.searchGrid.innerHTML = "";
  showView("search");

  try {
    const res = await fetch(`/api/search?q=${encodeURIComponent(q)}`);
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Suche fehlgeschlagen.");
    const results = data.results || [];

    currentImages = results;
    currentImagesLabel = "Suchergebnisse";

    if (results.length === 0) {
      el.searchGrid.innerHTML = `<p class="status-text">Keine Treffer für „${escapeHtml(q)}“.</p>`;
      return;
    }

    results.forEach((file, index) => {
      const label = file.breadcrumb ? file.breadcrumb.join(" › ") : "Suchergebnis";
      el.searchGrid.appendChild(buildThumb(file, index, results, label));
    });
  } catch (e) {
    el.searchGrid.innerHTML = `<p class="status-text error-text">${escapeHtml(
      e.message || "Suche fehlgeschlagen."
    )}</p>`;
  }
}

function exitSearch() {
  if (preSearchState) {
    const { path, wasLeaf } = preSearchState;
    preSearchState = null;
    if (wasLeaf && path.length > 0) loadLeaf(path);
    else loadFolder(path);
  } else {
    loadFolder(currentPath);
  }
}

// -------------------- Teilen-Link öffnen --------------------

async function openSharedImage(fileId) {
  try {
    const res = await fetch(`/api/image?id=${fileId}`);
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);
    currentImages = data.images || [];
    currentImagesLabel = "Geteiltes Bild";
    if (data.index >= 0) openLightbox(data.index);
  } catch (e) {
    showToast("Geteiltes Bild konnte nicht geladen werden.");
  }
}

function shareCurrentImage() {
  const file = currentImages[currentLightboxIndex];
  if (!file) return;
  const url = `${window.location.origin}${window.location.pathname}?bild=${file.id}`;

  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard
      .writeText(url)
      .then(() => showToast("Link kopiert!"))
      .catch(() => promptShareUrl(url));
  } else {
    promptShareUrl(url);
  }
}

function promptShareUrl(url) {
  window.prompt("Link zum Kopieren:", url);
}

// -------------------- Lightbox --------------------

function openLightbox(index) {
  currentLightboxIndex = index;
  const file = currentImages[index];
  if (!file) return;

  lightboxTriggerEl = document.activeElement;
  el.lightbox.classList.remove("hidden");
  el.lightboxClose.focus();
  updateLightboxNavButtons();

  setImageWithFallback(el.lightboxImg, file, 1600);
  el.lightboxImg.alt = `${currentImagesLabel}, Bild ${index + 1} von ${currentImages.length}`;
  el.lightboxCaption.textContent = `${index + 1} / ${currentImages.length}`;
  el.lightboxNameText.textContent = file.name;

  const loc = getLocation(file);
  if (loc) {
    const countrySuffix = file.country ? ` · ${file.country}` : "";
    el.lightboxLocationText.textContent = `${loc.lat.toFixed(5)}, ${loc.lng.toFixed(5)}${countrySuffix}`;
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

  const url = new URL(window.location.href);
  url.searchParams.set("bild", file.id);
  window.history.replaceState(null, "", url);
}

function showPrevImage() {
  if (currentLightboxIndex > 0) openLightbox(currentLightboxIndex - 1);
}

function showNextImage() {
  if (currentLightboxIndex < currentImages.length - 1) {
    openLightbox(currentLightboxIndex + 1);
  }
}

function updateLightboxNavButtons() {
  el.lightboxPrev.classList.toggle("hidden", currentLightboxIndex <= 0);
  el.lightboxNext.classList.toggle(
    "hidden",
    currentLightboxIndex >= currentImages.length - 1
  );
}

function closeLightbox() {
  el.lightbox.classList.add("hidden");
  currentLightboxIndex = -1;
  if (lightboxTriggerEl && typeof lightboxTriggerEl.focus === "function") {
    lightboxTriggerEl.focus();
  }
  lightboxTriggerEl = null;

  const url = new URL(window.location.href);
  url.searchParams.delete("bild");
  window.history.replaceState(null, "", url);
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}
