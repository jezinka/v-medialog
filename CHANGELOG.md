# Changelog

Zmiany wdrożone w MediaLog, od najnowszych. Nowe zmiany trafiają najpierw do sekcji „Niewdrożone”, a przy wdrożeniu dostają datę.

## Niewdrożone

- Usunięto jednorazowy endpoint `/api/seasons/numbering` (uzupełnianie numerów zostało wykonane).

## 2026-10-25

### Nowe
- Sezony seriali wyświetlają się jako siatka okładek, tak jak tomy mangi; akcje sezonu są w panelu po kliknięciu kafelka.
- Odcinki specjalne z TMDB (sezon 0) pojawiają się w oknie „Daty emisji TMDB” i można je dodać jako sezon.
- Numery sezonów są zapisywane w bazie: istniejące sezony seriali zostały ponumerowane (594), a nowe dostają kolejny wolny numer. Filmy, książki i komiksy (kolejne seanse i czytania) zostają bez numeru.

### Poprawki
- Sprawdzanie VOD pomija oferty bez polskich napisów ani dźwięku (gdy JustWatch podaje języki).
- Numeracja sezonów nie przesuwa się, gdy specjale obejrzano między sezonami; specjale mają etykietę „Speciale” / „Sp.”.
- Zapis samej okładki sezonu nie kasuje już jego numeru i tytułu.
- Kafelki sezonów i tomów są czytelne dla czytników ekranu (opis, stan „chcę obejrzeć”, „nieobejrzany”).
