# RIFT Core — etapa 2

Experiența AR ancorează un artefact 3D de imaginea statică de pe laptop. Folderul este separat de versiunea [`../rift/`](../rift/).

## Încearcă experiența

1. Deschide [pagina de laptop](https://mmarius-03.github.io/vizor/rift-next/), copiază linkul de iPhone și apasă **Mărește ținta**. Ține imaginea întreagă pe ecran, cu luminozitate suficientă și fără reflexii puternice.
2. Deschide [pagina de iPhone](https://mmarius-03.github.io/vizor/rift-next/?mode=phone&v=5) în Safari și permite camera din spate.
3. Încadrează imaginea RIFT. Mișcă telefonul lateral ca să vezi adâncimea artefactului.
4. Atinge nucleul pe ecranul telefonului. Carcasa se deschide și rămâne deschisă.
5. Glisează orizontal peste nucleu ca să rotești mecanismul și să aprinzi cele trei puncte. Atinge fiecare punct cu degetul. După 3/3, core-ul rămâne stabil.

[Previzualizarea 3D pe laptop](https://mmarius-03.github.io/vizor/rift-next/model-preview.html) permite rotirea perspectivei prin tragere și deschiderea prin clic. Este un instrument de vizualizare, fără camera AR.

## Tracking și limite

Modul implicit combină recunoașterea imaginii cu world tracking. Adâncimea și scara sunt netezite între cadre, iar dimensiunea locală a modelului rămâne fixă după prima recunoaștere. Când recunoașterea se întrerupe scurt, obiectul rămâne la ultima ancoră și se estompează; după o pierdere mai lungă, se ascunde până când imaginea revine. `&tracking=image` păstrează modul de comparație doar cu recunoașterea imaginii. `&debug=1` afișează evenimentele, pierderile, recuperările și FPS.

Artefactul și atingerea lui trebuie verificate pe un iPhone fizic. Previzualizarea de desktop și testul cu cameră simulată nu măsoară stabilitatea sau dimensiunea percepută în Safari. Scena nu detectează mâna în imaginea camerei și nu ocluzionează obiecte reale.

## Implementare

- `target-source.png` este imaginea statică afișată pe laptop; `tools/make-target.py` o regenerează cu Pillow.
- `target-data/rift-screen.json` și imaginile derivate au fost generate cu [8th Wall Image Target CLI](https://github.com/8thwall/8thwall/blob/main/apps/image-target-cli/README.md).
- `artifact.js` construiește obiectul din geometrii Three.js, rotește mecanismul la glisare și actualizează vizual cele trei puncte. Zonele tactile sunt mai largi decât detaliile vizibile.
- `app.js` folosește [8th Wall Engine Binary](https://8thwall.org/docs/open-source), [configurarea țintelor](https://8thwall.org/docs/api/engine/xrcontroller/configure) și [evenimentele de tracking](https://8thwall.org/docs/api/engine/xrcontroller/pipelinemodule). Vezi [NOTICE.md](./NOTICE.md) pentru credite.
