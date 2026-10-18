# Ashmane

Ein kurzes, wiederspielbares Browser-Game. Man spielt ein Cotton-Candy-pinkes Pferd in einem brennenden Wald und muss den Wald verlassen, bevor das Feuer das Pferd erwischt. Hobbyprojekt von Emre, gemacht zum Spass. Umfang bewusst klein halten, damit das Spiel fertig wird.

Arbeitssprache mit Emre: Deutsch. Code, Bezeichner und Kommentare im Code: Englisch.

## Spielidee (Version 1)

- Echtzeit, Kamera von schräg oben (2.5D, echte 3D-Szene mit festem Winkel).
- Das Pferd läuft direkt in die Richtung der Tasten (WASD / Pfeile), mit leichter Beschleunigung und Abbremsen, damit es sich nicht starr anfühlt.
- Das Feuer breitet sich langsam und stetig aus. Es macht Schaden. Bei 0 Health stirbt das Pferd. Wer lange an einem Ort bleibt, nimmt mehr Schaden.
- Feuer wirkt auf ein Raster: Gras und Boden, ganze Bäume (Krone und Stamm) und der Waldboden können brennen. Brennende Felder versperren Wege. Verbrannte Bäume bleiben als verkohlte Stämme stehen.
- Äpfel heilen.
- Ziel von Version 1: den Waldrand erreichen. Nichts weiter.
- Jeder Durchgang erzeugt einen neuen zufälligen Wald (Bäume, Feuerherde). Das trägt das Wiederspielen. Keine festen Levels.
- Unberechenbare Ereignisse (z.B. umstürzende Bäume, Funkenflug, plötzliche Feuerwand) kommen später dazu, damit es nicht langweilig wird.

Spätere Ideen, nicht in Version 1: goldener Apfel (Tempo-Boost), Hindernisse wie Flüsse, Soundtrack, der auf Gefahr reagiert.

## Look

Dithering ist der Kern der Optik. Die 3D-Szene wird in ein kleines Render-Target gerendert und dann mit einem Bayer-Dither-Shader auf wenige Farben reduziert.

Palette (nicht erweitern, ohne Rücksprache):
- Schwarz und Weiss: Wald, Boden, alles Neutrale.
- Dunkelrot (ca. `#940f10`): Feuer, nur dort.
- Cotton Candy Pink (ca. `#ffa3d4`): das Pferd, nur dort.

Der Prototyp `docs/prototype/ashmane-look-prototype.html` zeigt den Look, den Dithering-Shader und die Feuer-Simulation in einer einzelnen Datei. Er dient als Vorlage, nicht als Struktur fürs Projekt. Wichtig daraus:
- Dither-Pass: Bayer 8x8, Farbklassifizierung im Fragment-Shader (neutral = schwarz/weiss, rosa-Ton = Pferd, rot-Ton = Feuer).
- Pixelgrösse einstellbar (Standard 3), Muster liegt fest auf dem Bildschirm.
- Feuer als Zellraster mit Zuständen frisch, brennt, verbrannt. Bäume sitzen in Zellen und brennen länger als Boden.
- Flammen und Boden-Glühen werden als Instanzen gerendert, das Licht kommt von wenigen beweglichen Punktlichtern.
- Es gibt auch eine 2D-Ansicht (Canvas), falls sie später gebraucht wird.

## Technik

- Vite, TypeScript, Three.js. Läuft im Browser, kein Backend.
- Objektorientiert, bevorzugt Komposition statt tiefer Vererbung. Eine Klasse hat eine Aufgabe.
- Grobe Klassen: `Game` (Schleife, Zustand), `Horse` (Bewegung, Health, Modell), `Forest` (Erzeugung, Bäume), `FireGrid` (Feuer-Simulation), `Apple`, `Hud`, `Renderer` mit `DitherPass`, `Input`.
- Jede Klasse mit Zeitverlauf hat `update(dt)`. Spiellogik und Darstellung trennen, damit sich die Simulation ohne Grafik testen lässt.
- Zufall immer über einen Seed (z.B. mulberry32), damit ein Wald reproduzierbar ist.
- Wenig Abhängigkeiten. Keine Engine, kein UI-Framework.

## Arbeitsweise

- Kleine Schritte. Zuerst Prototyp spielbar machen (Pferd, Feuer, Health, Ausgang), dann erst Extras.
- Bevor etwas Grosses gebaut wird, kurz mit Emre klären. Er will mitentscheiden, nicht nur ein fertiges Ergebnis.
- Look-Änderungen im Zweifel zuerst als kleiner Test zeigen.
- Das Kanban-Board mit Aufgaben pflegt Emre im Claude-Projekt "Game". Neue Aufgaben und erledigte Punkte bitte am Ende einer Arbeitssitzung kurz benennen, damit er sie dort nachführen kann.

## Offene Fragen

- Kamera: bleibt es bei 2.5D von oben, oder wird die 2D-Ansicht doch interessant?
- Welche unberechenbaren Ereignisse kommen zuerst?
- Was ändert sich pro Wald ausser Bäumen und Feuerherden (z.B. Flüsse)?
- Sieg und Fortschritt: nur Ausgang, oder auch Zeit und Punkte?
- Soundtrack: Emre macht die Musik selbst (Künstlername EMOS). Konzept steht noch aus.
