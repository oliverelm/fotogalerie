// Löst einen geteilten Kategorie-Link auf: anhand der Ordner-ID wird der
// komplette Pfad ab der obersten Kategorie ermittelt (für die Breadcrumb),
// sowie ob dieser Ordner selbst Unterkategorien oder Bilder enthält.
const { listSubfolders, resolvePathToFolder } = require("./_drive");

module.exports = async (req, res) => {
  const folderId = req.query.id;
  if (!folderId) {
    res.status(400).json({ error: "Parameter 'id' fehlt." });
    return;
  }

  try {
    const [path, subfolders] = await Promise.all([
      resolvePathToFolder(folderId),
      listSubfolders(folderId),
    ]);

    if (path.length === 0) {
      throw new Error("Kategorie wurde nicht gefunden.");
    }

    res.setHeader("Cache-Control", "s-maxage=60, stale-while-revalidate=300");
    res.status(200).json({ path, hasSubcategories: subfolders.length > 0 });
  } catch (err) {
    res.status(500).json({ error: err.message || "Unbekannter Fehler" });
  }
};
