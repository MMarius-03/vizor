# RIFT — trei obiecte de explorat

Pagina de intrare oferă trei experiențe ancorate de postere tematice de pe laptop. CORE păstrează posterul RIFT și interacțiunile sale; ATLAS și ORBIT au câte un poster și o țintă AR potrivită temei lor. Modelele ATLAS și ORBIT sunt încă statice, în beta. Folderul este separat de versiunea [`../rift/`](../rift/).

[Planul pentru etapa 6](./PLAN-ETAPA-6.md) notează două experiențe AR propuse pe lângă Nucleu și selecția lor înainte de pornirea camerei.

[Analiza celor zece exemple Three.js și CodePen](./RESEARCH-THREE-EXAMPLES.md) notează tehnicile utile, adaptările necesare pentru iPhone și limitele de acces la surse.

[Etapa 4](./PLAN-ETAPA-4.md) adaugă noduri care se ridică în 3D, o coroană finală și impulsuri spațiale sincronizate cu laptopul.

[Etapa 5](./PLAN-ETAPA-5.md) adaugă inspecția în straturi. Extinderea ei aduce un plan real de tăiere prin camera reactorului, selecția pieselor și trasee scurte de energie.

## Încearcă experiența

1. Deschide [pagina de alegere](https://mmarius-03.github.io/vizor/rift-next/) pe laptop și alege obiectul. Pentru ATLAS sau ORBIT, laptopul arată imaginea-țintă și oferă butonul **Copiază linkul AR**. Lasă pagina deschisă și copiază linkul pe iPhone.
2. Deschide linkul pe iPhone în Safari și pornește camera din spate. Poți deschide și pagina de alegere direct pe telefon și selecta ATLAS sau ORBIT de acolo.
3. Încadrează posterul experienței alese de pe laptop. Obiectul apare numai după recunoașterea țintei potrivite. ATLAS arată o machetă schematică a campusului USV, cu clădiri joase, alei și spații verzi; apropie-te și mișcă telefonul lateral ca să verifici spațiul de sub machetă.
4. Atinge nucleul pe ecranul telefonului. Carcasa se deschide și rămâne deschisă.
5. Glisează orizontal peste nucleu ca să rotești mecanismul și să aprinzi cele trei puncte. Atinge fiecare punct pe obiect sau folosește cele trei butoane care apar jos după armare. La activare, lumina circulă de la nod spre centru.
6. Atinge carcasa, inelul, rotorul, colierul sau camera reactorului pentru a le identifica. Piesa atinsă este marcată scurt. Atingerea cristalului după 3/3 trimite un impuls.
7. După 3/3, glisează în sus peste nucleu. Secțiunea urmează degetul și se fixează la eliberare. Poți folosi și **Secționează nucleul**. Mișcă telefonul lateral ca să vezi interiorul expus și distanța dintre piese. Glisează în jos sau apasă **Închide secțiunea** pentru a reveni.
8. **Reia ciclul** închide secțiunea și resetează nodurile fără să oprească camera ori să schimbe codul sesiunii. Laptopul arată starea mecanismului în afara imaginii scanate; reîncărcarea filelor păstrează codul și progresul.

[Previzualizarea 3D pe laptop](https://mmarius-03.github.io/vizor/rift-next/model-preview.html) permite rotirea perspectivei prin tragere și deschiderea prin clic. Este un instrument de vizualizare, fără camera AR.

ATLAS și ORBIT nu folosesc încă sincronizarea de stare prin server și nu au interacțiunile/etapele lor de animație. În această versiune apar complet asamblate în cameră; interacțiunile și animațiile dedicate se adaugă în etapele următoare.

## Tracking și limite

Modul implicit combină recunoașterea imaginii cu world tracking. Adâncimea și scara sunt netezite între cadre, iar dimensiunea locală a modelului rămâne fixă după prima recunoaștere. ATLAS rămâne vizibil până la 18 secunde când posterul iese din cadru, pentru inspecția clădirilor deasupra tastaturii; după aceea cere reîncadrarea. CORE și ORBIT păstrează intervalul lor scurt de recuperare. `&tracking=image` păstrează modul de comparație doar cu recunoașterea imaginii. `&debug=1` afișează evenimentele, pierderile, recuperările și FPS.

Artefactul și atingerea lui trebuie verificate pe un iPhone fizic. Previzualizarea de desktop și testul cu cameră simulată nu măsoară stabilitatea sau dimensiunea percepută în Safari. Scena nu detectează mâna în imaginea camerei și nu ocluzionează obiecte reale. Camera online este temporară și expiră după două ore fără activitate.

## Implementare

- `target-source.png` este posterul CORE. `target-data/atlas-screen_original.png` și `target-data/orbit-screen_original.png` sunt posterele ATLAS și ORBIT.
- `tools/make-target.py` regenerează posterul CORE. `tools/make-study-targets.py` regenerează posterele ATLAS/ORBIT și țintele lor în `target-data/`.
- Definițiile din `target-data/*-screen.json` indică imaginea de recunoaștere grayscale de 480 × 640; CORE folosește ținta procesată de [8th Wall Image Target CLI](https://github.com/8thwall/8thwall/blob/main/apps/image-target-cli/README.md).
- `artifact.js` construiește obiectul din geometrii Three.js: carbon procedural pe carcasa antracit, metal periat pe inele, fațete cyan cu un centru luminos, un vas tăiat cu clipping și un mecanism intern. Marcajele asimetrice fac rotația inelelor vizibilă. Zonele tactile au identificatori de piesă și sunt mai largi decât detaliile vizibile. Traseele de lumină apar doar la activarea nodurilor.
- `app.js` folosește [8th Wall Engine Binary](https://8thwall.org/docs/open-source), [configurarea țintelor](https://8thwall.org/docs/api/engine/xrcontroller/configure) și [evenimentele de tracking](https://8thwall.org/docs/api/engine/xrcontroller/pipelinemodule). `sync.js` transmite starea prin backendul online RIFT. Vezi [NOTICE.md](./NOTICE.md) pentru credite.

## Verificare după schimbări

Pornește `python -m http.server 4173 --bind 127.0.0.1` din rădăcina repo-ului, apoi rulează `node rift-next/tools/selection.cjs <folder-capturi>`, `node rift-next/tools/smoke.cjs`, `node rift-next/tools/sync-audit.cjs` și `node rift-next/tools/visual.cjs <folder-capturi>`. `node rift-next/tools/live-audit.cjs` verifică și backendul online cu o sesiune nouă. Aceste verificări folosesc o cameră simulată; trackingul și gesturile finale se confirmă pe iPhone fizic.
