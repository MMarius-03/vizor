# Vizor

Aplicatie web AR pentru iPhone. Proiectul este static si nu necesita build.
Versiunea curenta este pentru teste: modul fara card permite inspectarea
panourilor peste camera, iar modul cu markere testeaza detectia AR.

## Linkuri

- Aplicatie: https://mmarius-03.github.io/vizor/
- Test tehnic marker 0: https://mmarius-03.github.io/vizor/ar-test.html

## Test pe iPhone

1. Deschide aplicatia in Safari si apasa **Testeaza fara card**.
2. Permite accesul la camera. Foloseste sagetile de jos pentru a parcurge cele
   cinci produse. Produsul 2 are marja critica si panou rosu.
3. Inchide testul cu butonul din dreapta sus. Camera trebuie sa se opreasca.
4. **Scaneaza carduri** porneste detectia markerelor barcode 3x3. Cardurile
   printabile sunt inca in pregatire.

Daca accesul la camera este refuzat, butonul **Continua fara camera** permite
testarea incadrarii si a datelor pe un fundal neutru. Modul acesta este o
simulare pe ecran, nu un test de urmarire AR.

## Dezvoltare locala

```powershell
python -m http.server 4173
```

Deschide `http://localhost:4173`. Camera functioneaza in context securizat
(`localhost` sau HTTPS). Bibliotecile A-Frame 1.6.0 si AR.js 3.4.8 sunt
incarcate din CDN numai cand este necesar modul AR.

Verificarea automata a interfetei foloseste optional Playwright:

```powershell
node tests/smoke.cjs
```

Scriptul presupune ca Playwright este disponibil local. Nu face parte din
aplicatia publicata si nu este necesar pentru rularea ei.
