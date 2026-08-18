# Fotogalerie — Setup (öffentliche Version, ohne Besucher-Login)

Die Galerie ist jetzt für jeden Besucher direkt sichtbar — niemand muss sich
mehr mit Google anmelden. Stattdessen greift eine kleine Server-Funktion
(läuft automatisch bei Vercel mit) mit deinem eigenen, dauerhaft hinterlegten
Google-Zugang auf dein Drive zu.

Der bisherige Weg (Google-Drive-Ordnerstruktur, Bilder hochladen) bleibt
exakt gleich — nur wie die Website an die Bilder kommt, hat sich geändert.

---

## 1. Einmaliger Refresh-Token (nur du, nur einmal)

1. In der Google Cloud Console (console.cloud.google.com/apis/credentials)
   bei deiner bestehenden OAuth-Client-ID unter **"Autorisierte
   Redirect-URIs"** ergänzen: `http://localhost:8484/callback`
2. Dort auch das **Client-Secret** kopieren (steht neben der Client-ID).
3. Lokal `node -v` prüfen (Node.js muss installiert sein).
4. In `scripts/get-refresh-token.js` CLIENT_ID und CLIENT_SECRET eintragen.
5. Im Terminal, im Projektordner: `node scripts/get-refresh-token.js`
6. Den ausgegebenen Link im Browser öffnen, mit deinem Google-Konto
   anmelden, Zugriff erlauben.
7. Im Terminal erscheint der **Refresh-Token** — den brauchst du gleich.

## 2. Umgebungsvariablen bei Vercel eintragen

Im Vercel-Projekt unter **Settings → Environment Variables** vier Werte
anlegen:

| Name | Wert |
|---|---|
| `GOOGLE_CLIENT_ID` | deine Client-ID (`....apps.googleusercontent.com`) |
| `GOOGLE_CLIENT_SECRET` | das Client-Secret aus Schritt 1 |
| `GOOGLE_REFRESH_TOKEN` | der Token aus Schritt 1 |
| `DRIVE_ROOT_FOLDER_NAME` | z. B. `Fotowebseite` (Name deines Hauptordners) |

Danach im Vercel-Dashboard ein **Redeploy** auslösen (oder einfach neu
pushen), damit die Variablen aktiv werden.

## 3. Bilder verwalten — wie bisher, plus Unterkategorien

Neue Kategorie = neuer Unterordner in `Fotowebseite`, neues Foto = Datei in
den passenden Ordner hochladen. Erscheint automatisch beim nächsten Aufruf
der Seite, kein erneutes Deployment nötig.

**Unterkategorien:** Lege innerhalb eines Kategorie-Ordners einfach weitere
Unterordner an, z. B. `Fotowebseite/Italien/Venedig` und
`Fotowebseite/Italien/Rom`. Die Website erkennt automatisch, ob ein Ordner
eigene Bilder oder weitere Unterordner enthält, und zeigt entsprechend
entweder Bilder oder eine weitere Kategorie-Ebene an. Funktioniert beliebig
tief verschachtelt.

## 4. Neu: package.json mit hochladen

Für die Länder-Erkennung (Suche) werden zwei kleine, offline arbeitende
Bausteine benötigt. Dafür liegen jetzt `package.json` und
`package-lock.json` im Hauptverzeichnis — die müssen mit ins GitHub-Repo
hochgeladen werden (gleiche Ebene wie `index.html`). Vercel installiert die
Bausteine beim Deployment automatisch, du musst dafür nichts weiter tun.
Der lokale `node_modules`-Ordner (falls bei dir vorhanden) muss **nicht**
mit hochgeladen werden.

---

## Neue Funktionen im Überblick

- **Unterkategorien:** siehe Punkt 3 oben.
- **Suche:** Suchfeld oben rechts im Header der Galerie. Durchsucht
  Dateiname, Bemerkung (Drive-Beschreibung) und automatisch erkanntes Land
  über alle Kategorien und Unterkategorien hinweg. Läuft komplett offline
  (keine Kartendienst-Anfrage pro Bild).
- **Teilen:** In der Großansicht eines Bildes gibt es jetzt einen
  "🔗 Teilen"-Button — kopiert einen Link, der beim Öffnen direkt das
  jeweilige Bild in der Großansicht zeigt (inkl. funktionierender
  Vor/Zurück-Navigation zu den Nachbarbildern).

## Technischer Überblick

- `/api/categories` (bzw. `?id=…`) — listet Kategorie-Kacheln einer Ebene;
  funktioniert rekursiv für beliebig viele Unterkategorie-Ebenen
- `/api/category?id=…` — listet alle Bilder einer "Blatt"-Kategorie (inkl.
  automatisch erkanntem Land)
- `/api/search?q=…` — durchsucht den kompletten Baum nach Titel, Bemerkung
  und Land
- `/api/image?id=…` — löst einen Teilen-Link auf (Bild + Geschwisterbilder
  für die Pfeilnavigation)
- `/api/download?id=…` — liefert die Originaldatei zum Download (einzige
  Stelle, die tatsächlich Bilddaten durch den Server schickt)
- Vorschaubilder lädt der Browser **direkt von Google** (schnell, entlastet
  die Server-Funktion) — nur der Originaldownload läuft über `/api/download`.

## Grenzen

- Sehr große Originaldateien könnten bei Vercels kostenlosem Plan an die
  Zeit-/Größenbeschränkung einer Server-Funktion stoßen. Für normale
  Fotogrößen unproblematisch — bei Bedarf einfach mit echten Dateien testen.
- `scripts/get-refresh-token.js` ist nur für den einmaligen lokalen Gebrauch
  gedacht, keine Website-Datei — im Deployment stört sie nicht, wird aber
  nie automatisch ausgeführt.
