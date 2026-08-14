# Fotogalerie — Setup-Anleitung

Diese Website zeigt deine Google-Drive-Ordner als Foto-Kategorien: Jeder Unterordner
= eine Kategorie, das erste Bild darin = Titelbild, Klick zeigt alle Bilder als
Miniaturübersicht.

Die App läuft komplett im Browser (kein eigener Server nötig), aber du brauchst
einmalig ein Google-Cloud-Projekt mit OAuth-Zugangsdaten sowie irgendein
Hosting für statische Dateien.

---

## 1. Google-Drive-Ordnerstruktur anlegen

1. Öffne [drive.google.com](https://drive.google.com)
2. Lege einen Hauptordner an, z. B. `Fotowebseite`
3. Darin für jede Kategorie einen Unterordner, z. B. `Landschaft`, `Portraits`, `Reisen`
4. Lade in jeden Unterordner die passenden Bilder hoch
5. **Titelbild steuern:** Die App nimmt automatisch das erste Bild in
   alphabetischer Reihenfolge als Titelbild. Willst du ein bestimmtes Bild als
   Titelbild, benenne es so, dass es alphabetisch zuerst kommt, z. B.
   `0_titelbild.jpg`

---

## 2. Google-Cloud-Projekt einrichten

1. Gehe zu [console.cloud.google.com](https://console.cloud.google.com)
2. Neues Projekt anlegen (oben links, "Projekt auswählen" → "Neues Projekt")
3. Im Menü zu **APIs & Dienste → Bibliothek** und nach **"Google Drive API"**
   suchen → **Aktivieren**

### OAuth-Zustimmungsbildschirm konfigurieren

1. **APIs & Dienste → OAuth-Zustimmungsbildschirm**
2. Nutzertyp: **Extern** (falls kein Google-Workspace-Konto) oder **Intern**
   (falls doch)
3. App-Name (z. B. "Meine Fotogalerie"), deine E-Mail als Support-Kontakt
4. Bereich **Scopes**: füge `.../auth/drive.readonly` hinzu
5. Bereich **Testnutzer**: trage deine eigene Google-Mail-Adresse ein
   (solange die App nicht von Google verifiziert ist, dürfen nur eingetragene
   Testnutzer sich anmelden — für den privaten Gebrauch reicht das völlig aus)

### OAuth-Client-ID erstellen

1. **APIs & Dienste → Anmeldedaten → + Anmeldedaten erstellen → OAuth-Client-ID**
2. Anwendungstyp: **Webanwendung**
3. **Autorisierte JavaScript-Quellen**: trage die Domain ein, auf der die Seite
   später läuft, z. B.:
   - `http://localhost:5500` (zum lokalen Testen)
   - `https://deine-domain.de` bzw. `https://dein-projekt.vercel.app`
4. Erstellen — du bekommst eine **Client-ID** (endet auf
   `.apps.googleusercontent.com`). Ein Client-Secret wird hier nicht benötigt.

---

## 3. Konfiguration eintragen

Öffne `config.js` und trage ein:

```js
const CONFIG = {
  CLIENT_ID: "DEINE_CLIENT_ID.apps.googleusercontent.com",
  ROOT_FOLDER_NAME: "Fotowebseite", // Name deines Hauptordners in Drive
  ROOT_FOLDER_ID: null,
};
```

Alternative statt Namenssuche: Öffne den Hauptordner in Drive, kopiere die ID
aus der URL (`https://drive.google.com/drive/folders/DIESE_ID_HIER`) und trage
sie bei `ROOT_FOLDER_ID` ein — dann ist `ROOT_FOLDER_NAME` egal.

---

## 4. Lokal testen

Da die Seite `fetch`-Anfragen macht, reicht ein Doppelklick auf `index.html`
nicht aus (Browser blockieren das teils). Starte stattdessen einen einfachen
lokalen Server im Projektordner, z. B.:

```bash
npx serve .
```

oder mit VS Code die Erweiterung "Live Server". Wichtig: Die Adresse
(`http://localhost:PORT`) muss exakt mit einer der autorisierten
JavaScript-Quellen aus Schritt 2 übereinstimmen.

---

## 5. Veröffentlichen (Hosting)

Die App besteht nur aus statischen Dateien (`index.html`, `styles.css`,
`app.js`, `config.js`) — jedes Static-Hosting reicht:

- **Vercel** oder **Netlify**: Projektordner hochladen bzw. mit GitHub-Repo
  verbinden, kostenlos
- **GitHub Pages**: Repo anlegen, Dateien pushen, Pages im Repo aktivieren

Nach dem Deployment: die endgültige URL zusätzlich unter **Autorisierte
JavaScript-Quellen** in der Google-Cloud-Console eintragen (Schritt 2), sonst
verweigert Google den Login auf der Live-Seite.

---

## Hinweise & Grenzen

- **Nur Lesezugriff:** Die App fragt nur `drive.readonly` an — sie kann nichts
  in deinem Drive verändern oder löschen.
- **Privater Zugriff:** Solange dein OAuth-Zustimmungsbildschirm im
  Testmodus ist, können sich nur die von dir eingetragenen Testnutzer
  anmelden. Für eine Seite, die nur du selbst nutzt, ist das ideal. Soll die
  Seite für beliebige Google-Konten öffentlich nutzbar sein, müsste die App
  von Google verifiziert werden (aufwendiger Prozess, meist nur für echte
  Produkte relevant).
- **Bildgrößen:** Für Miniaturansichten und Großansicht wird aktuell dieselbe
  Originaldatei geladen. Bei sehr großen Fotos/vielen Bildern kann das Laden
  dauern. Bei Bedarf kann ich eine Variante mit komprimierten
  Vorschaubildern (`thumbnailLink`) ergänzen, die schneller lädt.
- **Sitzungsdauer:** Das Zugriffs-Token läuft nach einer Weile ab
  (üblicherweise ~1 Stunde). Einfach über "Abmelden"/"Anmelden" erneuern.
