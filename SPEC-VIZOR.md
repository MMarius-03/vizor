# Vizor — specificație de implementare

> **Vizor** · *Vezi marja, nu eticheta.*
> Web app AR care rulează în Safari pe iPhone. Ridici un card, vezi
> profitabilitatea produsului plutind deasupra lui.

Document de implementare. Conține brand, design system, specificația fiecărui
ecran, modelul de date și ordinea de construcție. Scris ca să poată fi dat
direct unui asistent de cod, secțiune cu secțiune.

---

## 1. Produsul

**Numele:** Vizor — „vizor" ca în vizorul unui aparat prin care te uiți.
Cuvânt românesc, scurt, funcționează și în engleză.

**Tagline:** *Vezi marja, nu eticheta.*

**Propoziția de o frază:** Vizor suprapune datele economice ale unui produs
peste produsul fizic, folosind doar camera telefonului și o etichetă printată.

**Ce face concret:** detectează carduri printate, identifică produsul,
calculează marja și desenează un panou colorat ancorat la card.

---

## 2. Brand

### Logo
Tipografic, fără ilustrație. Cuvântul `VIZOR` în majuscule, cu literspacing
larg (`0.18em`), încadrat de două colțuri de vizor:

```
⌐ VIZOR ¬
```

Implementare: text + două elemente `::before` / `::after` desenate ca unghiuri
din `border-top` + `border-left` (respectiv `border-top` + `border-right`),
2px, culoarea brand, 10×10px, offset 6px.

### Culoare

Paleta de brand e **separată** de paleta de status. Niciodată nu folosi verde,
galben sau roșu ca accent de interfață — sunt rezervate semnificației.

| Rol | Token | Valoare |
|---|---|---|
| Fundal | `--bg` | `#07090C` |
| Suprafață | `--surface` | `rgba(255,255,255,.055)` |
| Suprafață ridicată | `--surface-2` | `rgba(255,255,255,.09)` |
| Contur | `--line` | `rgba(255,255,255,.11)` |
| Text principal | `--fg` | `#F4F7F9` |
| Text secundar | `--fg-2` | `#8A97A3` |
| Text terțiar | `--fg-3` | `#5A6672` |
| **Accent brand** | `--brand` | `#0EA5E9` |
| Accent apăsat | `--brand-press` | `#0284C7` |

### Status (semantic, nu decorativ)

| Status | Prag marjă | Token | Culoare | Culoare panou AR |
|---|---|---|---|---|
| Bun | ≥ 25% | `--ok` | `#10B981` | `#0C9B72` |
| Atenție | 10–25% | `--warn` | `#F59E0B` | `#D98806` |
| Critic | < 10% | `--bad` | `#EF4444` | `#DC3A3A` |
| Necunoscut | — | `--unknown` | `#6B7684` | `#5A6472` |

Culorile de panou AR sunt puțin mai saturate și mai închise: sunt văzute prin
cameră, peste o imagine reală, și se spală altfel.

### Tipografie

Stack de sistem — pe iPhone înseamnă SF Pro, adică randare nativă perfectă și
zero timp de încărcare:

```css
font-family: -apple-system, BlinkMacSystemFont, "SF Pro Text",
             system-ui, sans-serif;
```

| Rol | Mărime | Greutate | Observație |
|---|---|---|---|
| Logo | 15px | 600 | `letter-spacing: .18em` |
| Titlu ecran | 26px | 650 | `letter-spacing: -.02em` |
| Titlu secțiune | 11px | 600 | majuscule, `letter-spacing: .08em`, culoare `--fg-2` |
| Corp | 15px | 400 | `line-height: 1.5` |
| Secundar | 13px | 400 | culoare `--fg-2` |
| Număr mare | 30px | 680 | `font-variant-numeric: tabular-nums` |

**Toate cifrele** primesc `tabular-nums`. Fără asta, valorile tremură când se
actualizează și arată amatoricesc.

### Formă și mișcare

```css
--r-sm: 10px;  --r-md: 14px;  --r-lg: 20px;  --r-pill: 999px;
--space: 4px;  /* scala: 4, 8, 12, 16, 20, 24, 32, 40 */
--ease: cubic-bezier(.22,.61,.36,1);
--dur-fast: 140ms;  --dur: 240ms;  --dur-slow: 420ms;
```

Toate suprafețele plutitoare peste cameră folosesc glass:
`background: rgba(10,13,16,.62)` + `backdrop-filter: blur(20px) saturate(160%)`
+ `border: 1px solid var(--line)`.

Respectă `prefers-reduced-motion`: dezactivează animațiile, păstrează
schimbările de stare.

---

## 3. Arhitectură

```
vizor/
├── index.html
├── manifest.json
├── css/
│   └── vizor.css
├── js/
│   ├── app.js          # bootstrap, rutare între ecrane
│   ├── catalog.js      # datele produselor + lookup după cod
│   ├── model.js        # marjă, status, formatare RO
│   ├── panel.js        # randarea panoului AR pe canvas
│   └── ar.js           # scena A-Frame, markere, evenimente
└── assets/
    ├── markers/        # PNG-uri barcode pentru print
    ├── carduri.html    # pagina de print a cardurilor
    └── icon-192.png, icon-512.png
```

**Zero build.** `<script type="module">`, fără npm, fără bundler.
A-Frame și AR.js din `<script>`, versiuni fixate.

---

## 4. Modelul de date

### Catalogul

`catalog.js` exportă un array. Pentru demo e hardcodat — suficient și mai
sigur decât încărcarea de fișiere.

```js
export const CATALOG = [
  { cod: 0, produs: "Salam Victoria",  um: "350 g", pret: 24.90, cost: 18.20, stoc: 142, rotatie: 11 },
  { cod: 1, produs: "Cremwurst clasic", um: "500 g", pret: 19.50, cost: 18.15, stoc:  38, rotatie: 26 },
  { cod: 2, produs: "Parizer porc",     um: "300 g", pret: 11.20, cost:  7.95, stoc: 410, rotatie:  4 },
  { cod: 3, produs: "Mușchi file",      um: "200 g", pret: 32.00, cost: 27.80, stoc:  64, rotatie: 18 },
  { cod: 4, produs: "Cârnați de casă",  um: "1 kg",  pret: 42.50, cost: 24.60, stoc:  87, rotatie:  7 },
];
```

**Datele sunt alese intenționat** ca să acopere toate stările:

| cod | produs | marjă | status |
|---|---|---|---|
| 0 | Salam Victoria | 26,9% | verde |
| 1 | Cremwurst | **6,9%** | **roșu** |
| 2 | Parizer | 29,0% | verde |
| 3 | Mușchi file | 13,1% | galben |
| 4 | Cârnați de casă | 42,1% | verde |

Cardul 1 e dovada vizuală. Fără un roșu clar, demonstrația nu demonstrează nimic.

### Derivatele — `model.js`

```js
marja(p)       = (p.pret - p.cost) / p.pret * 100
valoareStoc(p) = p.cost * p.stoc
status(m)      = m >= 25 ? "ok" : m >= 10 ? "warn" : "bad"
```

Agregat pentru produsele vizibile simultan:

```js
marjaPonderata(list) = Σ((pret-cost) * stoc) / Σ(pret * stoc) * 100
```

### Formatare

Totul prin `Intl.NumberFormat('ro-RO')`. Prețuri cu 2 zecimale și `lei`
după număr. Procente cu o zecimală și semnul `%` lipit.
`24,90 lei` — nu `24.90 RON`.

---

## 5. Ecrane

Trei, atât. Navigare fără router: comuți clasa `.is-active` pe secțiuni.

### 5.1 Start

Primul contact. Explică în 5 secunde și cere permisiunea.

**Compoziție, de sus în jos:**
- Logo `⌐ VIZOR ¬`, centrat, sus
- Titlu: **Vezi marja, nu eticheta.**
- Subtitlu, 2 rânduri: *Ridică un card în fața camerei. Vizor identifică
  produsul și îți arată dacă îți aduce bani.*
- **Trei pași ilustrați**, pe orizontală, cu numere în cerc:
  `1 Pornești camera` · `2 Ridici cardul` · `3 Vezi marja`
- Buton principal, lat, jos: **Pornește camera**
- Sub buton, text mic `--fg-3`: *Camera e folosită doar local. Nimic nu se
  trimite nicăieri.*

**Fundal:** gradient radial discret dinspre `--brand` la 8% opacitate, din
colțul de sus, peste `--bg`. Static, fără animație.

**Starea de eroare de permisiune:** butonul devine `Încearcă din nou`, iar sub
el apare un card roșu-închis cu instrucțiuni exacte:
*Setări → Safari → Cameră → Permite, apoi reîncarcă pagina.*

> Butonul e obligatoriu. Nu porni camera automat la încărcare: pe iOS
> permisiunea cerută într-un gest al utilizatorului e mult mai predictibilă,
> iar utilizatorul înțelege de ce i se cere.

---

### 5.2 Scaner — ecranul principal

Camera ocupă tot ecranul. Peste ea, trei elemente de interfață, toate glass.

**Bara de sus** (sub safe area):
- stânga: logo mic
- dreapta: buton rotund **Produse** (iconiță listă), deschide 5.3

**Indicatorul de stare** — centrat, sub bara de sus, pastilă:

| Stare | Text | Punct |
|---|---|---|
| caută | `Caut un card…` | `--fg-3`, pulsează lent |
| 1 detectat | `1 produs` | `--brand`, fix |
| n detectate | `n produse` | `--brand`, fix |

**Bara de sinteză** — jos, deasupra safe area, apare doar când sunt **≥ 2**
produse în cadru. Trei coloane separate prin linii verticale subțiri:

```
   3 produse  │  valoare stoc  │  marjă medie
              │   8.247 lei    │     24,3%
```

Valoarea „marjă medie" primește culoarea statusului corespunzător.
Animație de intrare: slide-up 12px + fade, `--dur`.

**Primul contact cu ecranul:** dacă după 6 secunde nu s-a detectat niciun card,
apare un hint discret deasupra barei de jos: *Ține cardul la 40–80 cm, bine
luminat.* Dispare la prima detecție și nu mai revine în sesiune.

---

### 5.3 Produse

Deschis ca **bottom sheet**, nu ecran plin — menține contextul, se închide prin
swipe în jos sau tap pe fundal.

- Mâner de 36×4px, centrat sus
- Titlu `Produse` + număr total
- Lista celor 5 produse, fiecare rând:
  - bară verticală de 3px în culoarea statusului, în stânga
  - denumire + unitate (`Salam Victoria · 350 g`)
  - dreapta: marja mare, tabular, colorată; sub ea stocul, `--fg-3`
  - sub denumire, mic: `cod 0` — util ca să știi ce card e care
- Sortare implicită: **marja crescător**. Problema apare prima.
- Jos, un rând cu pragurile active: `verde ≥25% · galben 10–25% · roșu <10%`

Acest ecran e și plasa de siguranță: dacă lumina e proastă și detecția nu merge,
ai aceleași date, accesibile în două tap-uri.

---

## 6. Panoul AR — partea critică

**Nu folosi `<a-text>`.** Randarea de text 3D din A-Frame e imprecisă, greu de
aliniat și devine ilizibilă de la distanță. E riscul numărul unu al proiectului.

**Folosește o textură de canvas.** Desenezi panoul într-un `<canvas>` 2D cu API
de desen normal — fonturi reale, colțuri rotunjite, aliniere exactă — și îl
aplici ca material pe un `<a-plane>`.

### Specificația canvasului

- Rezoluție **768 × 432** (raport 16:9), `devicePixelRatio` ignorat — e textură
- Fundal: dreptunghi rotunjit, rază 28px, culoarea de panou a statusului,
  opacitate 0.93
- Contur interior 2px, alb la 18% opacitate
- Padding intern: 44px

**Conținut, de sus în jos:**

| Element | Poziție | Stil |
|---|---|---|
| Denumire produs | sus-stânga | 46px, 600, alb |
| Unitate de măsură | lângă denumire | 30px, 400, alb 65% |
| Preț | mijloc-stânga | **86px**, 700, alb, tabular |
| `lei` | lângă preț | 34px, 500, alb 70% |
| Marjă | dreapta, aliniat la preț | 64px, 700, alb, tabular |
| Eticheta `MARJĂ` | deasupra marjei | 22px, 600, alb 60%, `letter-spacing: .12em` |
| Stoc | jos-stânga | 28px, 400, alb 75% (`142 buc în stoc`) |
| Rotație | jos-dreapta | 28px, 400, alb 75% (`11 zile rotație`) |

Pentru status critic, adaugă în colțul dreapta-sus un triunghi de avertizare
alb, 36px. Culoarea singură nu ajunge — cineva din sală poate fi daltonist.

### Plasarea în scenă

```
<a-marker type="barcode" value="0">
  <a-plane  <!-- panoul -->
     position="0 1.25 0"
     width="2.0" height="1.125"
     material="shader: flat; transparent: true; src: #canvas-0"
     look-at="[camera]">
  </a-plane>
  <a-plane  <!-- umbra/conectorul spre card -->
     position="0 0.02 0" rotation="-90 0 0"
     width="1.1" height="1.1"
     material="shader: flat; transparent: true; opacity: .22; color: <status>">
  </a-plane>
</a-marker>
```

- `shader: flat` — panoul nu trebuie afectat de lumini, altfel culorile se schimbă
- `look-at` pe cameră: panoul rămâne lizibil din orice unghi
- Planul orizontal de la bază leagă vizual panoul de card; fără el, panoul pare
  că plutește aleatoriu

### Animația de apariție

La `markerFound`: scale de la `0.85` la `1` plus poziție de la `y=1.1` la
`y=1.25`, 260ms, `easeOutBack` ușor. La `markerLost`: fade-out 160ms.

**Nu reconstrui canvasul la fiecare detecție.** Îl desenezi o dată, la
inițializare, pentru fiecare produs din catalog, și refolosești textura.

### Stabilizare

```
smooth="true" smoothCount="10" smoothTolerance="0.01" smoothThreshold="5"
```

Fără asta panoul vibrează vizibil și arată stricat.

---

## 7. Cardurile

### Design

Format **A6** (105 × 148 mm), portret, fond alb.

```
┌─────────────────────────┐
│                         │
│      ████  ██  ████     │
│      ██  ████    ██     │   marker barcode, 80 × 80 mm
│      ████    ██  ██     │   centrat, minim 18 mm alb
│      ██  ██  ██████     │   de jur împrejur
│                         │
│   Salam Victoria        │   18pt, 600, negru
│   350 g · cod 0         │   11pt, 400, gri 45%
│                         │
│   ⌐ VIZOR ¬             │   8pt, gri 60%, jos de tot
└─────────────────────────┘
```

Generezi cardurile cu `assets/carduri.html` — o pagină de print cu
`@page { size: A4; margin: 10mm }` și un grid 2×2, deci patru carduri pe foaie.
Printezi din Safari sau Chrome direct în PDF.

### Reguli de print — ordinea importanței

1. **Minim 18 mm alb în jurul chenarului negru.** Cea mai frecventă cauză de
   „nu detectează". Nu tăia lipit de marker.
2. **Hârtie mată.** Lucioasă sau foto reflectă și omoară detecția.
3. **Negru plin** — dezactivează draft / economie de toner.
4. **Carton 160–200 g** dacă e disponibil. Pe hârtie de 80 g cardul se curbează
   în mână, iar markerul curbat se detectează prost. Alternativă: lipește foaia
   pe un carton.
5. **Laser peste inkjet**, dacă ai de ales.
6. Printează **două seturi**. Se îndoaie, se pătează, se pierd.

---

## 8. Ordinea de implementare

Fiecare pas are un criteriu de oprire verificabil. Nu treci mai departe fără el.

| # | Pas | Gata când |
|---|---|---|
| 1 | Repo + GitHub Pages, pagină goală | Se deschide pe HTTPS pe iPhone |
| 2 | Design system în `vizor.css`, ecranul Start complet | Arată bine pe telefon, safe area respectată |
| 3 | Scenă AR.js, `mono_and_matrix`, `3x3`, **un cub** pe marker 0 | Cubul apare pe card |
| 4 | **Trei markere simultan**, cuburi de culori diferite | Trei cuburi deodată, de la 60 cm |
| 5 | `panel.js` — canvas → textură, înlocuiește cuburile | Citești panoul de la 1,5 m |
| 6 | `catalog.js` + `model.js`, panouri colorate după marjă | Cardul 1 e roșu, restul nu |
| 7 | Indicator de stare + bară de sinteză | Două carduri → apare marja medie |
| 8 | Bottom sheet Produse | Se deschide, se închide prin swipe |
| 9 | Stări de eroare, hint, wake lock, rotire | Nicio cale nu duce la ecran negru |
| 10 | `carduri.html` + print | Ai cardurile fizice în mână |

**Punctul 4 e poarta.** Dacă trei markere simultan nu funcționează, cauza e
aproape sigur `<a-marker-camera>` folosit în loc de `<a-marker>` + `<a-entity
camera>` fix. Dacă tot nu merge, treci pe un singur card și alegi produsul din
bottom sheet — pierzi simultaneitatea, păstrezi aplicația. **Decizia se ia la
pasul 4**, nu la final.

---

## 9. Comportamente obligatorii

- **Wake lock** pe durata scanării, cu reluare la `visibilitychange`
- **Resync la rotire**: `resize` dispatch la `orientationchange`, plus unul
  întârziat cu 350ms — iOS raportează dimensiuni greșite imediat după rotire
- **Safe area**: `viewport-fit=cover` + `env(safe-area-inset-*)` pe toate
  elementele fixate sus sau jos
- **Verificare HTTPS** la pornire, cu mesaj explicit dacă lipsește
- **Fără zoom accidental**: `user-scalable=no`, `touch-action: manipulation`
- **Fără bounce**: `overscroll-behavior: none`
- Ascunde UI-ul implicit A-Frame: `.a-enter-vr`, `.a-enter-ar`,
  `.a-orientation-modal` → `display: none`

---

## 10. Definiția de „gata"

- [ ] Link HTTPS, se deschide în Safari fără explicații
- [ ] Trei carduri simultan → trei panouri, fiecare colorat corect
- [ ] Panoul e lizibil de la 1,5 metri
- [ ] Cardul 1 e vizibil roșu, cu triunghi de avertizare
- [ ] Bara de sinteză calculează marja ponderată
- [ ] Bottom sheet Produse funcționează fără cameră
- [ ] Panourile nu vibrează cu cardul ținut în mână
- [ ] 5 minute continuu: nu se încinge, ecranul nu se stinge
- [ ] Refuz de permisiune → instrucțiuni clare, nu ecran negru
- [ ] Carduri printate, două seturi
- [ ] Video de rezervă, 40 secunde

---

## 11. În afara scopului

Nu construi, oricât de tentant:

- încărcare de CSV / XLSX — catalogul hardcodat e suficient și mai sigur
- editarea pragurilor din interfață
- mod offline, PWA, iconiță pe home screen
- paritate Android
- tracking de imagine (NFT) în loc de markere
- backend, autentificare, sincronizare

Ideile noi se notează într-o listă separată și se evaluează **după** prezentare.
