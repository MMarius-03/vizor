# Etapa 6 — trei experiențe AR la alegere

**Stare:** machete 3D ATLAS și ORBIT disponibile în `studies/`; integrarea AR și interfața finală urmează după alegerea formei. Nucleul are inspecția în straturi din etapa 5.

La început, înainte de pornirea camerei, utilizatorul alege **una dintre trei experiențe**: Nucleu (cea existentă) și două animații noi. Alegerea trebuie să fie rapidă și clară, fără o pagină plină de carduri. Laptopul și iPhone-ul afișează aceeași alegere prin sesiunea online.

## Fluxul interfeței

1. Linkul de iPhone deschide ecranul de alegere, nu camera. Sunt vizibile cele trei experiențe, fiecare cu un nume, o descriere scurtă și un indiciu despre gest. Niciuna nu pornește automat.
2. Atingerea unei opțiuni o marchează clar ca activă. Un singur buton principal, **Pornește camera**, lansează experiența selectată.
3. În AR, un buton **Înapoi** rămâne vizibil într-un colț sigur al ecranului. El oprește camera și revine la selecție, fără să folosească navigarea browserului și fără să schimbe codul sesiunii.
4. Din selecție se poate alege altă experiență. Progresul fiecăreia se păstrează separat în aceeași sesiune; când revii la ea, își reia starea. **Reia ciclul** resetează doar experiența curentă și are un rol distinct de **Înapoi**.
5. Laptopul arată discret alegerea curentă și starea ei lângă imaginea țintă. Imaginea scanată rămâne identică, iar în cameră este încărcată o singură scenă 3D la un moment dat.

Interfața de alegere folosește trei rânduri tipografice aerisite, nu carduri decorative. Păstrăm paleta și stilul RIFT, ținte tactile mari pentru o mână, spațiile de siguranță ale iPhone-ului și un ecran AR cât mai liber. Butoanele trebuie să aibă stări clare de încărcare și de selecție, iar fluxul se verifică în portret și landscape.

## Cele două propuneri

1. **ATLAS — miniatură arhitecturală.** Un mic oraș se ridică în etape din imaginea de pe laptop. Glisarea controlează momentul construirii, iar atingerea unor clădiri aprinde cartierele; finalul produce o undă de lumină prin întregul oraș. Camera laterală arată clar adâncimea și relația cu ecranul real. Este o scenă spațială, diferită de mecanismul Nucleului.
2. **ORBIT — giroscop suspendat.** Inele pe planuri diferite se rotesc în jurul unui centru, cu parallax clar când telefonul se mișcă lateral. Glisarea schimbă axa și ritmul, atingerea fixează sau eliberează un inel, iar un gest final aliniază orbitele. Este diferit de Nucleu prin controlul continuu al mișcării și al adâncimii.

## Reguli pentru implementare

- Toate trei folosesc aceeași imagine țintă statică și aceeași ancoră AR; animațiile nu modifică pixelii imaginii scanate.
- Fiecare experiență are gesturi, stare și final proprii. Progresul nu se amestecă între ele, iar revenirea prin **Înapoi** păstrează sesiunea online.
- Selecția apare înainte de accesul la cameră și cere o alegere explicită. Laptopul arată discret experiența activă lângă țintă.
- Geometriile și materialele se reutilizează; clădirile pot folosi instancing. Evităm efecte grele de transparență și particule. Validăm fluiditatea și lizibilitatea pe iPhone fizic, în portret și landscape.
- Fiecare animație trebuie să aibă un moment clar de impact vizual, o interacțiune cu un deget și un mod de reluare.

**De decis la etapa 6:** numele finale, aspectul, gesturile exacte și ordinea în selecție. ATLAS și ORBIT sunt direcții de explorat, nu alegeri definitive.
