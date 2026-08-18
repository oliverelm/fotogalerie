// Ordnet GPS-Koordinaten offline einem Land zu (deutscher Name).
// Nutzt vereinfachte, mitgelieferte Ländergrenzen — kein externer Dienst,
// keine Wartezeit, kein zusätzlicher Datenschutz-Berührungspunkt.

const { feature } = require("@rapideditor/country-coder");
const countries = require("i18n-iso-countries");
countries.registerLocale(require("i18n-iso-countries/langs/de.json"));

function countryFromLocation(loc) {
  if (!loc || typeof loc.latitude !== "number" || typeof loc.longitude !== "number") {
    return null;
  }
  try {
    const f = feature([loc.longitude, loc.latitude]);
    const iso2 = f && f.properties && f.properties.iso1A2;
    if (!iso2) return null;
    return countries.getName(iso2, "de") || f.properties.nameEn || null;
  } catch {
    return null;
  }
}

module.exports = { countryFromLocation };
