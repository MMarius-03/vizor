# Etapa 6 — trei experiențe AR la alegere

**Stare:** planificată. Nu schimbăm încă nucleul sau fluxul etapei 3. Vom decide forma finală după feedbackul de pe iPhone și după etapele intermediare.

La început, înainte de pornirea camerei, utilizatorul alege **una dintre trei experiențe**: Nucleu (cea existentă) și două animații noi. Alegerea trebuie să fie rapidă și clară, fără o pagină plină de carduri. Laptopul și iPhone-ul afișează aceeași alegere prin sesiunea online.

## Cele două propuneri

1. **ATLAS — miniatură arhitecturală.** Un mic oraș se ridică în etape din imaginea de pe laptop. Glisarea controlează momentul construirii, iar atingerea unor clădiri aprinde cartierele; finalul produce o undă de lumină prin întregul oraș. Camera laterală arată clar adâncimea și relația cu ecranul real. Este o scenă spațială, diferită de mecanismul Nucleului.
2. **ORBIT — giroscop suspendat.** Inele pe planuri diferite se rotesc în jurul unui centru, cu parallax clar când telefonul se mișcă lateral. Glisarea schimbă axa și ritmul, atingerea fixează sau eliberează un inel, iar un gest final aliniază orbitele. Este diferit de Nucleu prin controlul continuu al mișcării și al adâncimii.

## Reguli pentru implementare

- Toate trei folosesc aceeași imagine țintă statică și aceeași ancoră AR; animațiile nu modifică pixelii imaginii scanate.
- Fiecare experiență are gesturi, stare și final proprii. Dacă permitem schimbarea în timpul sesiunii, păstrăm camera și codul, dar nu transferăm progresul între experiențe.
- Selecția apare înainte de accesul la cameră, cu Nucleu ca opțiune inițială până decidem altfel. Laptopul arată discret experiența activă lângă țintă.
- Geometriile și materialele se reutilizează; clădirile pot folosi instancing. Evităm efecte grele de transparență și particule. Validăm fluiditatea și lizibilitatea pe iPhone fizic, în portret și landscape.
- Fiecare animație trebuie să aibă un moment clar de impact vizual, o interacțiune cu un deget și un mod de reluare.

**De decis la etapa 6:** numele finale, aspectul, gesturile exacte, ordinea în selecție și care experiență pornește implicit. ATLAS și ORBIT sunt direcții de explorat, nu alegeri definitive.
