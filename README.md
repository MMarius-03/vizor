# Vizor

Aplicatie web statica pentru scanarea codurilor de bare si QR pe telefon.
Un EAN/GTIN valid este cautat in Open Food Facts; un QR obisnuit arata doar
destinatia linkului, fara sa pretinda ca identifica produsul. Modul AR cu
markere si demo-ul de panouri raman disponibile separat.

## Linkuri

- Aplicatie: https://mmarius-03.github.io/vizor/
- Test tehnic marker 0: https://mmarius-03.github.io/vizor/ar-test.html

## Test pe iPhone

1. Deschide aplicatia in Safari si apasa **Scaneaza un produs**. Permite camera.
2. Indreapta camera spre un cod de bare EAN sau QR, tinand codul in cadru.
3. Pentru proba fara camera, apasa **Vezi sticla Aqua Carpatica**. Exemplul
   cauta in timp real EAN-ul `5942326402258` si arata datele disponibile.
4. **Introdu codul manual** permite testarea fara decodare video.
5. In fisa produsului poti vedea sursele si calcula pretul per litru. Pretul
   este introdus de utilizator; aplicatia nu citeste pretul de pe raft.

Datele Open Food Facts sunt colaborative si pot fi incomplete sau gresite.
Informatiile despre lot, autenticitate, pret si data expirarii nu sunt deduse
din EAN. Linkurile QR nu se deschid automat. Imaginea camerei nu este incarcata
pe server, dar codul detectat este trimis la Open Food Facts pentru cautare.

## Dezvoltare locala

```powershell
python -m http.server 4173
```

Deschide `http://localhost:4173`. Camera functioneaza in context securizat
(`localhost` sau HTTPS). Cititorul `@zxing/browser` 0.2.1 este incarcat din
CDN doar la scanarea unui produs. A-Frame 1.6.0 si AR.js 3.4.8 sunt incarcate
doar in modul AR.

Verificarea automata a interfetei foloseste optional Playwright:

```powershell
node tests/smoke.cjs
```

Scriptul presupune ca Playwright este disponibil local. Nu face parte din
aplicatia publicata si nu este necesar pentru rularea ei.
