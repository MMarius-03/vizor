# Etapa 4 — nucleu spațial reactiv

**Stare:** implementată pentru test pe iPhone. Etapa 3 a adus sincronizarea permanentă între telefon și laptop; etapa 4 face schimbările de stare vizibile în volumul obiectului AR.

## Ce se schimbă

1. Fiecare nod activat se ridică din mecanism, aprinde un inel propriu și extinde traseul luminos spre nucleu. Mișcarea se vede din lateral când telefonul se deplasează în jurul imaginii țintă.
2. La al treilea nod, coroana 3D se ridică și un inel luminos se propagă din centru. Laptopul primește aceeași tranziție prin sesiunea online și răspunde cu un halo în jurul imaginii.
3. După completare, atingerea nucleului trimite un alt impuls; glisarea încă rotește mecanismul. **Reia ciclul** retrage nodurile și coroana fără să închidă camera.
4. Modelul păstrează geometrii puține, create o singură dată. Pozițiile și opacitățile se actualizează în bucla deja existentă, fără un al doilea renderer.

## Cum se testează

Pe laptop, deschide RIFT Core și mărește imaginea țintă. Pe iPhone, deschide linkul sesiunii în Safari, pornește camera și încadrează imaginea. Atinge nucleul, glisează orizontal peste el, apoi activează cele trei puncte de pe obiect sau din comenzile de jos. După fiecare punct, mișcă telefonul puțin spre stânga și dreapta ca să vezi ridicarea în spațiu. La 3/3, observă coroana și impulsul; atinge din nou nucleul și urmărește reacția laptopului. Reia ciclul și verifică retragerea.

AR-ul fizic, stabilitatea ancorei și lizibilitatea din unghiuri laterale se validează pe iPhone. Testele de browser pot verifica logica și compoziția interfeței, dar nu simulează camera reală și lumina din cameră.
