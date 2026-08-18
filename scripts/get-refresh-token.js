// ============================================================
// EINMALIGES HILFSSKRIPT — lokal ausführen, NICHT deployen.
//
// Besorgt einen Google-"Refresh Token": ein Dauer-Zugangsticket, mit dem
// die Server-Funktionen der Website später ohne dein Zutun auf dein
// Google Drive zugreifen können.
//
// Voraussetzung: Node.js ist installiert (node -v zum Prüfen).
//
// Nutzung:
//   1. Unten CLIENT_ID und CLIENT_SECRET eintragen (aus der Google Cloud
//      Console, Anmeldedaten-Seite, bei deiner bestehenden OAuth-Client-ID).
//   2. In der Google Cloud Console bei dieser Client-ID unter
//      "Autorisierte Redirect-URIs" ergänzen: http://localhost:8484/callback
//   3. Im Terminal ausführen:  node get-refresh-token.js
//   4. Den ausgegebenen Link im Browser öffnen, mit deinem Google-Konto
//      anmelden und Zugriff erlauben.
//   5. Der Refresh-Token erscheint im Terminal — den Wert kopierst du in
//      die Vercel-Umgebungsvariable GOOGLE_REFRESH_TOKEN.
// ============================================================

const http = require("http");
const { URL } = require("url");

const CLIENT_ID = "958537068555-3no9m112sf40btc1iaogeh7m1jgbl385.apps.googleusercontent.com";
const CLIENT_SECRET = "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";

const PORT = 8484;
const REDIRECT_URI = `http://localhost:${PORT}/callback`;
const SCOPE = "https://www.googleapis.com/auth/drive.readonly";

if (CLIENT_ID.startsWith("DEINE_") || CLIENT_SECRET.startsWith("DEIN_")) {
  console.error(
    "Bitte zuerst CLIENT_ID und CLIENT_SECRET oben im Skript eintragen."
  );
  process.exit(1);
}

const authUrl =
  "https://accounts.google.com/o/oauth2/v2/auth?" +
  new URLSearchParams({
    client_id: CLIENT_ID,
    redirect_uri: REDIRECT_URI,
    response_type: "code",
    scope: SCOPE,
    access_type: "offline", // wichtig: fordert einen Refresh-Token an
    prompt: "consent", // wichtig: erzwingt erneute Zustimmung, damit wirklich ein neuer Refresh-Token kommt
  });

console.log("\nÖffne diesen Link in deinem Browser und melde dich an:\n");
console.log(authUrl + "\n");
console.log(`Warte auf die Antwort auf http://localhost:${PORT} ...\n`);

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);
  if (url.pathname !== "/callback") {
    res.end("Warte auf Google-Weiterleitung ...");
    return;
  }

  const code = url.searchParams.get("code");
  if (!code) {
    res.end("Kein Code erhalten. Bitte Skript erneut starten.");
    server.close();
    return;
  }

  try {
    const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: CLIENT_ID,
        client_secret: CLIENT_SECRET,
        code,
        grant_type: "authorization_code",
        redirect_uri: REDIRECT_URI,
      }),
    });
    const data = await tokenRes.json();

    if (!data.refresh_token) {
      res.end(
        "Kein Refresh-Token erhalten. Meist hilft: in der Google-Kontoverwaltung " +
          "unter 'Apps mit Kontozugriff' den Zugriff dieser App entziehen und das " +
          "Skript erneut starten (erzwingt einen frischen Consent-Screen)."
      );
      console.error("Antwort ohne refresh_token:", data);
      server.close();
      return;
    }

    console.log("\n✅ Erfolg! Dein Refresh-Token:\n");
    console.log(data.refresh_token);
    console.log(
      "\nTrage diesen Wert in Vercel als Umgebungsvariable GOOGLE_REFRESH_TOKEN ein.\n"
    );

    res.end(
      "Fertig! Du kannst dieses Fenster schließen und ins Terminal wechseln."
    );
  } catch (err) {
    res.end("Fehler beim Token-Austausch: " + err.message);
    console.error(err);
  } finally {
    server.close();
  }
});

server.listen(PORT);
