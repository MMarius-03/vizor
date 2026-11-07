# RIFT — trei obiecte de explorat

Pagina de intrare oferă trei experiențe ancorate de postere tematice de pe laptop. CAMPUS este prima opțiune și arată o machetă interactivă a USV; CORE păstrează posterul RIFT, iar ORBIT are propria țintă AR. Folderul este separat de versiunea [`../rift/`](../rift/). Linkurile vechi cu `experience=atlas` rămân compatibile.

[Planul pentru etapa 6](./PLAN-ETAPA-6.md) notează două experiențe AR propuse pe lângă Nucleu și selecția lor înainte de pornirea camerei.

[Analiza celor zece exemple Three.js și CodePen](./RESEARCH-THREE-EXAMPLES.md) notează tehnicile utile, adaptările necesare pentru iPhone și limitele de acces la surse.

[Etapa 4](./PLAN-ETAPA-4.md) adaugă noduri care se ridică în 3D, o coroană finală și impulsuri spațiale sincronizate cu laptopul.

[Etapa 5](./PLAN-ETAPA-5.md) adaugă inspecția în straturi. Extinderea ei aduce un plan real de tăiere prin camera reactorului, selecția pieselor și trasee scurte de energie.

## Încearcă experiența

**Fără cameră / fără poster:** deschide [Explorare CAMPUS](https://mmarius-03.github.io/vizor/rift-next/explore.html). Rotește prin tragere, mărește cu două degete sau rotița mouse-ului, selectează o clădire și alege traseul. Butonul **De sus** face aleile mai ușor de urmărit. Pe mobil panoul inferior se derulează separat. Încărcarea necesită internet, fără permisiune pentru cameră sau locație.

Traseul confirmat se păstrează în `sessionStorage`, în aceeași filă, inclusiv după repornirea camerei. **Șterge** elimină și salvarea. Segmentele din spatele clădirilor sunt ascunse de acestea; schimbă unghiul pentru a le vedea.

**Locație beta, în campus:** deschide **Poziția mea în campus → Arată unde sunt** și permite locația precisă. Un pin roșu și o zonă estimată apar doar pentru o poziție recentă, suficient de precisă și în interiorul campusului. În AR opțiunea se află în panoul **Hartă**. Poți opri localizarea oricând; coordonatele nu sunt salvate și nu sunt trimise backendului proiectului. [Calibrarea, sursele și limitele geolocației](./PLAN-GEOLOCATIE.md) sunt documentate separat. Traseele păstrează plecarea aleasă manual.

**Demo fără GPS:** în explorarea 3D deschide **Simulează o vizită**, alege locul teoretic de plecare și apasă **Arată poziția simulată**. Alege destinația și apasă **Arată traseul**. Glisorul **Parcurge traseul în simulare** mută pinul pe traseul schematic, pentru a testa ghidarea din afara campusului. Modul este marcat permanent „SIMULARE”; nu înseamnă urmărire reală. Când GPS-ul oferă o poziție validă în campus, poți alege **Poziția GPS actuală** ca punct de plecare al unui traseu orientativ. Această primă variantă nu recalculează automat traseul în timpul mersului.

1. Deschide [pagina de alegere](https://mmarius-03.github.io/vizor/rift-next/) pe laptop și alege CAMPUS. Laptopul arată posterul și oferă butonul **Copiază linkul AR**. Lasă pagina deschisă și copiază linkul pe iPhone.
2. Deschide linkul pe iPhone în Safari și pornește camera din spate. Poți deschide și pagina de alegere direct pe telefon și selecta CAMPUS de acolo.
3. Încadrează posterul CAMPUS întreg pe laptop. Macheta apare deasupra tastaturii; apropie-te și mișcă telefonul lateral, apoi atinge clădirile sau pinurile. Traseul dintre două locuri se alege fără GPS.
4. Atinge nucleul pe ecranul telefonului. Carcasa se deschide și rămâne deschisă.
5. Glisează orizontal peste nucleu ca să rotești mecanismul și să aprinzi cele trei puncte. Atinge fiecare punct pe obiect sau folosește cele trei butoane care apar jos după armare. La activare, lumina circulă de la nod spre centru.
6. Atinge carcasa, inelul, rotorul, colierul sau camera reactorului pentru a le identifica. Piesa atinsă este marcată scurt. Atingerea cristalului după 3/3 trimite un impuls.
7. După 3/3, glisează în sus peste nucleu. Secțiunea urmează degetul și se fixează la eliberare. Poți folosi și **Secționează nucleul**. Mișcă telefonul lateral ca să vezi interiorul expus și distanța dintre piese. Glisează în jos sau apasă **Închide secțiunea** pentru a reveni.
8. **Reia ciclul** închide secțiunea și resetează nodurile fără să oprească camera ori să schimbe codul sesiunii. Laptopul arată starea mecanismului în afara imaginii scanate; reîncărcarea filelor păstrează codul și progresul.

[Previzualizarea 3D pe laptop](https://mmarius-03.github.io/vizor/rift-next/model-preview.html) permite rotirea perspectivei prin tragere și deschiderea prin clic. Este un instrument de vizualizare, fără camera AR.

CAMPUS și ORBIT nu folosesc sincronizarea de stare prin server. CAMPUS oferă fișe, selecție și trasee schematice; ORBIT rămâne o machetă beta.

## Tracking și limite

Modul implicit combină recunoașterea imaginii cu world tracking. Adâncimea și scara sunt netezite între cadre, iar dimensiunea locală a modelului rămâne fixă după prima recunoaștere. CAMPUS rămâne vizibil până la 18 secunde când posterul iese din cadru, pentru inspecția clădirilor deasupra tastaturii; după aceea cere reîncadrarea. CORE și ORBIT păstrează intervalul lor scurt de recuperare. `&tracking=image` păstrează modul de comparație doar cu recunoașterea imaginii. `&debug=1` afișează evenimentele, pierderile, recuperările și FPS.

Artefactul și atingerea lui trebuie verificate pe un iPhone fizic. Previzualizarea de desktop și testul cu cameră simulată nu măsoară stabilitatea sau dimensiunea percepută în Safari. Scena nu detectează mâna în imaginea camerei și nu ocluzionează obiecte reale. Camera online este temporară și expiră după două ore fără activitate.

## Implementare

- `target-source.png` este posterul CORE. `target-data/atlas-screen_original.png` și `target-data/orbit-screen_original.png` sunt posterele CAMPUS și ORBIT.
- `tools/make-target.py` regenerează posterul CORE. `tools/make-study-targets.py` regenerează posterele CAMPUS/ORBIT și țintele lor în `target-data/`.
- Definițiile din `target-data/*-screen.json` indică imaginea de recunoaștere grayscale de 480 × 640; CORE folosește ținta procesată de [8th Wall Image Target CLI](https://github.com/8thwall/8thwall/blob/main/apps/image-target-cli/README.md).
- `artifact.js` construiește obiectul din geometrii Three.js: carbon procedural pe carcasa antracit, metal periat pe inele, fațete cyan cu un centru luminos, un vas tăiat cu clipping și un mecanism intern. Marcajele asimetrice fac rotația inelelor vizibilă. Zonele tactile au identificatori de piesă și sunt mai largi decât detaliile vizibile. Traseele de lumină apar doar la activarea nodurilor.
- `app.js` folosește [8th Wall Engine Binary](https://8thwall.org/docs/open-source), [configurarea țintelor](https://8thwall.org/docs/api/engine/xrcontroller/configure) și [evenimentele de tracking](https://8thwall.org/docs/api/engine/xrcontroller/pipelinemodule). `sync.js` transmite starea prin backendul online RIFT. Vezi [NOTICE.md](./NOTICE.md) pentru credite.

## Verificare după schimbări

Pornește `python -m http.server 4173 --bind 127.0.0.1` din rădăcina repo-ului, apoi rulează `node rift-next/tools/selection.cjs <folder-capturi>`, `node rift-next/tools/smoke.cjs`, `node rift-next/tools/sync-audit.cjs` și `node rift-next/tools/visual.cjs <folder-capturi>`. `node rift-next/tools/live-audit.cjs` verifică și backendul online cu o sesiune nouă. Aceste verificări folosesc o cameră simulată; trackingul și gesturile finale se confirmă pe iPhone fizic.
