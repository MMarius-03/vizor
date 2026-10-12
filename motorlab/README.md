# MotorLab — atelier V8, versiunea 03 · mâinile pe primul loc

Prototip independent, în `motorlab/`. HoloLab și cele trei scene din rădăcina proiectului rămân nemodificate.

## Pornire

Din rădăcina repository-ului:

```powershell
python -m http.server 4173
```

Deschide `http://localhost:4173/motorlab/`. Pe iPhone, folosește Safari și varianta HTTPS de pe GitHub Pages: <https://mmarius-03.github.io/vizor/motorlab/>. Camera necesită HTTPS sau localhost; un IP local servit prin HTTP nu este suficient. Three.js și, la activarea camerei, MediaPipe se încarcă din CDN și necesită internet.

## Interacțiune

- **Interfață redusă:** scena ocupă ecranul. Bara principală conține doar Mâini, Pornire și Interior. Accelerația apare când motorul este pornit, iar remontarea individuală numai după scoaterea unei piese. Camera față/spate, rotirea cu o mână, încadrarea, reasamblarea și ghidul sunt în meniul din dreapta sus.
- **Mâinile sunt controlul principal:** apasă Activează mâinile, sprijină telefonul și ține mâinile în lumină. Arată mâna cu degetele deschise, indică o piesă până apare confirmarea portocalie, apoi fă pinch (arătător + deget mare). Mută mâna și deschide degetele pentru a lăsa piesa. Și butoanele se apasă prin pinch; accelerația se prinde și se trage în același mod.
- **Două mâini:** pinch cu ambele activează navigarea. Mutarea lor împreună rotește vederea; depărtarea/apropierea face zoom. Deschide degetele înainte de următoarea prindere. Pentru o singură mână, activează Rotire din meniu; dezactiveaz-o pentru a reveni la piese.
- **Prinde direct:** trage o piesă cu degetul sau mouse-ul, fără listă și fără selectare prealabilă. Modelul oferă 85 de elemente geometrice detașabile, inclusiv cele opt pistoane, bielele, arborele și roțile dințate. Cele nouă volume auxiliare aproape transparente nu interceptează atingerea.
- **Așază liber:** eliberarea lasă piesa în poziția aleasă, fără revenire sau snap automat. O poți prinde din nou. Piesele scoase sunt desenate deasupra motorului pentru a rămâne vizibile. Pozițiile se păstrează în sesiunea curentă, inclusiv la rotirea vederii și comutarea camerei, dar nu după reîncărcarea paginii.
- **Interior:** activ implicit; carcasele sunt transparente și nu blochează prinderea mecanismului. Dezactivează-l pentru a vedea și demonta componentele exterioare.
- **Touch și mouse:** trage fundalul gol sau activează Rotire pentru a roti vederea. Două degete pe ecran sau rotița mouse-ului fac zoom. Încadrează readuce toate piesele în cadru. Acest control rămâne disponibil și când camera este refuzată sau indisponibilă.
- **Montează:** readuce doar piesa aleasă la loc. Reasamblează le readuce pe toate, fără a reseta vederea.
- **Motor:** buton de pornire/oprire și manetă de accelerație 800–6.500 RPM. Turația afișată este simulată; mișcarea este încetinită pentru observare. Este folosit numai ciclul mecanic de la începutul clipului, nu secvența de desfacere automată. Prinderea unei piese oprește motorul; piesele mecanismului trebuie montate înainte de repornire. Capacele pot rămâne pe banc.
- **Camera:** pornește preferabil camera din spate; Schimbă camera din meniu comută față/spate. Imaginea frontală este oglindită, cea din spate nu. Camera acoperă întregul ecran, inclusiv zona butoanelor, pentru ca gesturile să le poată atinge.

## Afișare și stabilitatea gesturilor

Motorul folosește din nou hărțile originale de culoare și ocluzie, cu finisaje distincte de aluminiu, oțel, vopsea și cauciuc. Iluminarea de studio, reflexiile și umbrele în timp real înlocuiesc suprafețele uniforme ale versiunii 02. Carcasele au un material transparent simplificat în modul Interior; piesele vizate primesc un contur geometric, nu o cutie în jurul lor. Geometria și rezoluția texturilor sursă nu sunt schimbate.

Mișcarea cursorului este filtrată adaptiv. Prinderea folosește praguri separate de închidere/deschidere, confirmare temporală și ținta indicată imediat înainte de închiderea degetelor. O mână care intră deja închisă în cadru nu apucă accidental o piesă. La pierderea mâinii, deplasarea se suspendă imediat, apoi piesa este eliberată în ultima poziție după aproximativ 380 ms. Blocarea fluxului video resetează gestul. Asocierea mâinilor urmărește poziția încheieturilor, nu ordinea rezultatelor detectorului. Când sunt două mâini vizibile, o scurtă fereastră permite celui de-al doilea pinch să intre în navigare înainte de extragerea unei piese.

## Structură și limite

`motorlab.js` gestionează scena, mutarea, țintele UI și motorul; `engine-motion.js` construiește un ciclu mecanic repetabil; `engine-appearance.js` definește finisajele; `hand-control.js` separă interpretarea gesturilor de camera/MediaPipe. Nu există build sau suită de teste.

Mutarea se face într-un plan paralel cu ecranul la adâncimea piesei. Acesta este un atelier 3D cu fundal video, nu AR ancorat în camera fizică: piesele nu urmăresc masa sau poziția telefonului în spațiu. Nu există fizică, coliziuni sau dependențe mecanice de demontare. Un mesh nu este întotdeauna o piesă fizică întreagă; elementele neidentificate au etichete generice. Utilizarea camerei și gesturilor trebuie verificată pe dispozitivul real.

`assets/engine.glb` este copia nemodificată a modelului original; metadatele sale sunt păstrate. Materialele mai lizibile sunt aplicate doar la afișare. Creditul în interfață rămâne amânat.
