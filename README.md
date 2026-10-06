# HoloLab

Experienta web 3D controlata prin gesturile mainilor. Camera frontala este
procesata local cu MediaPipe Hand Landmarker, iar scena este randata cu
Three.js. Aplicatia nu necesita marker, instalare sau backend.

## Link

- Aplicatie: https://mmarius-03.github.io/vizor/

## Interactiuni

- **Pinch**: prinde si roteste specimenul prin miscarea mainii.
- **Palma deschisa**: activeaza vederea descompusa.
- **Doua maini**: scaleaza specimenul prin distanta dintre palme.
- **Touch / mouse**: trage pentru rotire; dublu tap activeaza vederea
  descompusa; scroll-ul controleaza scala.

Sunt incluse trei specimene procedurale: atom de carbon, ADN si un sistem
orbital. Schimbarea specimenului declanseaza o noua materializare.

Sistemul vizual foloseste 7.000 de particule pe mobil si 14.000 pe desktop.
Pozitiile sunt calculate intr-un shader WebGL, cu doua puncte de atractie care
urmaresc palmele. Astfel, efectul ramane fluid si pe dispozitive fara WebGPU.

## Test pe iPhone

1. Deschide aplicatia in Safari si apasa **Porneste HoloLab**.
2. Permite camera frontala si tine mana in jumatatea superioara a cadrului.
3. Apropie degetul mare de aratator si misca mana pentru rotatie.
4. Deschide palma pentru a descompune modelul.
5. Ridica ambele maini si modifica distanta dintre ele pentru scalare.

Butonul **Exploreaza fara camera** porneste acelasi laborator in mod tactil,
util ca fallback pentru prezentare.

## Dezvoltare locala

```powershell
python -m http.server 4173
```

Deschide `http://localhost:4173`. Camera functioneaza in context securizat,
adica pe `localhost` sau prin HTTPS. Three.js 0.170.0 si MediaPipe Tasks Vision
1.0.1 sunt incarcate din CDN.

Suita smoke verifica WebKit iPhone 16 Pro Max, un viewport mobil compact,
desktop si pornirea camerei cu un stream simulat:

```powershell
node tests/smoke.cjs <cale-catre-playwright>
```

Scannerul Vizor si experimentul AR anterior raman disponibile in istoricul
Git al proiectului.
