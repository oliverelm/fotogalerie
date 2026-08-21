// Listet alle Bilder einer (Unter-)Kategorie inkl. Vorschau, GPS, Land,
// Bemerkung sowie Titel/Bildunterschrift/Schlagworte aus den Foto-eigenen
// IPTC/XMP-Metadaten (z.B. von Lightroom). Wird für jede "Blatt"-Kategorie
// aufgerufen (also einen Ordner ohne eigene Unterkategorien). Liefert
// außerdem "folderNote": eine optionale Orts-Beschreibung aus einer
// Textdatei "beschreibung.txt" direkt in diesem Ordner.
const { listImagesInFolder, getFolderNote } = require("./_drive");
const { countryFromLocation } = require("./_geo");
const { getPhotoMeta } = require("./_photometa");

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

    const images = await Promise.all(
      files.map(async (f) => {
        const meta = await getPhotoMeta(f.id);
        return {
          ...f,
          country: countryFromLocation(f.imageMediaMetadata && f.imageMediaMetadata.location),
          description: meta.caption || f.description || null,
          photoTitle: meta.title,
          photoKeywords: meta.keywords,
        };
      })
    );

    res.setHeader("Cache-Control", "s-maxage=60, stale-while-revalidate=300");
    res.status(200).json({ images, folderNote });
  } catch (err) {
    res.status(500).json({ error: err.message || "Unbekannter Fehler" });
  }
};
