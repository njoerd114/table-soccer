# Datenschutzerklärung

Stand: September 2026

## 1. Verantwortlicher

Verantwortlicher im Sinne der Datenschutz-Grundverordnung (DSGVO) ist:

Niklas Beinghaus
Allmendstr. 1
79822 Titisee-Neustadt
Deutschland
E-Mail: hi@niklasbeinghaus.com
Telefon: +49 160 96227077

## 2. Überblick über die Verarbeitung

Diese Anwendung ("die App") dient der Erfassung und Auswertung von Tischfußball-Spielen (Torschützen, Aufstellungen, ELO-Wertungen) innerhalb registrierter Unternehmen/Teams. Es werden bewusst so wenige personenbezogene Daten wie möglich verarbeitet:

- In den Anwendungstabellen werden ausschließlich ein **Anzeigename (display_name)** und optional ein **Profilbild-Link (avatar_url)** gespeichert.
- E-Mail-Adressen, Nutzer-IDs und weitere Identitätsdaten verbleiben ausschließlich im Authentifizierungsdienst (Supabase Auth) und werden nicht in Anwendungstabellen dupliziert.
- Es werden keine Analyse-, Tracking- oder Werbedienste eingesetzt.
- Es werden keine Cookies durch die App selbst gesetzt.

## 3. Hosting und Auftragsverarbeitung

Die App wird über folgende Dienstleister betrieben, mit denen jeweils ein Auftragsverarbeitungsvertrag (AVV) gemäß Art. 28 DSGVO besteht bzw. abgeschlossen wird:

- **Vercel Inc.** – Hosting der statischen Web-Anwendung (Frontend-Auslieferung, CDN).
- **Supabase Inc.** – Datenbank (PostgreSQL), Authentifizierung und Realtime-Infrastruktur. Supabase setzt zeilenbasierte Sicherheitsregeln (Row Level Security) ein, sodass jeder Kunde/Mandant ausschließlich auf die eigenen Unternehmensdaten zugreifen kann.

Rechtsgrundlage der Beauftragung ist Art. 28 DSGVO in Verbindung mit Art. 6 Abs. 1 lit. b und lit. f DSGVO (Erfüllung des Nutzungsvertrags bzw. berechtigtes Interesse am technischen Betrieb der Anwendung).

## 4. Registrierung und Anmeldung (Login)

Zur Nutzung der App ist eine Registrierung/Anmeldung erforderlich. Hierfür stehen zwei Verfahren zur Verfügung:

### 4.1 E-Mail und Passwort

Bei Anmeldung per E-Mail/Passwort verarbeitet Supabase Auth die E-Mail-Adresse und ein gehashtes Passwort zur Erstellung und Verwaltung des Nutzerkontos. Rechtsgrundlage ist Art. 6 Abs. 1 lit. b DSGVO (Vertragserfüllung).

### 4.2 Google-Anmeldung (OAuth)

Alternativ kann die Anmeldung über ein Google-Konto (Google OAuth) erfolgen. Dabei werden Basisdaten (z. B. Name, E-Mail-Adresse, Profilbild) von Google an Supabase Auth übermittelt, um das Nutzerkonto zu erstellen bzw. zu authentifizieren. Anbieter dieses Dienstes ist:

Google Ireland Limited, Gordon House, Barrow Street, Dublin 4, Irland (bzw. Google LLC, USA, als Mutterkonzern)

Die Datenschutzerklärung von Google finden Sie unter: https://policies.google.com/privacy

Rechtsgrundlage ist Art. 6 Abs. 1 lit. a DSGVO (Einwilligung durch aktive Auswahl der Google-Anmeldung) in Verbindung mit Art. 6 Abs. 1 lit. b DSGVO (Vertragserfüllung).

## 5. Sitzungsverwaltung (kein Cookie-Banner erforderlich)

Zur Aufrechterhaltung Ihrer Anmeldung verwendet die von Supabase bereitgestellte Auth-Bibliothek einen technisch notwendigen Sitzungs-Token, der lokal im Browser gespeichert wird. Dieser Speichervorgang ist zur Bereitstellung des von Ihnen ausdrücklich gewünschten Dienstes (Login-Funktion) zwingend erforderlich.

Da es sich hierbei ausschließlich um eine technisch notwendige Speicherung im Sinne des § 25 Abs. 2 Nr. 2 TTDSG (bzw. Art. 6 Abs. 1 lit. b DSGVO) handelt und **keine** weiteren Cookies, Tracking- oder Analysewerkzeuge eingesetzt werden, ist gemäß § 25 Abs. 2 TTDSG kein gesondertes Cookie-Consent-Banner erforderlich.

## 6. Spieldaten

Im Rahmen der Nutzung werden folgende Daten zu Spielen verarbeitet: beteiligte Anzeigenamen, gespielte Positionen, Ergebnisse/Tore und daraus errechnete ELO-Wertungen sowie Saison-/Liga-Zuordnungen. Diese Daten werden dem jeweiligen Unternehmen (Mandant) zugeordnet und sind ausschließlich für Mitglieder desselben Unternehmens einsehbar (mandantengetrennte Zugriffskontrolle mittels Row Level Security).

Spiele sind nach dem Speichern unveränderlich (keine nachträgliche Bearbeitung oder Löschung durch Nutzer vorgesehen); eine Löschung auf Anfrage ist über den Verantwortlichen möglich (siehe Ziffer 8).

## 7. Optionale Slack-Benachrichtigung

Ein Unternehmen kann optional einen eigenen Slack-Webhook hinterlegen. Ist dies der Fall, wird nach Abschluss eines Spiels automatisch eine Nachricht an den konfigurierten Slack-Kanal gesendet. Diese Nachricht enthält ausschließlich:

- Anzeigenamen der beteiligten Spieler
- Spielpositionen
- Ergebnis/Tore
- ELO-Änderungen

Es werden **keine** E-Mail-Adressen, Nutzer-IDs oder Profilbild-URLs übertragen. Diese Funktion ist optional, wird von dem jeweiligen Unternehmen selbst konfiguriert (eigener Webhook) und erfolgt auf "Best-Effort"-Basis (ein Fehlschlagen der Übertragung beeinträchtigt die App-Funktion nicht). Anbieter des Slack-Dienstes ist Slack Technologies LLC, eine Tochtergesellschaft der Salesforce, Inc.

## 8. Ihre Rechte als betroffene Person

Ihnen stehen im Rahmen der gesetzlichen Vorgaben folgende Rechte zu:

- **Auskunft** über Ihre gespeicherten personenbezogenen Daten (Art. 15 DSGVO)
- **Berichtigung** unrichtiger Daten (Art. 16 DSGVO)
- **Löschung** Ihrer Daten (Art. 17 DSGVO)
- **Einschränkung der Verarbeitung** (Art. 18 DSGVO)
- **Datenübertragbarkeit** (Art. 20 DSGVO)
- **Widerspruch** gegen die Verarbeitung (Art. 21 DSGVO)
- **Widerruf** einer erteilten Einwilligung mit Wirkung für die Zukunft (Art. 7 Abs. 3 DSGVO)

Zur Ausübung dieser Rechte genügt eine formlose Nachricht an: hi@niklasbeinghaus.com

## 9. Beschwerderecht bei einer Aufsichtsbehörde

Sie haben unbeschadet eines anderweitigen verwaltungsrechtlichen oder gerichtlichen Rechtsbehelfs das Recht auf Beschwerde bei einer Datenschutz-Aufsichtsbehörde, insbesondere in dem Mitgliedstaat Ihres gewöhnlichen Aufenthaltsorts, Ihres Arbeitsplatzes oder des Orts des mutmaßlichen Verstoßes, wenn Sie der Ansicht sind, dass die Verarbeitung der Sie betreffenden personenbezogenen Daten gegen die DSGVO verstößt.

Zuständige Aufsichtsbehörde für den Verantwortlichen ist:

Landesbeauftragter für den Datenschutz und die Informationsfreiheit Baden-Württemberg
Königstraße 10a
70173 Stuttgart

## 10. Datensicherheit

Die App setzt technische und organisatorische Maßnahmen ein, um Ihre Daten gegen Manipulation, Verlust, Zerstörung oder unberechtigten Zugriff zu schützen, insbesondere durch mandantengetrennte Zugriffskontrolle (Row Level Security) auf Datenbankebene sowie verschlüsselte Übertragung (TLS/HTTPS).

## 11. Speicherdauer

Personenbezogene Daten werden nur so lange gespeichert, wie dies für die Bereitstellung der App und die Erfüllung der genannten Zwecke erforderlich ist, oder bis Sie eine Löschung gemäß Ziffer 8 beantragen. Gesetzliche Aufbewahrungspflichten bleiben unberührt.

## 12. Änderung dieser Datenschutzerklärung

Diese Datenschutzerklärung kann bei Bedarf angepasst werden, um sie an geänderte Rechtslagen oder Änderungen der App und der Datenverarbeitung anzupassen. Es gilt jeweils die zum Zeitpunkt Ihres Besuchs aktuelle Fassung.
