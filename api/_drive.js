// Gemeinsamer Helfer für alle /api-Funktionen.
// Tauscht den in Vercel hinterlegten Refresh-Token gegen ein kurzlebiges
// Zugriffstoken und ruft damit die Google Drive API auf. Läuft ausschließlich
// server-seitig — Client-ID, Client-Secret und Refresh-Token verlassen diesen
// Code niemals in Richtung Browser.

const DRIVE_API = "https://www.googleapis.com/drive/v3/files";

// Einfacher Zwischenspeicher fürs Zugriffstoken: läuft ein Aufruf über viele
// Bilder (z.B. Foto-Metadaten für eine ganze Kategorie), reicht ein einziges
// Token für alle — spart unnötige, langsame Token-Erneuerungen bei Google.
let cachedAccessToken = null;
let cachedAccessTokenExpiry = 0;

async function getAccessToken() {
  const { GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REFRESH_TOKEN } =
    process.env;

  if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET || !GOOGLE_REFRESH_TOKEN) {
    throw new Error(
      "Server ist nicht konfiguriert: GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET " +
        "oder GOOGLE_REFRESH_TOKEN fehlt als Umgebungsvariable."
    );
  }

  if (cachedAccessToken && Date.now() < cachedAccessTokenExpiry) {
    return cachedAccessToken;
  }

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: GOOGLE_CLIENT_ID,
      client_secret: GOOGLE_CLIENT_SECRET,
      refresh_token: GOOGLE_REFRESH_TOKEN,
      grant_type: "refresh_token",
    }),
  });

  if (!res.ok) {
    const detail = await res.text();
    throw new Error("Token-Erneuerung fehlgeschlagen: " + detail);
  }

  const data = await res.json();
  cachedAccessToken = data.access_token;
  // Etwas Sicherheitsabstand (60s) vor der tatsächlichen Ablaufzeit einplanen.
  cachedAccessTokenExpiry = Date.now() + Math.max(0, (data.expires_in || 3600) - 60) * 1000;
  return cachedAccessToken;
}

async function driveFetch(url) {
  const accessToken = await getAccessToken();
  const res = await fetch(url, {
    headers: { Authorization: "Bearer " + accessToken },
  });
  if (!res.ok) {
    const detail = await res.text();
    throw new Error(`Drive-Anfrage fehlgeschlagen (${res.status}): ${detail}`);
  }
  return res.json();
}

async function resolveRootFolderId() {
  const { DRIVE_ROOT_FOLDER_ID, DRIVE_ROOT_FOLDER_NAME } = process.env;
  if (DRIVE_ROOT_FOLDER_ID) return DRIVE_ROOT_FOLDER_ID;

  const rootName = DRIVE_ROOT_FOLDER_NAME || "Fotowebseite";
  const q = encodeURIComponent(
    `name='${rootName}' and mimeType='application/vnd.google-apps.folder' and trashed=false`
  );
  const data = await driveFetch(`${DRIVE_API}?q=${q}&fields=files(id,name)&pageSize=1`);
  if (!data.files || data.files.length === 0) {
    throw new Error(`Ordner "${rootName}" wurde in Google Drive nicht gefunden.`);
  }
  return data.files[0].id;
}

const IMAGE_FIELDS = "id,name,description,thumbnailLink,imageMediaMetadata(location)";

// Listet die direkten Unterordner eines Ordners.
async function listSubfolders(parentId) {
  const q = encodeURIComponent(
    `'${parentId}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false`
  );
  const data = await driveFetch(
    `${DRIVE_API}?q=${q}&fields=files(id,name)&orderBy=name&pageSize=200`
  );
  return data.files || [];
}

// Listet alle Bilder direkt in einem Ordner (mit Beschreibung + GPS, für die
// eigentliche Bildanzeige). Holt bei Bedarf mehrere Seiten.
async function listImagesInFolder(folderId) {
  let files = [];
  let pageToken = null;
  const q = encodeURIComponent(
    `'${folderId}' in parents and mimeType contains 'image/' and trashed=false`
  );
  do {
    const url =
      `${DRIVE_API}?q=${q}&fields=nextPageToken,files(${IMAGE_FIELDS})` +
      `&orderBy=name&pageSize=1000` +
      (pageToken ? `&pageToken=${pageToken}` : "");
    const data = await driveFetch(url);
    files = files.concat(data.files || []);
    pageToken = data.nextPageToken || null;
  } while (pageToken);
  return files;
}

// Baut für eine Kategorie- oder Unterkategorie-Ansicht die Kachel-Karten:
// für jeden Unterordner wird geprüft, ob er SELBST wieder Unterordner hat
// (dann ist es eine Kategorie mit weiteren Unterkategorien) oder Bilder
// enthält (dann ist es eine "Blatt"-Kategorie). Funktioniert rekursiv für
// beliebig viele Verschachtelungsebenen.
async function buildFolderCards(parentId) {
  const subfolders = await listSubfolders(parentId);

  return Promise.all(
    subfolders.map(async (folder) => {
      const [childSubfolders, images] = await Promise.all([
        listSubfolders(folder.id),
        listImagesInFolder(folder.id),
      ]);

      if (childSubfolders.length > 0) {
        // Hat selbst Unterkategorien: Anzahl/Titelbild aus den Unterkategorien
        // ableiten — alle gleichzeitig abfragen statt nacheinander.
        const subImagesLists = await Promise.all(
          childSubfolders.map((sub) => listImagesInFolder(sub.id))
        );
        let count = images.length;
        let cover = images[0] ? images[0].thumbnailLink : null;
        for (const subImages of subImagesLists) {
          count += subImages.length;
          if (!cover && subImages[0]) cover = subImages[0].thumbnailLink;
        }
        return {
          id: folder.id,
          name: folder.name,
          count,
          coverThumbnailLink: cover,
          hasSubcategories: true,
        };
      }

      return {
        id: folder.id,
        name: folder.name,
        count: images.length,
        coverThumbnailLink: images[0] ? images[0].thumbnailLink : null,
        hasSubcategories: false,
      };
    })
  );
}

// Durchsucht rekursiv den kompletten Baum ab einem Ordner und gibt alle
// gefundenen Bilder zurück, jeweils mit dem Kategorie-Pfad (Breadcrumb).
async function crawlTree(folderId, breadcrumb) {
  const [subfolders, images] = await Promise.all([
    listSubfolders(folderId),
    listImagesInFolder(folderId),
  ]);

  let results = images.map((img) => ({ ...img, breadcrumb }));

  if (subfolders.length > 0) {
    const nested = await Promise.all(
      subfolders.map((f) => crawlTree(f.id, [...breadcrumb, f.name]))
    );
    for (const arr of nested) results = results.concat(arr);
  }

  return results;
}

// Löst für eine beliebige Ordner-ID den kompletten Pfad ab der obersten
// Kategorie auf (für Kategorie-Teilen-Links). Läuft von der Ziel-ID aus
// über die Drive-"parents" nach oben, bis der Wurzelordner erreicht ist.
async function resolvePathToFolder(folderId) {
  const rootId = await resolveRootFolderId();
  const path = [];
  let currentId = folderId;

  while (currentId && currentId !== rootId) {
    const meta = await driveFetch(
      `${DRIVE_API}/${currentId}?fields=id,name,parents`
    );
    path.unshift({ id: meta.id, name: meta.name });
    currentId = meta.parents && meta.parents[0];
  }

  return path;
}

// Liest eine optionale Orts-Beschreibung: eine Textdatei namens exakt
// "beschreibung.txt", die direkt in einem Kategorie-/Unterkategorie-Ordner
// liegt. Gibt den Textinhalt zurück, oder null, falls keine vorhanden ist.
async function getFolderNote(folderId) {
  const q = encodeURIComponent(
    `'${folderId}' in parents and name='beschreibung.txt' and trashed=false`
  );
  const data = await driveFetch(`${DRIVE_API}?q=${q}&fields=files(id)&pageSize=1`);
  const file = data.files && data.files[0];
  if (!file) return null;

  const accessToken = await getAccessToken();
  const res = await fetch(`${DRIVE_API}/${file.id}?alt=media`, {
    headers: { Authorization: "Bearer " + accessToken },
  });
  if (!res.ok) return null;
  const text = await res.text();
  return text.trim() || null;
}

module.exports = {
  DRIVE_API,
  IMAGE_FIELDS,
  getAccessToken,
  driveFetch,
  resolveRootFolderId,
  listSubfolders,
  listImagesInFolder,
  buildFolderCards,
  crawlTree,
  resolvePathToFolder,
  getFolderNote,
};
