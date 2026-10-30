# RIFT

O experiență AR fără marker: laptopul reglează ruptura, iar iPhone-ul plasează portalul în spațiul real și atinge cele trei ancore. Poate fi explorată și solo, direct pe telefon. Folderul este independent de HoloLab și MotorLab.

## Deschide experiența

Deschide [RIFT pe GitHub Pages](https://mmarius-03.github.io/vizor/rift/) pe laptop și pe iPhone. Laptopul creează o cameră cu un cod de 6 caractere; „Copiază linkul” pregătește automat adresa de iPhone cu codul inclus. Sincronizarea se face prin [backendul online RIFT](https://rift-sync-api.grassyyew19.chatgpt.site/), cu stocare persistentă pentru camerele temporare. Nu trebuie să pornești laptopul ca server. Camerele expiră după aproximativ două ore de inactivitate.

## Pornire locală opțională

Ai nevoie de Node.js 20+.

```powershell
node rift/server.mjs
```

Pentru dezvoltare sau testarea unui build local pe două dispozitive, într-un al doilea terminal pornește un tunel HTTPS temporar:

```powershell
npx --yes wrangler tunnel quick-start http://127.0.0.1:4174
```

Deschide URL-ul `https://...trycloudflare.com` afișat de tunel **pe laptop**, apoi folosește „Copiază linkul” pentru iPhone. Deschide linkul în Safari; codul se completează automat. Nu folosi `localhost` pe iPhone. Lasă pornite serverul, tunelul și laptopul cât durează acest test local. Linkul GitHub Pages folosește automat backendul online, iar linkul local folosește serverul local.

## Interacțiune

1. Pe laptop apasă „Deschide ruptura”.
2. Pe iPhone permite camera din spate, mișcă-l lent până apare „Spațiu identificat”, apoi atinge podeaua la aproximativ 2–4 metri. Folosește o suprafață cu detalii vizuale și lumină bună.
3. Reglează frecvența la 22%, 52%, apoi 82% pe laptop (sau pe telefon în modul solo) și atinge pe rând cele trei ancore luminoase de pe marginea portalului.
4. Când cele trei ancore sunt aprinse, ține apăsat circa 1,5 secunde pe centrul portalului.
5. Butonul rotund din dreapta sus resetează experiența. După închidere, „Deschide din nou” de pe laptop permite plasarea portalului într-un loc nou.

## Limitări cunoscute

- Tracking-ul markerless depinde de lumină, textura podelei și mișcarea camerei. Nu a fost încă verificat fizic pe un iPhone 16 Pro Max în acest mediu.
- Versiunea AR folosește Three.js și motorul web 8th Wall prin CDN. Are nevoie de rețea, HTTPS și permisiune de cameră. Demo-ul 3D nu are nevoie de cameră, dar are nevoie de WebGL.
- Camerele sunt temporare și expiră la inactivitate. Codul funcționează ca un secret de acces; nu îl distribui în afara persoanelor cu care vrei să testezi.

## Fișiere

`index.html`, `styles.css`, `app.js` și `portal.js` sunt experiența web. `protocol.js` definește starea și regulile interacțiunilor, iar `server.mjs` oferă sesiuni locale pentru dezvoltare. Sursa backendului online este pe [ramura `rift-backend`](https://github.com/MMarius-03/vizor/tree/rift-backend), ca proiect Sites separat, cu stocare D1. Nu există dependențe npm instalate în `rift/`.

Motorul 8th Wall este distribuit separat sub licența furnizorului; vezi [NOTICE.md](./NOTICE.md).
