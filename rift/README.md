# RIFT

O experiență AR fără marker: laptopul reglează ruptura, iar iPhone-ul plasează portalul în spațiul real și atinge cele trei ancore. Poate fi explorată și solo, direct pe telefon. Folderul este independent de HoloLab și MotorLab.

## Pornește local

Ai nevoie de Node.js 20+.

```powershell
node rift/server.mjs
```

Pentru testarea pe două dispozitive, într-un al doilea terminal pornește un tunel HTTPS temporar:

```powershell
npx --yes wrangler tunnel quick-start http://127.0.0.1:4174
```

Deschide URL-ul `https://...trycloudflare.com` afișat de tunel **pe laptop**, apoi folosește „Copiază linkul” pentru iPhone. Deschide linkul în Safari; codul se completează automat. Nu folosi `localhost` pe iPhone. Lasă pornite serverul, tunelul și laptopul cât durează testul. URL-ul temporar se schimbă la fiecare pornire și nu este hosting permanent. Sincronizarea folosește cereri scurte, nu SSE, pentru compatibilitate cu tunelul de test.

Pe GitHub Pages, experiența solo și demo-ul 3D funcționează ca site static. Sincronizarea între dispozitive are nevoie de serverul Node de mai sus; nu este oferită de GitHub Pages.

## Interacțiune

1. Pe laptop apasă „Deschide ruptura”.
2. Pe iPhone permite camera din spate, mișcă-l lent până apare „Spațiu identificat”, apoi atinge podeaua la aproximativ 2–4 metri. Folosește o suprafață cu detalii vizuale și lumină bună.
3. Reglează frecvența la 22%, 52%, apoi 82% pe laptop (sau pe telefon în modul solo) și atinge pe rând cele trei ancore luminoase de pe marginea portalului.
4. Când cele trei ancore sunt aprinse, ține apăsat circa 1,5 secunde pe centrul portalului. „Trimite impuls” pe laptop este un efect opțional.
5. Butonul rotund din dreapta sus resetează experiența. După închidere, „Deschide din nou” de pe laptop permite plasarea portalului într-un loc nou.

## Limitări cunoscute

- Tracking-ul markerless depinde de lumină, textura podelei și mișcarea camerei. Nu a fost încă verificat fizic pe un iPhone 16 Pro Max în acest mediu.
- Versiunea AR folosește Three.js și motorul web 8th Wall prin CDN. Are nevoie de rețea, HTTPS și permisiune de cameră. Demo-ul 3D nu are nevoie de cameră, dar are nevoie de WebGL.
- Nu există un backend online persistent pentru codurile de conectare. Linkul GitHub Pages este solo; sesiunea laptop–iPhone funcționează prin URL-ul temporar al tunelului cât timp laptopul este pornit.

## Fișiere

`index.html`, `styles.css`, `app.js` și `portal.js` sunt experiența web. `protocol.js` definește starea și regulile interacțiunilor, iar `server.mjs` oferă sesiuni temporare prin HTTP și polling. Nu există dependențe npm instalate local.

Motorul 8th Wall este distribuit separat sub licența furnizorului; vezi [NOTICE.md](./NOTICE.md).
