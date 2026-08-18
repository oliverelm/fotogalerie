const { DRIVE_API, getAccessToken } = require("./_drive");

module.exports = async (req, res) => {
  const fileId = req.query.id;
  if (!fileId) {
    res.status(400).json({ error: "Parameter 'id' fehlt." });
    return;
  }

  try {
    const accessToken = await getAccessToken();

    // Dateiname für den Download-Namen mitholen.
    const metaRes = await fetch(`${DRIVE_API}/${fileId}?fields=name,mimeType`, {
      headers: { Authorization: "Bearer " + accessToken },
    });
    if (!metaRes.ok) throw new Error("Datei nicht gefunden.");
    const meta = await metaRes.json();

    const fileRes = await fetch(`${DRIVE_API}/${fileId}?alt=media`, {
      headers: { Authorization: "Bearer " + accessToken },
    });
    if (!fileRes.ok || !fileRes.body) throw new Error("Datei konnte nicht geladen werden.");

    res.setHeader("Content-Type", meta.mimeType || "application/octet-stream");
    const disposition = req.query.inline ? "inline" : "attachment";
    res.setHeader(
      "Content-Disposition",
      `${disposition}; filename="${(meta.name || "bild").replace(/"/g, "")}"`
    );
    res.setHeader("Cache-Control", "private, max-age=3600");

    const reader = fileRes.body.getReader();
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      res.write(Buffer.from(value));
    }
    res.end();
  } catch (err) {
    res.status(500).json({ error: err.message || "Unbekannter Fehler" });
  }
};
