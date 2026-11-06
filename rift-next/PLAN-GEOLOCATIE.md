# Geolocație CAMPUS — beta v38

Disponibilă în `explore.html#location` (fără cameră/poster) și în panoul **Hartă** din AR. Utilizatorul apasă explicit **Arată unde sunt**. La încărcarea paginii nu cerem locația. GitHub Pages oferă HTTPS; `navigator.geolocation.watchPosition` cere și permisiunea browserului. Nu necesită un server propriu sau cheie Google Maps.

## Comportament

- Pin roșu și inel de incertitudine doar pentru o poziție de maximum 15 secunde, cu precizie GPS declarată de maximum 35 m.
- Verificare în poligonul campusului. În afara campusului nu proiectăm forțat poziția în machetă. Aproape de graniță, dacă raza de precizie intersectează limita, așteptăm o măsurare mai sigură.
- Mesaje distincte pentru lipsa permisiunii, semnal indisponibil, întârziere, precizie slabă și poziție expirată; pinul dispare în toate aceste cazuri.
- **Oprește locația** închide urmărirea și ascunde pinul. Trecerea în fundal suspendă urmărirea. Revenirea o reia numai dacă utilizatorul a activat-o în pagina curentă. Reîncărcarea cere din nou apăsarea butonului.
- Coordonatele sunt procesate doar în memorie în browser; nu le salvăm în storage și nu le transmitem serverului proiectului. Serviciul de localizare al sistemului/browserului rămâne responsabil pentru obținerea poziției.
- Spunem „în apropierea corpului A”, nu „în corpul A”. Nu detectăm încăperi sau etaje. Traseele au în continuare plecarea aleasă manual.
- Geolocația nu înlocuiește trackingul AR. Modul AR cere posterul; explorarea 3D poate fi folosită direct în campus fără acesta. Încărcarea necesită internet.

## Date și calibrare

Surse: [planul oficial USV](https://usv.ro/resurse/harta-interactiva-usv/) pentru machetă și © [OpenStreetMap contributors](https://www.openstreetmap.org/copyright) pentru coordonate. `studies/campus-geo-data.js` este un set geospațial adaptat, distribuit sub ODbL 1.0. Conține sursa și data extragerii, 2026-11-06.

Limita campusului: [OSM way 990421264](https://www.openstreetmap.org/way/990421264). Cele șase repere sunt B, C, A, D, E și Observatorul; fiecare are link la obiectul OSM în fișierul de date. Pentru B și Observator s-a folosit centrul amprentei clădirii; celelalte sunt noduri denumite din OSM.

Coordonatele sunt convertite local în metri, apoi printr-o transformare afină în planul schematic 0–1000. Origine: 47.641 N, 26.244 E. Coeficienții au fost calculați prin metoda celor mai mici pătrate din cele șase corespondențe geografice/machetă. Transformarea permite rotație și scări diferite pe axe, deoarece macheta nu reproduce fidel distanțele reale.

Reziduurile la cele șase repere: B 2.27 m; Observator 7.16 m; C 6.29 m; A 19.42 m; D 15.79 m; E 7.77 m. Folosim **20 m suplimentari** la raza GPS pentru inelul estimat pe machetă. Acest adaos este o estimare din ajustarea reperelor, **nu o garanție de precizie** pentru restul campusului. Nu reprezintă un interval statistic de încredere combinat. Inelul devine elipsă pe planul schematic deoarece scările diferă.

Linkul Google Maps oferit de utilizator indică centrul vizualizării, nu un reper măsurat, deci nu a fost folosit singur pentru calibrare. Nu încorporăm hărți sau imagini Google.

## Verificări și test pe teren

`node rift-next/tools/geolocation.cjs` folosește exclusiv coordonate simulate: interior/exterior, limită, precizie, date expirate/invalide, permisiune refuzată, timeout, oprire, reluare, click pe pin și absența salvării. `tools/explore.cjs` și `tools/smoke.cjs` acoperă explorarea și integrarea AR. Aceste teste nu măsoară precizia GPS a unui iPhone real.

În campus: deschide explorarea fără poster pe Safari, permite locația precisă, verifică pinul la trei repere vizibile (de exemplu intrarea A, Observator, parc), apoi mergi între ele. Compară cu planul și notează abaterea/direcția; corectăm reperele dacă apare o deplasare sistematică. Verifică apoi revenirea din altă aplicație, blocarea ecranului, oprirea localizării și mesajul din afara campusului. Lângă clădiri și în interior precizia poate fi insuficientă. Nu promitem navigare pietonală exactă înainte de această calibrare pe teren.

Referință tehnică: [MDN — watchPosition](https://developer.mozilla.org/en-US/docs/Web/API/Geolocation/watchPosition).
