// Zählt anonyme Nutzungs-Ereignisse hoch — aktuell "visit" (Seitenaufruf)
// und "image" (Bild in der Großansicht geöffnet). Keine IP-Adressen, keine
// Cookies, keine Wiedererkennung einzelner Besucher.
const { incrCounter } = require("./_stats");

const ALLOWED_TYPES = new Set(["visit", "image"]);

module.exports = async (req, res) => {
  const type = req.query.type;
  if (!ALLOWED_TYPES.has(type)) {
    res.status(400).json({ error: "Ungültiger Ereignistyp." });
    return;
  }

  await incrCounter(type);
  res.status(204).end();
};
