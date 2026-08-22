// Erzeugt eine dynamische sitemap.xml — listet neben den festen Hauptseiten
// automatisch ALLE Kategorien und Unterkategorien (als /teilen/kategorie/…
// Adressen), damit Google & Co. den kompletten Kategorie-Baum finden und
// crawlen können. Wird alle paar Stunden neu erzeugt (siehe Cache-Control),
// nicht bei jedem einzelnen Aufruf komplett neu berechnet.
const { resolveRootFolderId, buildFolderCards } = require("./_drive");

const BASE_URL = "https://fotogalerie-one.vercel.app";
const MAX_DEPTH = 8; // Sicherheitsnetz gegen versehentlich zirkuläre/zu tiefe Strukturen

const STATIC_PAGES = [
  { loc: `${BASE_URL}/`, changefreq: "weekly", priority: "1.0" },
  { loc: `${BASE_URL}/galerie/index.html`, changefreq: "weekly", priority: "0.9" },
  { loc: `${BASE_URL}/lizenz.html`, changefreq: "monthly", priority: "0.3" },
  { loc: `${BASE_URL}/kontakt.html`, changefreq: "monthly", priority: "0.3" },
  { loc: `${BASE_URL}/impressum.html`, changefreq: "yearly", priority: "0.1" },
  { loc: `${BASE_URL}/datenschutz.html`, changefreq: "yearly", priority: "0.1" },
];

// Läuft rekursiv durch den kompletten Kategorie-Baum und sammelt für jede
// Kategorie/Unterkategorie eine Teilen-Adresse.
async function collectCategoryUrls(parentId, depth = 0) {
  if (depth > MAX_DEPTH) return [];
  const cards = await buildFolderCards(parentId);

  let urls = [];
  for (const cat of cards) {
    urls.push({
      loc: `${BASE_URL}/teilen/kategorie/${cat.id}`,
      changefreq: "weekly",
      priority: depth === 0 ? "0.7" : "0.5",
    });
    if (cat.hasSubcategories) {
      const nested = await collectCategoryUrls(cat.id, depth + 1);
      urls = urls.concat(nested);
    }
  }
  return urls;
}

function escapeXml(str) {
  return String(str).replace(/[&<>"']/g, (c) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&apos;",
  })[c]);
}

module.exports = async (req, res) => {
  try {
    const rootId = await resolveRootFolderId();
    const categoryUrls = await collectCategoryUrls(rootId);
    const allUrls = [...STATIC_PAGES, ...categoryUrls];

    const xml =
      `<?xml version="1.0" encoding="UTF-8"?>\n` +
      `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
      allUrls
        .map(
          (u) =>
            `  <url>\n` +
            `    <loc>${escapeXml(u.loc)}</loc>\n` +
            `    <changefreq>${u.changefreq}</changefreq>\n` +
            `    <priority>${u.priority}</priority>\n` +
            `  </url>`
        )
        .join("\n") +
      `\n</urlset>\n`;

    res.setHeader("Content-Type", "application/xml; charset=utf-8");
    res.setHeader("Cache-Control", "s-maxage=3600, stale-while-revalidate=86400");
    res.status(200);
    res.end(xml);
  } catch (err) {
    // Im Fehlerfall wenigstens die festen Seiten liefern, statt komplett
    // nichts — eine unvollständige Sitemap ist besser als gar keine.
    const xml =
      `<?xml version="1.0" encoding="UTF-8"?>\n` +
      `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
      STATIC_PAGES.map(
        (u) =>
          `  <url>\n    <loc>${escapeXml(u.loc)}</loc>\n    <changefreq>${u.changefreq}</changefreq>\n    <priority>${u.priority}</priority>\n  </url>`
      ).join("\n") +
      `\n</urlset>\n`;
    res.setHeader("Content-Type", "application/xml; charset=utf-8");
    res.status(200);
    res.end(xml);
  }
};
