# HoloLab

Experienta web 3D controlata prin gesturile mainilor. Camera frontala este
procesata local cu MediaPipe Hand Landmarker, iar scena este randata cu
Three.js. Aplicatia nu necesita marker, instalare sau backend.

## Link

- Aplicatie: https://mmarius-03.github.io/vizor/

## Interactiuni

- **Arată cu degetul**: direcționează fluxul de particule; un reper luminos
  urmărește vârful arătătorului.
- **Pinch**: roteste si deplaseaza specimenul; tine degetele apropiate pentru
  a incarca energia, apoi elibereaza pentru un impuls de particule.
- **Palma deschisa**: activeaza vederea descompusa.
- **Doua maini**: scaleaza specimenul prin distanta dintre palme.
- **Touch / mouse**: trage pentru rotire, tine apasat si elibereaza pentru
  impuls; dublu tap activeaza vederea descompusa; scroll-ul controleaza scala.
- **Camera**: butonul din partea de sus comuta intre camera frontala si cea
  din spate. Imaginea este oglindita doar pentru camera frontala.

Sunt incluse trei specimene procedurale: atom de carbon, ADN si un sistem
orbital. ADN-ul are 16 perechi animate, iar schimbarea specimenului produce o
animatie de dispersie si reasamblare.

Sistemul vizual foloseste 3.600 de particule pe mobil si 7.200 pe desktop.
Pozitiile sunt calculate intr-un shader WebGL, cu puncte de atractie care
urmaresc degetul, pinch-ul sau palmele. Astfel, efectul ramane fluid si pe
dispozitive fara WebGPU.

## Test pe iPhone

1. Deschide aplicatia in Safari si apasa **Porneste HoloLab**.
2. Permite camera frontala si tine mana in cadru. Butonul cu pictograma
   camerei trece la camera din spate.
3. Arata cu degetul catre scena pentru a atrage fluxul de particule.
4. Apropie degetul mare de aratator, misca mana, apoi elibereaza pentru impuls.
5. Deschide palma pentru a descompune modelul.
6. Ridica ambele maini si modifica distanta dintre ele pentru scalare.

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
