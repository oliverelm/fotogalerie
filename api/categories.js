// Listet die Kacheln EINER Ebene: ohne ?id die obersten Kategorien,
// mit ?id=FOLDER_ID die Unterkategorien (oder Bilder) genau dieses Ordners.
// Funktioniert rekursiv für beliebig viele Verschachtelungsebenen.
const { resolveRootFolderId, buildFolderCards } = require("./_drive");

module.exports = async (req, res) => {
  try {
    const parentId = req.query.id || (await resolveRootFolderId());
    const categories = await buildFolderCards(parentId);

    res.setHeader("Cache-Control", "s-maxage=60, stale-while-revalidate=300");
    res.status(200).json({ categories });
  } catch (err) {
    res.status(500).json({ error: err.message || "Unbekannter Fehler" });
  }
};
