# Etapa 5 — inspecție AR în straturi

**Stare:** implementată, în așteptarea testului pe iPhone.

După activarea celor trei noduri, nucleul poate fi desfăcut în adâncime. Baza rămâne ancorată de imaginea statică de pe laptop; carcasa, nucleul, coroana și cele trei noduri se separă la distanțe diferite. Mișcarea telefonului spre stânga și dreapta face vizibilă această separare prin perspectivă reală.

## Gesturi și interfață

- Glisează **în sus** peste nucleu pentru a desface straturile; glisează **în jos** pentru a le strânge. Gestul vertical este disponibil numai după 3/3, astfel încât armarea prin glisare orizontală rămâne clară.
- Butonul **Desfă straturile / Strânge straturile** apare în zona degetului mare după completare. El oferă aceeași acțiune dacă gestul pe obiect este dificil dintr-un anumit unghi.
- Atingerea nucleului trimite în continuare un impuls, iar glisarea orizontală continuă să rotească mecanismul. **Reia ciclul** închide secțiunea și resetează nodurile.
- Laptopul arată **Straturi deschise** lângă imagine. Alegerea se păstrează în sesiunea online și revine după reîncărcarea iPhone-ului.

## De verificat pe iPhone

Vizibilitatea straturilor din față și din lateral, ușurința gestului vertical cu o mână, precizia atingerii nucleului când este ridicat, fluiditatea animației și comportamentul la pierderea temporară a imaginii țintă. Camera simulată verifică logica, dar nu poate confirma trackingul fizic sau profunzimea percepută.
