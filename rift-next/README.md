# RIFT — trei obiecte de explorat

Pagina de intrare oferă trei alegeri: CORE este experiența AR ancorată de imaginea statică de pe laptop; ATLAS și ORBIT sunt încă machete 3D fără cameră. Fiecare folosește propria temă vizuală. Folderul este separat de versiunea [`../rift/`](../rift/).

[Planul pentru etapa 6](./PLAN-ETAPA-6.md) notează două experiențe AR propuse pe lângă Nucleu și selecția lor înainte de pornirea camerei.

[Analiza celor zece exemple Three.js și CodePen](./RESEARCH-THREE-EXAMPLES.md) notează tehnicile utile, adaptările necesare pentru iPhone și limitele de acces la surse.

[Etapa 4](./PLAN-ETAPA-4.md) adaugă noduri care se ridică în 3D, o coroană finală și impulsuri spațiale sincronizate cu laptopul.

[Etapa 5](./PLAN-ETAPA-5.md) adaugă inspecția în straturi. Extinderea ei aduce un plan real de tăiere prin camera reactorului, selecția pieselor și trasee scurte de energie.

## Încearcă experiența

1. Deschide [pagina de alegere](https://mmarius-03.github.io/vizor/rift-next/) pe laptop. Alege **CORE**. Așteaptă codul sesiunii, copiază linkul generat pentru iPhone și apasă **Mărește ținta**. Ține imaginea întreagă pe ecran, cu luminozitate suficientă și fără reflexii puternice.
2. Deschide linkul copiat pe iPhone în Safari, alege **CORE**, pornește camera și permite accesul la camera din spate. Codul se păstrează dacă revii la alegere; o adresă fără cod pornește modul solo.
3. Încadrează imaginea RIFT. Mișcă telefonul lateral ca să vezi adâncimea artefactului.
4. Atinge nucleul pe ecranul telefonului. Carcasa se deschide și rămâne deschisă.
5. Glisează orizontal peste nucleu ca să rotești mecanismul și să aprinzi cele trei puncte. Atinge fiecare punct pe obiect sau folosește cele trei butoane care apar jos după armare. La activare, lumina circulă de la nod spre centru.
6. Atinge carcasa, inelul, rotorul, colierul sau camera reactorului pentru a le identifica. Piesa atinsă este marcată scurt. Atingerea cristalului după 3/3 trimite un impuls.
7. După 3/3, glisează în sus peste nucleu. Secțiunea urmează degetul și se fixează la eliberare. Poți folosi și **Secționează nucleul**. Mișcă telefonul lateral ca să vezi interiorul expus și distanța dintre piese. Glisează în jos sau apasă **Închide secțiunea** pentru a reveni.
8. **Reia ciclul** închide secțiunea și resetează nodurile fără să oprească camera ori să schimbe codul sesiunii. Laptopul arată starea mecanismului în afara imaginii scanate; reîncărcarea filelor păstrează codul și progresul.

[Previzualizarea 3D pe laptop](https://mmarius-03.github.io/vizor/rift-next/model-preview.html) permite rotirea perspectivei prin tragere și deschiderea prin clic. Este un instrument de vizualizare, fără camera AR.

Din pagina de alegere poți deschide și **ATLAS** sau **ORBIT** pe laptop ori iPhone. Sunt machete 3D beta cu control prin atingere, cursor și tragere. Nu folosesc încă aparatul foto și nu transmit progresul prin sesiunea online.

## Tracking și limite

Modul implicit combină recunoașterea imaginii cu world tracking. Adâncimea și scara sunt netezite între cadre, iar dimensiunea locală a modelului rămâne fixă după prima recunoaștere. Când recunoașterea se întrerupe scurt, obiectul rămâne la ultima ancoră și se estompează; după o pierdere mai lungă, se ascunde până când imaginea revine. `&tracking=image` păstrează modul de comparație doar cu recunoașterea imaginii. `&debug=1` afișează evenimentele, pierderile, recuperările și FPS.

Artefactul și atingerea lui trebuie verificate pe un iPhone fizic. Previzualizarea de desktop și testul cu cameră simulată nu măsoară stabilitatea sau dimensiunea percepută în Safari. Scena nu detectează mâna în imaginea camerei și nu ocluzionează obiecte reale. Camera online este temporară și expiră după două ore fără activitate.

## Implementare

- `target-source.png` este imaginea statică afișată pe laptop; `tools/make-target.py` o regenerează cu Pillow.
- `target-data/rift-screen.json` și imaginile derivate au fost generate cu [8th Wall Image Target CLI](https://github.com/8thwall/8thwall/blob/main/apps/image-target-cli/README.md).
- `artifact.js` construiește obiectul din geometrii Three.js: carbon procedural pe carcasa antracit, metal periat pe inele, fațete cyan cu un centru luminos, un vas tăiat cu clipping și un mecanism intern. Marcajele asimetrice fac rotația inelelor vizibilă. Zonele tactile au identificatori de piesă și sunt mai largi decât detaliile vizibile. Traseele de lumină apar doar la activarea nodurilor.
- `app.js` folosește [8th Wall Engine Binary](https://8thwall.org/docs/open-source), [configurarea țintelor](https://8thwall.org/docs/api/engine/xrcontroller/configure) și [evenimentele de tracking](https://8thwall.org/docs/api/engine/xrcontroller/pipelinemodule). `sync.js` transmite starea prin backendul online RIFT. Vezi [NOTICE.md](./NOTICE.md) pentru credite.

## Verificare după schimbări

Pornește `python -m http.server 4173 --bind 127.0.0.1` din rădăcina repo-ului, apoi rulează `node rift-next/tools/selection.cjs <folder-capturi>`, `node rift-next/tools/smoke.cjs`, `node rift-next/tools/sync-audit.cjs` și `node rift-next/tools/visual.cjs <folder-capturi>`. `node rift-next/tools/live-audit.cjs` verifică și backendul online cu o sesiune nouă. Aceste verificări folosesc o cameră simulată; trackingul și gesturile finale se confirmă pe iPhone fizic.
