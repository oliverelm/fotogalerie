const { DRIVE_API, driveFetch, resolveRootFolderId } = require("./_drive");

module.exports = async (req, res) => {
  try {
    const rootId = await resolveRootFolderId();

    const folderQ = encodeURIComponent(
      `'${rootId}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false`
    );
    const folderData = await driveFetch(
      `${DRIVE_API}?q=${folderQ}&fields=files(id,name)&orderBy=name&pageSize=200`
    );
    const folders = folderData.files || [];

    // Für jede Kategorie das erste Bild (alphabetisch) + Gesamtanzahl ermitteln.
    const categories = await Promise.all(
      folders.map(async (folder) => {
        const imgQ = encodeURIComponent(
          `'${folder.id}' in parents and mimeType contains 'image/' and trashed=false`
        );
        const imgData = await driveFetch(
          `${DRIVE_API}?q=${imgQ}&fields=files(id,name,thumbnailLink)&orderBy=name&pageSize=1000`
        );
        const images = imgData.files || [];
        return {
          id: folder.id,
          name: folder.name,
          count: images.length,
          coverThumbnailLink: images[0] ? images[0].thumbnailLink : null,
        };
      })
    );

    res.setHeader("Cache-Control", "s-maxage=60, stale-while-revalidate=300");
    res.status(200).json({ categories });
  } catch (err) {
    res.status(500).json({ error: err.message || "Unbekannter Fehler" });
  }
};
