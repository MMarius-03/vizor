# RIFT Core — etapa 3

Experiența AR ancorează un artefact 3D de imaginea statică de pe laptop. Folderul este separat de versiunea [`../rift/`](../rift/).

## Încearcă experiența

1. Deschide [pagina de laptop](https://mmarius-03.github.io/vizor/rift-next/). Așteaptă codul sesiunii, copiază linkul generat pentru iPhone și apasă **Mărește ținta**. Ține imaginea întreagă pe ecran, cu luminozitate suficientă și fără reflexii puternice.
2. Deschide linkul copiat pe iPhone în Safari și permite camera din spate. Codul din link conectează telefonul la laptop; o adresă fără cod pornește modul solo.
3. Încadrează imaginea RIFT. Mișcă telefonul lateral ca să vezi adâncimea artefactului.
4. Atinge nucleul pe ecranul telefonului. Carcasa se deschide și rămâne deschisă.
5. Glisează orizontal peste nucleu ca să rotești mecanismul și să aprinzi cele trei puncte. Atinge fiecare punct pe obiect sau folosește cele trei butoane care apar jos după armare. După 3/3, core-ul rămâne stabil.
6. Laptopul arată starea mecanismului și progresul nodurilor în afara imaginii scanate. Reîncărcarea aceleiași file de laptop păstrează codul sesiunii, iar reîncărcarea iPhone-ului restabilește starea din backend.

[Previzualizarea 3D pe laptop](https://mmarius-03.github.io/vizor/rift-next/model-preview.html) permite rotirea perspectivei prin tragere și deschiderea prin clic. Este un instrument de vizualizare, fără camera AR.

## Tracking și limite

Modul implicit combină recunoașterea imaginii cu world tracking. Adâncimea și scara sunt netezite între cadre, iar dimensiunea locală a modelului rămâne fixă după prima recunoaștere. Când recunoașterea se întrerupe scurt, obiectul rămâne la ultima ancoră și se estompează; după o pierdere mai lungă, se ascunde până când imaginea revine. `&tracking=image` păstrează modul de comparație doar cu recunoașterea imaginii. `&debug=1` afișează evenimentele, pierderile, recuperările și FPS.

Artefactul și atingerea lui trebuie verificate pe un iPhone fizic. Previzualizarea de desktop și testul cu cameră simulată nu măsoară stabilitatea sau dimensiunea percepută în Safari. Scena nu detectează mâna în imaginea camerei și nu ocluzionează obiecte reale. Camera online este temporară și expiră după două ore fără activitate.

## Implementare

- `target-source.png` este imaginea statică afișată pe laptop; `tools/make-target.py` o regenerează cu Pillow.
- `target-data/rift-screen.json` și imaginile derivate au fost generate cu [8th Wall Image Target CLI](https://github.com/8thwall/8thwall/blob/main/apps/image-target-cli/README.md).
- `artifact.js` construiește obiectul din geometrii Three.js, rotește mecanismul la glisare și actualizează vizual cele trei puncte. Zonele tactile sunt mai largi decât detaliile vizibile.
- `app.js` folosește [8th Wall Engine Binary](https://8thwall.org/docs/open-source), [configurarea țintelor](https://8thwall.org/docs/api/engine/xrcontroller/configure) și [evenimentele de tracking](https://8thwall.org/docs/api/engine/xrcontroller/pipelinemodule). `sync.js` transmite starea prin backendul online RIFT. Vezi [NOTICE.md](./NOTICE.md) pentru credite.
