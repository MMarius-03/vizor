# Etapa 6 — trei experiențe AR la alegere

**Stare:** ATLAS și ORBIT sunt integrate în fluxul AR pe iPhone, fiecare cu propriul poster tematic și țintă de recunoaștere. Apar complet asamblate și fără secvențele lor de animație; acestea rămân pentru etapele următoare. ATLAS este o machetă schematică a campusului USV, orientată aproape orizontal deasupra tastaturii. Laptopul afișează posterul ales și linkul pentru iPhone.

Utilizatorul alege **una dintre trei experiențe** înainte de pornirea camerei. Alegerea este un ecran tipografic simplu. CORE folosește sesiunea online; ATLAS și ORBIT pornesc solo și nu transmit încă stare între dispozitive.

## Fluxul live actual

1. Pagina de alegere detectează telefonul. Pe iPhone, ATLAS și ORBIT deschid direct pagina lor de pornire AR; pe laptop deschid pagina cu ținta statică și butonul de copiere a linkului pentru telefon.
2. Pe iPhone, **Pornește camera** cere accesul la camera din spate. Modelul apare după recunoașterea posterului ales. **Înapoi** revine la alegere.
3. CORE păstrează fluxul și sincronizarea existente. ATLAS și ORBIT sunt solo, complete și statice; nu au progres comun, reset de animație sau butoane de interacțiune.
4. Posterul ales are o țintă de recunoaștere proprie, iar în cameră este încărcat un singur model la un moment dat.

Interfața de alegere folosește trei rânduri tipografice aerisite, nu carduri decorative. Păstrăm paleta și stilul RIFT, ținte tactile mari pentru o mână, spațiile de siguranță ale iPhone-ului și un ecran AR cât mai liber. Butoanele trebuie să aibă stări clare de încărcare și de selecție, iar fluxul se verifică în portret și landscape.

## Cele două propuneri

1. **ATLAS — miniatură de campus.** Corpurile clădirilor, aleile și curțile verzi urmează o schemă simplificată din hărțile de referință. Versiunea live este statică; interacțiunile de explorare și construcție rămân pentru etapa următoare.
2. **ORBIT — giroscop suspendat.** Inele pe planuri diferite se rotesc în jurul unui centru, cu parallax clar când telefonul se mișcă lateral. Glisarea schimbă axa și ritmul, atingerea fixează sau eliberează un inel, iar un gest final aliniază orbitele. Este diferit de Nucleu prin controlul continuu al mișcării și al adâncimii.

## Reguli pentru implementare

- CORE, ATLAS și ORBIT folosesc postere statice distincte și ținte AR care corespund posterului afișat; animațiile nu modifică pixelii imaginii scanate.
- Selecția apare înainte de accesul la cameră și cere o alegere explicită. Laptopul afișează ținta pentru scanare, fără model 3D.
- ATLAS și ORBIT rămân complet asamblate și nemișcate până la implementarea interacțiunilor și animațiilor dedicate.
- Geometriile și materialele se reutilizează; clădirile pot folosi instancing. Evităm efecte grele de transparență și particule. Validăm fluiditatea și lizibilitatea pe iPhone fizic, în portret și landscape.
- Fiecare animație trebuie să aibă un moment clar de impact vizual, o interacțiune cu un deget și un mod de reluare.

**Următorul pas:** test fizic pe iPhone pentru poziția ATLAS deasupra tastaturii și dimensiunea ORBIT. Apoi se adaugă interacțiunile și animațiile proprii, fără schimbarea imaginii-țintă.
