// ============================================================
// Fotogalerie — Google Drive als Kategorien-Backend
// ============================================================

const DRIVE_API = "https://www.googleapis.com/drive/v3/files";
const SCOPE = "https://www.googleapis.com/auth/drive.readonly";

let accessToken = null;
let tokenClient = null;
let objectUrls = []; // zum Aufräumen bei Ansichtswechsel

// -------------------- Elemente --------------------
const el = {
  signinBtn: document.getElementById("signin-btn"),
  signoutBtn: document.getElementById("signout-btn"),
  views: {
    signedout: document.getElementById("view-signedout"),
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

// Bilder der aktuell geöffneten Kategorie + Position für die Lightbox-Navigation
let currentCategoryImages = [];
let currentLightboxIndex = -1;
let lightboxTriggerEl = null; // Element, das die Lightbox geöffnet hat (für Fokus-Rückgabe)
const blobUrlCache = new Map(); // fileId -> objectURL, vermeidet erneutes Laden beim Blättern

function showView(name) {
  Object.values(el.views).forEach((v) => v.classList.add("hidden"));
  el.views[name].classList.remove("hidden");
}

function showError(message) {
  el.errorLabel.textContent = message;
  showView("error");
}

// -------------------- Auth --------------------

window.addEventListener("load", () => {
  // Wartet bis die Google Identity Services Bibliothek geladen ist.
  const waitForGis = setInterval(() => {
    if (window.google && google.accounts && google.accounts.oauth2) {
      clearInterval(waitForGis);
      initAuth();
    }
  }, 100);
});

function initAuth() {
  tokenClient = google.accounts.oauth2.initTokenClient({
    client_id: CONFIG.CLIENT_ID,
    scope: SCOPE,
    callback: (response) => {
      if (response.error) {
        showError("Anmeldung fehlgeschlagen: " + response.error);
        return;
      }
      accessToken = response.access_token;
      el.signinBtn.classList.add("hidden");
      el.signoutBtn.classList.remove("hidden");
      loadCategories();
    },
  });

  el.signinBtn.addEventListener("click", () => {
    tokenClient.requestAccessToken({ prompt: "" });
  });

  el.signoutBtn.addEventListener("click", () => {
    if (accessToken) {
      google.accounts.oauth2.revoke(accessToken, () => {});
    }
    accessToken = null;
    el.signoutBtn.classList.add("hidden");
    el.signinBtn.classList.remove("hidden");
    showView("signedout");
  });

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
  el.lightboxDownload.addEventListener("click", async (e) => {
    e.stopPropagation();
    const file = currentCategoryImages[currentLightboxIndex];
    if (!file) return;
    el.lightboxDownload.disabled = true;
    el.lightboxDownload.textContent = "Wird vorbereitet …";
    const ok = await downloadOriginal(file);
    el.lightboxDownload.disabled = false;
    el.lightboxDownload.textContent = ok
      ? "⬇ Original herunterladen"
      : "Download fehlgeschlagen — erneut versuchen";
  });

  document.addEventListener("keydown", (e) => {
    if (el.lightbox.classList.contains("hidden")) return;
    if (e.key === "ArrowLeft") showPrevImage();
    else if (e.key === "ArrowRight") showNextImage();
    else if (e.key === "Escape") closeLightbox();
    else if (e.key === "Tab") trapFocusInLightbox(e);
  });
}

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

// -------------------- Drive-Hilfsfunktionen --------------------

async function driveFetch(url) {
  const res = await fetch(url, {
    headers: { Authorization: "Bearer " + accessToken },
  });
  if (!res.ok) {
    if (res.status === 401 || res.status === 403) {
      throw new Error(
        "Zugriff abgelehnt. Bitte erneut anmelden (Sitzung evtl. abgelaufen)."
      );
    }
    throw new Error("Google Drive Anfrage fehlgeschlagen (" + res.status + ")");
  }
  return res.json();
}

async function fetchImageBlobUrl(fileId) {
  const cacheKey = "full:" + fileId;
  if (blobUrlCache.has(cacheKey)) return blobUrlCache.get(cacheKey);

  const res = await fetch(`${DRIVE_API}/${fileId}?alt=media`, {
    headers: { Authorization: "Bearer " + accessToken },
  });
  if (!res.ok) return null;
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  objectUrls.push(url);
  blobUrlCache.set(cacheKey, url);
  return url;
}

// Liefert die von Google Drive verkleinerte Vorschau-URL (kein extra Request
// nötig — wird direkt als img.src verwendet). null, falls keine Vorschau
// vorhanden ist; dann muss auf das Original zurückgefallen werden.
function getThumbnailUrl(file, size) {
  if (!file.thumbnailLink) return null;
  return file.thumbnailLink.replace(/=s\d+/, `=s${size}`);
}

// Setzt img.src auf die Vorschau; falls das Laden fehlschlägt (z.B. Link
// abgelaufen), wird automatisch auf das Original zurückgefallen.
function setImageWithFallback(imgEl, file, size) {
  const thumbUrl = getThumbnailUrl(file, size);
  if (!thumbUrl) {
    fetchImageBlobUrl(file.id).then((url) => {
      if (url) imgEl.src = url;
    });
    return;
  }
  imgEl.src = thumbUrl;
  imgEl.onerror = () => {
    imgEl.onerror = null;
    fetchImageBlobUrl(file.id).then((url) => {
      if (url) imgEl.src = url;
    });
  };
}

function getLocation(file) {
  const loc = file.imageMediaMetadata && file.imageMediaMetadata.location;
  if (!loc || typeof loc.latitude !== "number" || typeof loc.longitude !== "number") {
    return null;
  }
  return { lat: loc.latitude, lng: loc.longitude };
}

async function downloadOriginal(file) {
  const url = await fetchImageBlobUrl(file.id);
  if (!url) return false;
  const a = document.createElement("a");
  a.href = url;
  a.download = file.name || "foto.jpg";
  document.body.appendChild(a);
  a.click();
  a.remove();
  return true;
}

function releaseObjectUrls() {
  objectUrls.forEach((u) => URL.revokeObjectURL(u));
  objectUrls = [];
  blobUrlCache.clear();
}

async function resolveRootFolderId() {
  if (CONFIG.ROOT_FOLDER_ID) return CONFIG.ROOT_FOLDER_ID;

  const q = encodeURIComponent(
    `name='${CONFIG.ROOT_FOLDER_NAME}' and mimeType='application/vnd.google-apps.folder' and trashed=false`
  );
  const data = await driveFetch(`${DRIVE_API}?q=${q}&fields=files(id,name)&pageSize=1`);
  if (!data.files || data.files.length === 0) {
    throw new Error(
      `Ordner "${CONFIG.ROOT_FOLDER_NAME}" wurde in Google Drive nicht gefunden. Prüfe den Namen in config.js oder lege den Ordner an.`
    );
  }
  return data.files[0].id;
}

async function listSubfolders(parentId) {
  const q = encodeURIComponent(
    `'${parentId}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false`
  );
  const data = await driveFetch(
    `${DRIVE_API}?q=${q}&fields=files(id,name)&orderBy=name&pageSize=200`
  );
  return data.files || [];
}

async function listImagesInFolder(folderId) {
  let files = [];
  let pageToken = null;
  const q = encodeURIComponent(
    `'${folderId}' in parents and mimeType contains 'image/' and trashed=false`
  );
  do {
    const url =
      `${DRIVE_API}?q=${q}&fields=nextPageToken,files(id,name,description,thumbnailLink,imageMediaMetadata(location))` +
      `&orderBy=name&pageSize=1000` +
      (pageToken ? `&pageToken=${pageToken}` : "");
    const data = await driveFetch(url);
    files = files.concat(data.files || []);
    pageToken = data.nextPageToken || null;
  } while (pageToken);
  return files;
}

// -------------------- Kategorien-Ansicht --------------------

async function loadCategories() {
  releaseObjectUrls();
  el.loadingLabel.textContent = "Kategorien werden geladen …";
  showView("loading");

  try {
    const rootId = await resolveRootFolderId();
    const folders = await listSubfolders(rootId);

    if (folders.length === 0) {
      showError(
        `Der Ordner "${CONFIG.ROOT_FOLDER_NAME}" enthält noch keine Unterordner. Lege dort einen Ordner pro Kategorie an und fülle ihn mit Bildern.`
      );
      return;
    }

    el.categoryGrid.innerHTML = "";
    showView("categories");

    // Karten sofort mit Platzhalter anzeigen, Titelbilder danach nachladen
    folders.forEach((folder) => {
      const card = document.createElement("div");
      card.className = "category-card placeholder";
      card.dataset.folderId = folder.id;
      card.setAttribute("role", "button");
      card.setAttribute("tabindex", "0");
      card.setAttribute("aria-label", `Kategorie ${folder.name} öffnen`);
      card.innerHTML = `<span>${escapeHtml(folder.name)} — lädt …</span>`;
      card.addEventListener("click", () => openCategory(folder.id, folder.name));
      card.addEventListener("keydown", (e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          openCategory(folder.id, folder.name);
        }
      });
      el.categoryGrid.appendChild(card);
    });

    for (const folder of folders) {
      const card = el.categoryGrid.querySelector(
        `[data-folder-id="${folder.id}"]`
      );
      try {
        const images = await listImagesInFolder(folder.id);
        card.classList.remove("placeholder");
        card.innerHTML = "";

        if (images.length > 0) {
          const img = document.createElement("img");
          img.alt = folder.name;
          setImageWithFallback(img, images[0], 500);
          card.appendChild(img);
        }

        const plaque = document.createElement("div");
        plaque.className = "plaque";
        plaque.innerHTML = `
          <p class="plaque-name">${escapeHtml(folder.name)}</p>
          <p class="plaque-count">${images.length} Bild${images.length === 1 ? "" : "er"}</p>
        `;
        card.appendChild(plaque);
        card.dataset.count = images.length;
      } catch (e) {
        card.innerHTML = `<span>${escapeHtml(folder.name)} — Fehler beim Laden</span>`;
      }
    }
  } catch (e) {
    showError(e.message || "Unbekannter Fehler beim Laden der Kategorien.");
  }
}

// -------------------- Kategorie-Detail-Ansicht --------------------

async function openCategory(folderId, folderName) {
  releaseObjectUrls();
  el.loadingLabel.textContent = `„${folderName}“ wird geöffnet …`;
  showView("loading");

  try {
    const images = await listImagesInFolder(folderId);
    currentCategoryImages = images;
    el.detailTitle.textContent = folderName;
    el.detailCount.textContent = `${images.length} Bild${images.length === 1 ? "" : "er"}`;
    el.thumbGrid.innerHTML = "";
    showView("detail");

    images.forEach((file, index) => {
      const thumb = document.createElement("div");
      thumb.className = "thumb placeholder";
      thumb.setAttribute("role", "button");
      thumb.setAttribute("tabindex", "0");
      thumb.setAttribute(
        "aria-label",
        `${folderName}, Bild ${index + 1} von ${images.length} vergrößern`
      );
      thumb.innerHTML = `<span>lädt …</span>`;
      thumb.addEventListener("click", () => openLightbox(index));
      thumb.addEventListener("keydown", (e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          openLightbox(index);
        }
      });
      el.thumbGrid.appendChild(thumb);

      thumb.classList.remove("placeholder");
      thumb.innerHTML = "";
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
    });
  } catch (e) {
    showError(e.message || "Fehler beim Laden der Kategorie.");
  }
}

// -------------------- Lightbox --------------------

async function openLightbox(index) {
  currentLightboxIndex = index;
  const file = currentCategoryImages[index];
  if (!file) return;

  lightboxTriggerEl = document.activeElement;
  el.lightbox.classList.remove("hidden");
  el.lightboxClose.focus();
  updateLightboxNavButtons();
  el.lightboxImg.src = "";
  el.lightboxCaption.textContent = "lädt …";
  el.lightboxDownload.disabled = false;
  el.lightboxDownload.textContent = "⬇ Original herunterladen";
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
