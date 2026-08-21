// Listet alle Bilder einer (Unter-)Kategorie inkl. Vorschau, GPS, Land und
// Bemerkung. Wird für jede "Blatt"-Kategorie aufgerufen (also einen Ordner
// ohne eigene Unterkategorien). Liefert außerdem "folderNote": eine
// optionale Orts-Beschreibung aus einer Textdatei "beschreibung.txt" direkt
// in diesem Ordner.
//
// Bewusst OHNE Foto-Titel/Bildunterschrift/Schlagworte (IPTC/XMP) — die
// werden erst bei Bedarf pro Bild über /api/photometa nachgeladen, sonst
// wäre das Laden großer Kategorien viel zu langsam.
const { listImagesInFolder, getFolderNote } = require("./_drive");
const { countryFromLocation } = require("./_geo");

module.exports = async (req, res) => {
  const folderId = req.query.id;
  if (!folderId) {
    res.status(400).json({ error: "Parameter 'id' fehlt." });
    return;
  }

  try {
    const [files, folderNote] = await Promise.all([
      listImagesInFolder(folderId),
      getFolderNote(folderId),
    ]);
    const images = files.map((f) => ({
      ...f,
      country: countryFromLocation(f.imageMediaMetadata && f.imageMediaMetadata.location),
    }));

    res.setHeader("Cache-Control", "s-maxage=60, stale-while-revalidate=300");
    res.status(200).json({ images, folderNote });
  } catch (err) {
    res.status(500).json({ error: err.message || "Unbekannter Fehler" });
  }
};
