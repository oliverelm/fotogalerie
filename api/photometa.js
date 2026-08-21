// Liest Titel, Bildunterschrift und Schlagworte direkt aus den IPTC/XMP-
// Metadaten einer Bilddatei (z.B. von Adobe Lightroom eingetragen). Google
// Drive selbst kennt diese Felder nicht — wir müssen dafür (einen kleinen
// Teil) der eigentlichen Datei lesen.
//
// Aus Performance-Gründen wird nur der Dateianfang angefragt (per HTTP-
// Range-Header) — IPTC/XMP-Daten stehen bei JPEGs immer ganz am Anfang,
// ein kompletter Download ist dafür nicht nötig.

const exifr = require("exifr");
const { DRIVE_API, getAccessToken } = require("./_drive");

const PARTIAL_BYTES = 262144; // 256 KB reichen für IPTC/XMP-Header üblicher JPEGs

// IPTC-Textfelder sind eigentlich UTF-8, werden aber von der Bibliothek als
// älteres Latin-1 gelesen — das ergibt vertauschte Umlaute wie "Ã¼" statt "ü".
// Hier rückgängig gemacht: Zeichen zurück in Rohbytes wandeln und korrekt als
// UTF-8 neu interpretieren. Mit Sicherheitsprüfung, damit echter Text (der
// diese Verwechslung nicht hatte) nie kaputt gemacht wird.
function repairIptcEncoding(str) {
  if (!str || !/[\u0080-\uffff]/.test(str)) return str;
  try {
    const reDecoded = Buffer.from(str, "latin1").toString("utf8");
    if (!reDecoded.includes("\ufffd")) return reDecoded;
  } catch {
    // Ignorieren — Originaltext wird unten zurückgegeben.
  }
  return str;
}

function normalizeValue(val) {
  if (val == null) return null;
  if (typeof val === "string") {
    const trimmed = repairIptcEncoding(val).trim();
    return trimmed || null;
  }
  if (Array.isArray(val)) {
    return val.length ? normalizeValue(val[0]) : null;
  }
  if (typeof val === "object") {
    // XMP "Lang Alt"-Strukturen sehen z.B. so aus: { "x-default": "Text" }
    if (val["x-default"] != null) return normalizeValue(val["x-default"]);
    if (val.value != null) return normalizeValue(val.value);
    const values = Object.values(val);
    return values.length ? normalizeValue(values[0]) : null;
  }
  return repairIptcEncoding(String(val)).trim() || null;
}

function normalizeKeywords(val) {
  if (!val) return null;
  const arr = Array.isArray(val) ? val : [val];
  const cleaned = arr.map(normalizeValue).filter(Boolean);
  return cleaned.length ? cleaned : null;
}

async function getPhotoMeta(fileId) {
  const empty = { title: null, caption: null, keywords: null };
  try {
    const accessToken = await getAccessToken();
    const res = await fetch(`${DRIVE_API}/${fileId}?alt=media`, {
      headers: {
        Authorization: "Bearer " + accessToken,
        Range: `bytes=0-${PARTIAL_BYTES - 1}`,
      },
    });
    if (!res.ok && res.status !== 206) return empty;

    const buffer = Buffer.from(await res.arrayBuffer());

    const data = await exifr.parse(buffer, {
      iptc: true,
      xmp: true,
      tiff: false,
      exif: false,
      ifd0: false,
      gps: false,
      icc: false,
    });
    if (!data) return empty;

    const title = normalizeValue(data.ObjectName || data.title || data.Headline);
    const caption = normalizeValue(data.Caption || data["Caption-Abstract"] || data.description);
    const keywords = normalizeKeywords(data.Keywords || data.subject);

    return { title, caption, keywords };
  } catch {
    // Fehlerhafte/unvollständige Metadaten sollen die Galerie nie zum
    // Absturz bringen — im Zweifel einfach nichts anzeigen.
    return empty;
  }
}

module.exports = { getPhotoMeta };
