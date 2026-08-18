// Löst einen geteilten Bild-Link auf: anhand der Datei-ID wird der
// übergeordnete Ordner ermittelt und dessen komplette Bilderliste
// zurückgegeben (inkl. Index des angefragten Bildes), damit die Lightbox
// direkt mit funktionierender Vor/Zurück-Navigation geöffnet werden kann.
const { DRIVE_API, driveFetch, listImagesInFolder } = require("./_drive");
const { countryFromLocation } = require("./_geo");

module.exports = async (req, res) => {
  const fileId = req.query.id;
  if (!fileId) {
    res.status(400).json({ error: "Parameter 'id' fehlt." });
    return;
  }

  try {
    const meta = await driveFetch(`${DRIVE_API}/${fileId}?fields=id,name,parents`);
    const parentId = meta.parents && meta.parents[0];
    if (!parentId) throw new Error("Übergeordneter Ordner nicht gefunden.");

    const files = await listImagesInFolder(parentId);
    const images = files.map((f) => ({
      ...f,
      country: countryFromLocation(f.imageMediaMetadata && f.imageMediaMetadata.location),
    }));

    const index = images.findIndex((img) => img.id === fileId);
    if (index === -1) throw new Error("Bild wurde in seinem Ordner nicht gefunden.");

    res.setHeader("Cache-Control", "s-maxage=60, stale-while-revalidate=300");
    res.status(200).json({ images, index });
  } catch (err) {
    res.status(500).json({ error: err.message || "Unbekannter Fehler" });
  }
};
