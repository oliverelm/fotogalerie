// Liefert Titel/Bildunterschrift/Schlagworte für GENAU EIN Bild — wird erst
// abgerufen, wenn ein Bild tatsächlich in der Lightbox geöffnet wird (nicht
// beim Laden der ganzen Kategorie-Übersicht). So bleibt das Durchblättern
// vieler Kategorien/Bilder schnell, unabhängig davon, wie viele Fotos
// insgesamt in der Sammlung liegen.
const { getPhotoMeta } = require("./_photometa");

module.exports = async (req, res) => {
  const fileId = req.query.id;
  if (!fileId) {
    res.status(400).json({ error: "Parameter 'id' fehlt." });
    return;
  }

  try {
    const meta = await getPhotoMeta(fileId);
    res.setHeader("Cache-Control", "s-maxage=3600, stale-while-revalidate=86400");
    res.status(200).json(meta);
  } catch (err) {
    res.status(500).json({ error: err.message || "Unbekannter Fehler" });
  }
};
