// Sucht über den gesamten Bilderbestand (alle Kategorien + Unterkategorien)
// nach einem Begriff — geprüft werden Dateiname, Bemerkung (Drive-
// Beschreibung) und das aus GPS-Koordinaten erkannte Land.
const { resolveRootFolderId, listSubfolders, crawlTree } = require("./_drive");
const { countryFromLocation } = require("./_geo");

module.exports = async (req, res) => {
  const q = (req.query.q || "").trim().toLowerCase();
  if (!q) {
    res.status(200).json({ results: [] });
    return;
  }

  try {
    const rootId = await resolveRootFolderId();
    const topFolders = await listSubfolders(rootId);

    const perFolder = await Promise.all(
      topFolders.map((f) => crawlTree(f.id, [f.name]))
    );
    const allImages = [].concat(...perFolder);

    const results = allImages
      .map((img) => {
        const country = countryFromLocation(
          img.imageMediaMetadata && img.imageMediaMetadata.location
        );
        return { ...img, country };
      })
      .filter((img) => {
        const haystack = [img.name, img.description, img.country]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        return haystack.includes(q);
      })
      .slice(0, 200);

    res.setHeader("Cache-Control", "s-maxage=30, stale-while-revalidate=120");
    res.status(200).json({ results });
  } catch (err) {
    res.status(500).json({ error: err.message || "Unbekannter Fehler" });
  }
};
