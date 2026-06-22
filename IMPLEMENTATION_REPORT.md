# Implementation Report

Jaňo še chce bavkac je lokálny webový a Android emulátor pre vlastné legálne záložné kópie DOS a PlayStation 1 hier.

## Implementované oblasti

- Import pipeline pre lokálne súbory, priečinky, USB/SAF zdroje a archívy.
- DOS launcher detekcia s explicitným výberom pri viacerých kandidátoch.
- PS1 CUE/BIN validácia.
- Save state metadata s veľkosťou a SHA-256 hashom.
- Web a Android diagnostika pre emulačné jadrá a natívne pluginy.
- CI workflow s Node 20, Gradle wrapperom 8.7 a debug APK artifactom.

## Limity

- Aplikácia neposkytuje BIOS, hry, ROM, ISO ani žiadny chránený obsah.
- PS1 hry môžu vyžadovať vlastný PlayStation BIOS dodaný používateľom.
- Runtime assety sa pripravujú cez `npm run setup:cores` z oficiálnych npm/CDN zdrojov.
