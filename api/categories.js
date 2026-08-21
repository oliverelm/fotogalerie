// Listet die Kacheln EINER Ebene: ohne ?id die obersten Kategorien,
// mit ?id=FOLDER_ID die Unterkategorien (oder Bilder) genau dieses Ordners.
// Funktioniert rekursiv für beliebig viele Verschachtelungsebenen.
// Liefert zusätzlich "looseImages": Bilder, die direkt in diesem Ordner
// liegen, obwohl er auch Unterkategorien hat (z.B. noch nicht einsortierte
// Fotos) — die werden dann unterhalb der Kategorie-Kacheln angezeigt.
// Liefert außerdem "folderNote": eine optionale Orts-Beschreibung aus einer
// Textdatei "beschreibung.txt" direkt in diesem Ordner.
const {
  resolveRootFolderId,
  buildFolderCards,
  listImagesInFolder,
  getFolderNote,
} = require("./_drive");
const { countryFromLocation } = require("./_geo");
const { getPhotoMeta } = require("./_photometa");

module.exports = async (req, res) => {
  try {
    const parentId = req.query.id || (await resolveRootFolderId());

    const [categories, looseFiles, folderNote] = await Promise.all([
      buildFolderCards(parentId),
      listImagesInFolder(parentId),
      getFolderNote(parentId),
    ]);

    const looseImages = await Promise.all(
      looseFiles.map(async (f) => {
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
    res.status(200).json({ categories, looseImages, folderNote });
  } catch (err) {
    res.status(500).json({ error: err.message || "Unbekannter Fehler" });
  }
};
