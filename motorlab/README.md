# MotorLab — atelier V8, versiunea 02

Prototip independent, în `motorlab/`. HoloLab și cele trei scene din rădăcina proiectului rămân nemodificate.

## Pornire

Din rădăcina repository-ului:

```powershell
python -m http.server 4173
```

Deschide `http://localhost:4173/motorlab/`. Pe iPhone, folosește Safari și varianta HTTPS de pe GitHub Pages: <https://mmarius-03.github.io/vizor/motorlab/>. Camera necesită HTTPS sau localhost; un IP local servit prin HTTP nu este suficient. Three.js și, la activarea camerei, MediaPipe se încarcă din CDN și necesită internet.

## Interacțiune

- **Prinde direct:** trage o piesă cu degetul sau mouse-ul, fără listă și fără selectare prealabilă. Modelul oferă 85 de elemente geometrice detașabile, inclusiv cele opt pistoane, bielele, arborele și roțile dințate. Cele nouă volume auxiliare aproape transparente nu interceptează atingerea.
- **Așază liber:** eliberarea lasă piesa în poziția aleasă, fără revenire sau snap automat. O poți prinde din nou. Piesele scoase sunt desenate deasupra motorului pentru a rămâne vizibile. Pozițiile se păstrează în sesiunea curentă, inclusiv la rotirea vederii și comutarea camerei, dar nu după reîncărcarea paginii.
- **Interior:** activ implicit; carcasele sunt transparente și nu blochează prinderea mecanismului. Dezactivează-l pentru a vedea și demonta componentele exterioare.
- **Rotește / zoom:** trage fundalul gol sau activează Rotește pentru a roti vederea. Două degete sau rotița mouse-ului fac zoom. Încadrează readuce toate piesele în cadru.
- **Montează:** readuce doar piesa aleasă la loc. Reasamblează le readuce pe toate, fără a reseta vederea.
- **Motor:** buton de pornire/oprire și manetă de accelerație 800–6.500 RPM. Turația afișată este simulată; mișcarea este încetinită pentru observare. Este folosit numai ciclul mecanic de la începutul clipului, nu secvența de desfacere automată. Prinderea unei piese oprește motorul; piesele mecanismului trebuie montate înainte de repornire. Capacele pot rămâne pe banc.
- **Camera:** pornește preferabil camera din spate. Butonul ⇄ comută față/spate; imaginea frontală este oglindită, cea din spate nu. Pinch direct pe piesă pentru prindere, mută mâna și deschide degetele pentru eliberare. Pierderea mâinii eliberează piesa în ultima poziție. Touch funcționează și fără cameră.

## Structură și limite

`motorlab.js` gestionează scena, mutarea și motorul; `engine-motion.js` construiește un ciclu mecanic repetabil; `hand-control.js` gestionează camera și mâna. Nu există build sau suită de teste.

Mutarea se face într-un plan paralel cu ecranul la adâncimea piesei. Acesta este un atelier 3D cu fundal video, nu AR ancorat în camera fizică: piesele nu urmăresc masa sau poziția telefonului în spațiu. Nu există fizică, coliziuni sau dependențe mecanice de demontare. Un mesh nu este întotdeauna o piesă fizică întreagă; elementele neidentificate au etichete generice. Utilizarea camerei și gesturilor trebuie verificată pe dispozitivul real.

`assets/engine.glb` este copia nemodificată a modelului original; metadatele sale sunt păstrate. Materialele mai lizibile sunt aplicate doar la afișare. Creditul în interfață rămâne amânat.
