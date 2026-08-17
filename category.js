// Listet alle Bilder einer (Unter-)Kategorie inkl. Vorschau, GPS, Land und
// Bemerkung. Wird für jede "Blatt"-Kategorie aufgerufen (also einen Ordner
// ohne eigene Unterkategorien).
const { listImagesInFolder } = require("./_drive");
const { countryFromLocation } = require("./_geo");

module.exports = async (req, res) => {
  const folderId = req.query.id;
  if (!folderId) {
    res.status(400).json({ error: "Parameter 'id' fehlt." });
    return;
  }

  try {
    const files = await listImagesInFolder(folderId);
    const images = files.map((f) => ({
      ...f,
      country: countryFromLocation(f.imageMediaMetadata && f.imageMediaMetadata.location),
    }));

    res.setHeader("Cache-Control", "s-maxage=60, stale-while-revalidate=300");
    res.status(200).json({ images });
  } catch (err) {
    res.status(500).json({ error: err.message || "Unbekannter Fehler" });
  }
};
