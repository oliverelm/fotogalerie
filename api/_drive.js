// Gemeinsamer Helfer für alle /api-Funktionen.
// Tauscht den in Vercel hinterlegten Refresh-Token gegen ein kurzlebiges
// Zugriffstoken und ruft damit die Google Drive API auf. Läuft ausschließlich
// server-seitig — Client-ID, Client-Secret und Refresh-Token verlassen diesen
// Code niemals in Richtung Browser.

const DRIVE_API = "https://www.googleapis.com/drive/v3/files";

async function getAccessToken() {
  const { GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REFRESH_TOKEN } =
    process.env;

  if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET || !GOOGLE_REFRESH_TOKEN) {
    throw new Error(
      "Server ist nicht konfiguriert: GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET " +
        "oder GOOGLE_REFRESH_TOKEN fehlt als Umgebungsvariable."
    );
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
  return data.access_token;
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

module.exports = { DRIVE_API, getAccessToken, driveFetch, resolveRootFolderId };
