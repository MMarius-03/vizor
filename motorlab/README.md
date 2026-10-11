# MotorLab — prototip V8 separat

Acest folder conține un prototip independent de HoloLab. Aplicația din rădăcina proiectului și cele trei scene ale sale nu sunt modificate.

## Pornire

Din rădăcina repository-ului:

```powershell
python -m http.server 4173
```

Deschide `http://localhost:4173/motorlab/`. Nu deschide direct fișierul HTML: modulul JavaScript și GLB-ul trebuie servite prin HTTP. Three.js și, la activarea camerei, MediaPipe sunt încărcate din CDN, deci este necesară conexiune la internet. Camera funcționează pe `localhost` sau HTTPS.

## Ce include

- Viewer pentru modelul GLB original, cu rotire, zoom, redare și scrub la animația de aproximativ 10,4 secunde.
- Mod atelier separat. Trei piese pilot au stare proprie de extragere (0–100%), selecție pe model sau din listă, tragere cu pointer/touch, snap, comandă individuală și secvențe de desfacere/reasamblare.
- Control opțional cu mâna prin camera frontală: indicare pentru selecție și pinch pentru extragere. Dacă mâna dispare din cadru, piesa rămâne în ultima poziție.
- Interfață adaptată pentru telefon; touch și mouse funcționează fără cameră.

## Limitele acestui pas

Maparea celor trei piese folosește numele nodurilor din GLB-ul curent și trebuie confirmată vizual înainte de extindere. Un mesh nu înseamnă întotdeauna o piesă fizică completă. Traseele de extragere sunt trasee pilot, nu un plan mecanic validat. Nu există încă inventarul tuturor pieselor, dependențele de demontare sau ancorare AR persistentă. Animația originală este disponibilă ca vizualizare separată; modul atelier oprește clipul la poziția asamblată.

Fișierul `assets/engine.glb` este o copie nemodificată a modelului din `../assets/motor-v8/`; metadatele din fișier au fost păstrate. Creditul în interfață este amânat pentru o etapă ulterioară.
