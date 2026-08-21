// Liefert die private Mini-Statistik (Besuche, angesehene Bilder,
// Downloads). Nicht öffentlich — nur zugänglich mit dem geheimen Schlüssel
// aus der Umgebungsvariable STATS_ADMIN_KEY. Diese Seite wird nirgends auf
// der Website verlinkt.
const { getCounter } = require("./_stats");

module.exports = async (req, res) => {
  const expected = process.env.STATS_ADMIN_KEY;
  if (!expected) {
    res.status(500).json({ error: "STATS_ADMIN_KEY ist nicht konfiguriert." });
    return;
  }

  const key = req.query.key;
  if (!key || key !== expected) {
    res.status(403).json({ error: "Ungültiger Schlüssel." });
    return;
  }

  const [visits, images, downloads] = await Promise.all([
    getCounter("visit"),
    getCounter("image"),
    getCounter("downloads"),
  ]);

  res.setHeader("Cache-Control", "no-store");
  res.status(200).json({ visits, images, downloads });
};
