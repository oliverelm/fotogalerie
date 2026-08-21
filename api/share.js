// Erzeugt eine kleine HTML-Seite mit korrekten Vorschau-Informationen
// (Open Graph / Twitter Card) für geteilte Bild- oder Kategorie-Links —
// damit WhatsApp, Telegram, Facebook & Co. beim Teilen eines Links ein
// echtes Vorschaubild und den richtigen Titel zeigen, statt nur "Fotogalerie".
//
// Echte Besucher werden sofort automatisch zur eigentlichen, interaktiven
// Galerie weitergeleitet (per Meta-Refresh + JavaScript) — sie sehen diese
// Zwischenseite praktisch nie, nur Vorschau-Crawler lesen ihre <head>-Daten.
const {
  DRIVE_API,
  driveFetch,
  listImagesInFolder,
  resolvePathToFolder,
} = require("./_drive");
const { getPhotoMeta } = require("./_photometa");

const SITE_NAME = "Die Welt mit meinen Augen";
const FALLBACK_DESCRIPTION = "Ein Blick. Ein Moment. Eine Geschichte.";

function escapeHtml(str) {
  return String(str || "").replace(/[&<>"']/g, (c) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  })[c]);
}

function biggerThumbnail(link) {
  if (!link) return null;
  return link.replace(/=s\d+/, "=s1200");
}

function renderHtml({ title, description, image, redirectUrl }) {
  const imageTags = image
    ? `<meta property="og:image" content="${escapeHtml(image)}">
<meta name="twitter:image" content="${escapeHtml(image)}">`
    : "";

  return `<!DOCTYPE html>
<html lang="de">
<head>
<meta charset="UTF-8">
<meta http-equiv="refresh" content="0; url=${escapeHtml(redirectUrl)}">
<title>${escapeHtml(title)}</title>
<meta property="og:type" content="website">
<meta property="og:site_name" content="${escapeHtml(SITE_NAME)}">
<meta property="og:title" content="${escapeHtml(title)}">
<meta property="og:description" content="${escapeHtml(description)}">
<meta property="og:url" content="${escapeHtml(redirectUrl)}">
${imageTags}
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${escapeHtml(title)}">
<meta name="twitter:description" content="${escapeHtml(description)}">
<link rel="canonical" href="${escapeHtml(redirectUrl)}">
</head>
<body>
  <p>Weiterleitung … <a href="${escapeHtml(redirectUrl)}">Hier klicken, falls es nicht automatisch weitergeht.</a></p>
  <script>window.location.replace(${JSON.stringify(redirectUrl)});</script>
</body>
</html>`;
}

module.exports = async (req, res) => {
  const { type, id } = req.query;
  const origin = `https://${req.headers.host}`;
  const fallbackRedirect =
    type === "kategorie"
      ? `${origin}/galerie/index.html?kategorie=${id}`
      : `${origin}/galerie/index.html?bild=${id}`;

  res.setHeader("Content-Type", "text/html; charset=utf-8");

  if (!id || (type !== "bild" && type !== "kategorie")) {
    res.status(400).send("Ungültiger Teilen-Link.");
    return;
  }

  try {
    if (type === "bild") {
      const meta = await driveFetch(`${DRIVE_API}/${id}?fields=id,name,thumbnailLink`);
      const photoMeta = await getPhotoMeta(id);

      const title = photoMeta.title || meta.name || "Foto";
      const description = photoMeta.caption || FALLBACK_DESCRIPTION;
      const image = biggerThumbnail(meta.thumbnailLink);
      const redirectUrl = `${origin}/galerie/index.html?bild=${id}`;

      res.status(200).send(
        renderHtml({ title: `${title} — ${SITE_NAME}`, description, image, redirectUrl })
      );
      return;
    }

    // type === "kategorie"
    const path = await resolvePathToFolder(id);
    const categoryName = path.length ? path[path.length - 1].name : "Kategorie";
    const images = await listImagesInFolder(id);
    const image = images[0] ? biggerThumbnail(images[0].thumbnailLink) : null;
    const description = `${images.length} Bild${images.length === 1 ? "" : "er"} in „${categoryName}“ — ${FALLBACK_DESCRIPTION}`;
    const redirectUrl = `${origin}/galerie/index.html?kategorie=${id}`;

    res.status(200).send(
      renderHtml({ title: `${categoryName} — ${SITE_NAME}`, description, image, redirectUrl })
    );
  } catch (err) {
    // Auch bei einem Fehler trotzdem sinnvoll weiterleiten — nur eben ohne
    // hübsche Vorschaudaten. Ein kaputter Teilen-Link wäre schlimmer als
    // eine fehlende Vorschau.
    res.status(200).send(
      renderHtml({
        title: SITE_NAME,
        description: FALLBACK_DESCRIPTION,
        image: null,
        redirectUrl: fallbackRedirect,
      })
    );
  }
};
