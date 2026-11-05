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
3. **Poziția vizitatorului:** localizarea opțională va plasa un pin pe hartă după calibrarea coordonatelor geografice; numele corpului va fi afișat ca sigur doar când precizia permite.

ORBIT rămâne în beta. Animațiile dedicate și interacțiunile sale vin după validarea machetei în AR.

## Polish vizual — punctele 4 și 5

4. Vegetație cu trunchiuri și coroane variate, plus bănci în parc. Plasările sunt ilustrative, filtrate pentru a evita clădirile, terenul de sport și aleile. Elementele repetate folosesc instanțe pentru a limita costul de randare.
5. Selecție spațială în AR: pinul sau clădirea atinsă deschide fișa și evidențiază corpul asociat printr-o nuanță albastră și un contur al acoperișului. Terenul de sport primește contur propriu; închiderea fișei și pierderea ancorei după perioada de grație elimină selecția. Nu se folosesc efecte fullscreen de postprocesare.
