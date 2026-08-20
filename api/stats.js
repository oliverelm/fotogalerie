// Liefert Gesamtstatistik über den kompletten Bilderbestand: Anzahl Fotos
// und Anzahl verschiedener Länder (aus GPS-Koordinaten, offline erkannt).
// Wird auf der Startseite angezeigt.
const { resolveRootFolderId, listSubfolders, crawlTree } = require("./_drive");
const { countryFromLocation } = require("./_geo");

module.exports = async (req, res) => {
  try {
    const rootId = await resolveRootFolderId();
    const topFolders = await listSubfolders(rootId);

    const perFolder = await Promise.all(
      topFolders.map((f) => crawlTree(f.id, [f.name]))
    );
    const allImages = [].concat(...perFolder);

    const countries = new Set();
    for (const img of allImages) {
      const country = countryFromLocation(
        img.imageMediaMetadata && img.imageMediaMetadata.location
      );
      if (country) countries.add(country);
    }

    res.setHeader("Cache-Control", "s-maxage=300, stale-while-revalidate=1800");
    res.status(200).json({
      totalImages: allImages.length,
      totalCountries: countries.size,
    });
  } catch (err) {
    res.status(500).json({ error: err.message || "Unbekannter Fehler" });
  }
};
