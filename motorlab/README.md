# MotorLab — atelier V8, versiunea 05 · gesturi explicite și rotire fluidă

Prototip independent, în `motorlab/`. HoloLab și cele trei scene din rădăcina proiectului rămân nemodificate.

## Pornire

Din rădăcina repository-ului:

```powershell
python -m http.server 4173
```

Deschide `http://localhost:4173/motorlab/`. Pe iPhone, folosește Safari și varianta HTTPS de pe GitHub Pages: <https://mmarius-03.github.io/vizor/motorlab/>. Camera necesită HTTPS sau localhost; un IP local servit prin HTTP nu este suficient. Three.js se încarcă din CDN; MediaPipe se încarcă numai când activezi separat „Gesturi în cameră”.

## Interacțiune

- **Interfață redusă:** scena ocupă ecranul. Bara principală conține Camera, Pornire și Rotire. Accelerația apare când motorul este pornit, iar remontarea individuală numai după scoaterea unei piese. Camera față/spate, gesturile, încadrarea video, Interior, încadrarea motorului, reasamblarea și ghidul sunt în meniul din dreapta sus.
- **Gesturi în cameră:** pornește camera, apoi activează separat „Gesturi în cameră” din meniu. Sprijină telefonul și asigură-te că mâna este vizibilă în camera aleasă; cu camera spate, ea trebuie să fie în fața obiectivului din spate. Arată mâna deschisă, apoi indică piesa cu arătătorul până apare conturul. Unește vârfurile arătătorului și degetului mare pentru prindere, mută mâna și deschide degetele pentru eliberare. Palma deschisă în mișcare rotește motorul fără să desprindă piese. Cursorul și mesajul de stare arată dacă a fost văzută mâna, ținta sau prinderea.
- **Două mâini:** piesele se blochează imediat ce ambele mâini sunt detectate, înainte de primul pinch. Pinch cu ambele activează navigarea: mutarea lor împreună rotește vederea, depărtarea/apropierea face zoom. Întârzierea celui de-al doilea pinch nu extrage piese. Pentru a reveni la demontare, scoate o mână din cadru și deschide degetele celeilalte. Butoanele rămân accesibile prin pinch.
- **Mod rotire:** butonul este direct în bara de jos, pentru acces cu degetul mare când ții telefonul. Activează-l pentru rotire cu un deget oriunde pe ecran, inclusiv deasupra pieselor. Extragerea și deplasarea pieselor sunt blocate până dezactivezi modul. OrbitControls aplică amortizare și suportă apropierea/depărtarea cu două degete. Schimbarea modului încheie prinderea curentă. Piesele deja așezate pe banc își păstrează pozițiile în scenă.
- **Prinde direct:** trage o piesă cu degetul sau mouse-ul, fără listă și fără selectare prealabilă. Modelul oferă 85 de elemente geometrice detașabile, inclusiv cele opt pistoane, bielele, arborele și roțile dințate. Cele nouă volume auxiliare aproape transparente nu interceptează atingerea.
- **Așază liber:** eliberarea lasă piesa în poziția aleasă, fără revenire sau snap automat. O poți prinde din nou. Piesele scoase sunt desenate deasupra motorului pentru a rămâne vizibile. Pozițiile se păstrează în sesiunea curentă, inclusiv la rotirea vederii și comutarea camerei, dar nu după reîncărcarea paginii.
- **Interior:** activ implicit; carcasele sunt transparente și nu blochează prinderea mecanismului. Dezactivează-l pentru a vedea și demonta componentele exterioare.
- **Touch și mouse:** trage fundalul gol sau activează Rotire pentru a roti vederea. Două degete pe ecran sau rotița mouse-ului fac zoom. În timpul atingerii ecranului, detectorul de mâini este suspendat ca să nu blocheze accidental prinderea unei piese. Încadrează readuce toate piesele în cadru. Acest control rămâne disponibil și când camera este refuzată sau indisponibilă.
- **Montează:** readuce doar piesa aleasă la loc. Reasamblează le readuce pe toate, fără a reseta vederea.
- **Motor:** buton de pornire/oprire și manetă de accelerație 800–6.500 RPM. Turația afișată este simulată; mișcarea este încetinită pentru observare. Este folosit numai ciclul mecanic de la începutul clipului, nu secvența de desfacere automată. Prinderea unei piese oprește motorul; piesele mecanismului trebuie montate înainte de repornire. Capacele pot rămâne pe banc.
- **Camera:** pornește cu camera spate; pe telefon, atingerile pe ecran sunt controlul direct când ții dispozitivul într-o mână. În portret cere flux video vertical de 540 × 960 la 24 FPS când camera îl poate oferi; meniul arată rezoluția și FPS-ul efectiv raportate de browser. Implicit „Cadru complet” arată întregul flux, fără decupare; „Umple ecranul” îl decupează pentru a umple ecranul. Schimbă camera din meniu comută față/spate. Imaginea frontală este oglindită, cea din spate nu.
- **Portret și orizontal:** scena, bara de control, meniul și încadrarea motorului răspund la dimensiunea reală a viewport-ului. Pe iPhone 16 Pro Max, Apple specifică ecran de 6,9″ și 2868 × 1320 pixeli fizici; viewport-ul CSS din Safari nu are obligatoriu aceste dimensiuni și se schimbă cu orientarea/barele browserului. În orizontal, comenzile rămân în dreapta, iar motorul în zona liberă din stânga.
- **Diagnostic pe telefon:** deschide pagina cu `?debug=1` pentru FPS observat, rezoluția de randare, dimensiunea viewport-ului, numărul de mâini detectate, starea gestului și ținta. Indicatorul este ascuns în utilizarea normală.
- **O singură mână:** pe ecran, trage o piesă pentru prindere și apasă Rotire din bara de jos pentru a trage oriunde fără demontare. Prin cameră, indică piesa și fă pinch pentru prindere; palma deschisă sau pinch pe fundal rotește vederea. În timpul rotirii piesele nu pot fi scoase.

## Afișare și stabilitatea gesturilor

Interfața folosește o paletă negru-cărbune și galben de atelier, fontul Manrope pentru comenzile principale și IBM Plex Mono pentru valorile tehnice. Panourile sunt mate, fără blur costisitor, iar galbenul marchează acțiunile și piesa vizată. Contrastul textului și al butonului principal a fost verificat față de fundalurile lor.

Motorul folosește din nou hărțile originale de culoare și ocluzie, cu finisaje distincte de aluminiu, oțel, vopsea și cauciuc. Iluminarea de studio, reflexiile și umbrele în timp real înlocuiesc suprafețele uniforme ale versiunii 02. Carcasele au un material transparent simplificat în modul Interior; piesele vizate primesc un contur geometric, nu o cutie în jurul lor. Geometria și rezoluția texturilor sursă nu sunt schimbate.

Mișcarea cursorului este filtrată adaptiv. Prinderea folosește praguri separate de închidere/deschidere, confirmare temporală și ținta indicată imediat înainte de închiderea degetelor. O mână care intră deja închisă în cadru nu apucă accidental o piesă. Palma deschisă are rol distinct de navigare; pentru piesă se folosește arătătorul, urmat de pinch. La pierderea mâinii, deplasarea se suspendă imediat, apoi piesa este eliberată în ultima poziție după aproximativ 380 ms. Blocarea fluxului video resetează gestul. Asocierea mâinilor urmărește poziția încheieturilor, nu ordinea rezultatelor detectorului. Blocarea pentru două mâini persistă la pierderea temporară a detecției și nu expiră cât mâna rămasă este închisă.

Ciclul motorului corectează deriva mică a exportului pe întreaga durată, fără frânarea artificială din ultimele 65 ms ale fiecărei repetări. Cadrele intermediare sunt interpolate și mișcarea folosește timpul scurs, nu numărul de cadre. Umbrele se recalculează când motorul se mișcă sau configurația pieselor se schimbă, nu doar pentru rotirea camerei. Rezoluția de randare se adaptează gradual la timpul pe cadru, țintind aproximativ 60 FPS fără a modifica texturile sursă; pe dispozitive lente, imaginea poate deveni puțin mai puțin clară. FPS-ul efectiv depinde de dispozitiv, browser și detecția mâinilor și nu este garantat.

## Structură și limite

`motorlab.js` gestionează scena, mutarea, țintele UI și motorul; `engine-motion.js` construiește un ciclu mecanic repetabil; `engine-appearance.js` definește finisajele; `hand-control.js` separă interpretarea gesturilor de camera/MediaPipe. Nu există build sau suită de teste.

Mutarea se face într-un plan paralel cu ecranul la adâncimea piesei. Acesta este un atelier 3D cu fundal video, nu AR ancorat în camera fizică: piesele nu urmăresc masa sau poziția telefonului în spațiu. Nu există fizică, coliziuni sau dependențe mecanice de demontare. Un mesh nu este întotdeauna o piesă fizică întreagă; elementele neidentificate au etichete generice. Utilizarea camerei și gesturilor trebuie verificată pe dispozitivul real.

`assets/engine.glb` este copia nemodificată a modelului original; metadatele sale sunt păstrate. Materialele mai lizibile sunt aplicate doar la afișare. Creditul în interfață rămâne amânat.
