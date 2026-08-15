const { DRIVE_API, driveFetch } = require("./_drive");

module.exports = async (req, res) => {
  const folderId = req.query.id;
  if (!folderId) {
    res.status(400).json({ error: "Parameter 'id' fehlt." });
    return;
  }

  try {
    let files = [];
    let pageToken = null;
    const q = encodeURIComponent(
      `'${folderId}' in parents and mimeType contains 'image/' and trashed=false`
    );

    do {
      const url =
        `${DRIVE_API}?q=${q}&fields=nextPageToken,files(id,name,description,thumbnailLink,imageMediaMetadata(location))` +
        `&orderBy=name&pageSize=1000` +
        (pageToken ? `&pageToken=${pageToken}` : "");
      const data = await driveFetch(url);
      files = files.concat(data.files || []);
      pageToken = data.nextPageToken || null;
    } while (pageToken);

    res.setHeader("Cache-Control", "s-maxage=60, stale-while-revalidate=300");
    res.status(200).json({ images: files });
  } catch (err) {
    res.status(500).json({ error: err.message || "Unbekannter Fehler" });
  }
};
