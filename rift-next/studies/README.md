# Studii 3D — ATLAS și ORBIT

Aceste pagini sunt previzualizări vizuale pentru ATLAS și ORBIT. `index.html` permite compararea volumelor, culorilor, perspectivei și a vederii tehnice. `models.js` este folosit și de pagina AR live; acolo ATLAS primește o orientare orizontală deasupra tastaturii, iar ambele modele pornesc asamblate și statice. Fiecare experiență are propriul poster și propria țintă de recunoaștere.

## Direcție

- **ATLAS:** machetă schematică a campusului USV, cu corpurile principale din harta furnizată, alei și spații verzi. Cursorul principal ridică sau retrage clădirile; al doilea reglează accentul pinului. Perspectiva se poate roti cu degetul sau mouse-ul.
- **ORBIT:** instrument cu postament, ax, trei brațe, inele pe planuri înclinate și plasmă în centru. Brațele apar pe rând; la capătul calibrării, liniile converg și apare un impuls luminos. Al doilea cursor controlează viteza și intensitatea plasmei, inclusiv pauza.
- Vederea tehnică este o variantă de explorare, nu o suprapunere permanentă peste camera telefonului.

ATLAS folosește hărțile furnizate de utilizator și [harta oficială USV](https://usv.ro/resurse/harta-interactiva-usv/) drept referință pentru contururile și pozițiile relative ale corpurilor, aleilor și parcului. `campus-layout.json` este sursa comună; `tools/make-study-targets.py` generează `campus-layout.js` pentru modelul 3D și posterul pentru tracking. Proporțiile și unele detalii sunt simplificate pentru lizibilitate pe telefon; macheta nu este un plan cadastral.

## Campus map înainte de lansare

1. **Macheta — în lucru:** materiale inspirate din fotografiile campusului, umbre de contact pre-generate, muchii teșite, două rânduri de ferestre și siluete dedicate pentru intrarea corpului A, rotunda și pasarela corpului E, domurile Observatorului și acoperișul arcuit al bazinului. Curtea corpului A este corectată și posterul ATLAS este generat din aceeași geometrie. Urmează verificarea proporțiilor și a materialelor pe iPhone, la campus.
2. **Puncte interactive — implementate în AR:** nouă pinuri pentru locurile din harta oficială USV se proiectează peste machetă. Atingerea unui pin sau a unei clădiri deschide o fișă compactă și linkul către sursă. Poziția, lizibilitatea și gesturile trebuie validate pe iPhone.
3. **Trasee fără GPS — planificate:** plecarea și destinația se aleg manual; traseul se desenează pe rețeaua aleilor. Exemplu: Restaurant → Biblioteca. Nu se solicită localizarea dispozitivului.

ORBIT rămâne în beta. Animațiile dedicate și interacțiunile sale vin după validarea machetei în AR.

## Polish vizual — punctele 4 și 5

4. Vegetație cu trunchiuri și coroane variate, plus bănci în parc. Plasările sunt ilustrative, filtrate pentru a evita clădirile, terenul de sport și aleile. Elementele repetate folosesc instanțe pentru a limita costul de randare.
5. Selecție spațială în AR: pinul sau clădirea atinsă deschide fișa și evidențiază corpul asociat printr-o nuanță albastră și un contur al acoperișului. Terenul de sport primește contur propriu; închiderea fișei și pierderea ancorei după perioada de grație elimină selecția. Nu se folosesc efecte fullscreen de postprocesare.

## Ordinea următoarelor update-uri

1. Stabilitate: filtrare adaptivă după mișcare susținută, respingerea salturilor izolate și reinițializare la redetectarea după pierderea ancorei. Camera rămâne controlată de tracking; filtrăm numai corecțiile ancorei.
2. Randare: alei și borduri instanțiate, transformări locale statice în AR, actualizarea pinurilor fără traversarea întregului model. Rezoluția canvasului este plafonată la 1440 px pe latura lungă și coboară treptat la 85%/70% după performanță scăzută susținută; revine lent când există suficient timp pentru randare. Schimbările de tab și pauzele lungi nu declanșează retrogradarea.
3. Implementat: selecție mai tolerantă a acoperișurilor înguste, cu verificarea corpului vizibil și apariție graduală a evidențierii.
4. Implementat: fișă compactă extensibilă și buton de recentrare care cere reîncadrarea posterului și acceptă imediat următoarea ancoră validă.
5. Apoi: trasee între puncte alese manual, fără GPS. Luminozitatea materialelor rămâne un polish separat.

Dimensionarea adaptivă păstrează lifecycle-ul [XRExtras FullWindowCanvas](https://github.com/8thwall/web/blob/master/xrextras/src/fullwindowcanvasmodule/full-window-canvas-module.ts), care dimensionează canvasul după ecran și video. Nu modifică manual proiecția camerei sau rezoluția sursei video. Testul `tools/atlas-performance.cjs` verifică filtrul la 30/60/120 fps, salturi izolate, redetectare, pragurile de calitate și rotirea canvasului. Aceste simulări nu măsoară FPS-ul sau stabilitatea camerei reale pe iPhone.
