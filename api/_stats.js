// Speichert und liest einfache Zähler (Besuche, angesehene Bilder,
// Downloads) über Upstash Redis — per REST-API, ohne zusätzliche
// Bibliothek. Komplett anonym: keine IP-Adressen, keine Cookies, keine
// Wiedererkennung einzelner Besucher — nur eine hochgezählte Zahl pro
// Ereignistyp.

const UPSTASH_URL = process.env.UPSTASH_REDIS_REST_KV_REST_API_URL;
const UPSTASH_TOKEN = process.env.UPSTASH_REDIS_REST_KV_REST_API_TOKEN;

function isConfigured() {
  return Boolean(UPSTASH_URL && UPSTASH_TOKEN);
}

async function incrCounter(name) {
  if (!isConfigured()) return;
  try {
    await fetch(`${UPSTASH_URL}/incr/stats:${name}`, {
      headers: { Authorization: `Bearer ${UPSTASH_TOKEN}` },
    });
  } catch {
    // Zähler sind "nice to have" — ein Fehler hier darf die Seite selbst
    // nie stören oder verlangsamen.
  }
}

async function getCounter(name) {
  if (!isConfigured()) return 0;
  try {
    const res = await fetch(`${UPSTASH_URL}/get/stats:${name}`, {
      headers: { Authorization: `Bearer ${UPSTASH_TOKEN}` },
    });
    if (!res.ok) return 0;
    const data = await res.json();
    return Number(data.result) || 0;
  } catch {
    return 0;
  }
}

module.exports = { incrCounter, getCounter, isConfigured };
