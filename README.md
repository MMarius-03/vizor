# Vizor

Aplicatie web AR pentru iPhone care suprapune indicatori de marja peste carduri
tiparite. Proiectul este static: nu are dependinte npm si nu necesita build.

## Pornire locala

Camera functioneaza numai dintr-un context securizat. Pentru inspectarea
interfetei local, ruleaza:

```powershell
python -m http.server 4173
```

Deschide `http://localhost:4173`. Pentru camera pe iPhone se foloseste adresa
GitHub Pages, care ruleaza pe HTTPS.

## Verificarea AR

1. Deschide `ar-test.html` pe iPhone, prin HTTPS.
2. Apasa `Porneste testul` si acorda acces la camera.
3. Arata markerul cu codul `0` in fata camerei.

In aceasta etapa folosim marker barcode 3x3 din AR.js. Cardurile pentru print
vor fi adaugate dupa ce validam detectia pe dispozitivul real.

## Structura

```text
css/vizor.css       Stilurile comune
js/catalog.js       Catalogul demonstrativ
js/model.js         Calculele de marja si formatarea RO
js/panel.js         Panouri AR desenate in canvas
js/ar.js            Scena si evenimentele AR.js
js/app.js           Ecranul de pornire
ar-test.html        Test izolat pentru markerul 0
```

AR.js este fixat la versiunea `3.4.8`, care include A-Frame `1.6.0` si suport
pentru markere barcode. Vezi documentatia oficiala AR.js pentru marker-based AR.

