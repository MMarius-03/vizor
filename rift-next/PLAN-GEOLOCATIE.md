# Geolocație CAMPUS — propunere, neactivată

Nu solicităm permisiune și nu colectăm locația în versiunea curentă.

Etapă posibilă după verificarea pe teren a intrărilor:
- Buton explicit „Arată unde sunt”, cu permisiunea browserului, pe HTTPS.
- Calibrarea coordonatelor geografice cu puncte măsurate pe planul schematic. Modelul actual nu este georeferențiat.
- Pin de poziție și cerc de precizie, actualizate numai cât timp utilizatorul solicită această funcție. Oprire disponibilă.
- În afara campusului: mesaj explicit, fără proiectarea forțată a pinului în machetă.
- Dacă precizia este slabă, rămâne disponibilă plecarea manuală. Nu afirmăm „ești în corpul A” doar pe baza apropierii GPS; în interior nu avem localizare pe camere sau etaje.
- Procesare locală în browser, fără trimiterea poziției către backend în această primă variantă.

Geolocația este separată de trackingul AR: poziția geografică nu înlocuiește recunoașterea posterului.

Referință: [Geolocation API — MDN](https://developer.mozilla.org/en-US/docs/Web/API/Geolocation_API). API-ul browserului necesită HTTPS și permisiunea utilizatorului; nu cere un backend propriu pentru obținerea poziției.

Modul de explorare fără cameră se află la `explore.html`: selecție, zoom, rotire, trasee și păstrarea traseului în aceeași sesiune. Acesta nu este un mod offline; încărcarea inițială necesită internet.
