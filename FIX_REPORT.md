# Fix Report

Projekt Jaňo še chce bavkac bol upravený tak, aby importy, save states, Android shell a CI používali spoločné runtime kontrakty.

## Stav

- Importy používajú spoločný import wizard pre web aj Android.
- DOS a PS1 save states sa ukladajú atomicky.
- Android shell sa builduje cez Capacitor a Gradle wrapper.
- Emulačné runtime assety sa pripravujú cez `npm run setup:cores`.
- Hry, BIOS, ROM, ISO ani iný chránený obsah nie sú súčasťou repozitára.

Podrobnosti finálnej opravy sú v `FINAL_FIX_REPORT.md` a `FINAL_REPAIR_REPORT.md`.
