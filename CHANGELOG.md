# Changelog

Zmiany w MediaLog, od najnowszych. Nowe zmiany trafiają najpierw do sekcji „Niewdrożone”, a przy wdrożeniu dostają datę wdrożenia.

Sekcje sprzed 2026-10-25 odtworzono z historii gita: daty to dni commitów, nie wdrożeń, a pominięto zmiany niewidoczne dla użytkownika (refaktoryzacje, porządki w kodzie).

## Niewdrożone

- Filmy nie mają już przycisku „Daty emisji TMDB” (pokazywał przypadkowy serial o tym samym identyfikatorze TMDB) ani siatki z jednym sezonem „1”; „chcę obejrzeć” nie nadaje filmom i książkom numeru sezonu.
- Dodanie prawdziwej sesji usuwa ukrytą sesję „kiedyś w roku RRRR” (placeholder) z tego samego roku, więc licznik sesji nie pokazuje już jednej sesji za dużo.

## 2026-10-25

### Nowe
- Sezony seriali wyświetlają się jako siatka okładek, tak jak tomy mangi; akcje sezonu są w panelu po kliknięciu kafelka.
- Odcinki specjalne z TMDB (sezon 0) pojawiają się w oknie „Daty emisji TMDB” i można je dodać jako sezon.
- Numery sezonów są zapisywane w bazie: istniejące sezony seriali zostały ponumerowane (594), a nowe dostają kolejny wolny numer. Filmy, książki i komiksy (kolejne seanse i czytania) zostają bez numeru.

### Usunięte
- Jednorazowy endpoint `/api/seasons/numbering` (uzupełnianie numerów zostało wykonane).

### Poprawki
- Sprawdzanie VOD pomija oferty bez polskich napisów ani dźwięku (gdy JustWatch podaje języki).
- Numeracja sezonów nie przesuwa się, gdy specjale obejrzano między sezonami; specjale mają etykietę „Speciale” / „Sp.”.
- Zapis samej okładki sezonu nie kasuje już jego numeru i tytułu.
- Kafelki sezonów i tomów są czytelne dla czytników ekranu (opis, stan „chcę obejrzeć”, „nieobejrzany”).

## 2026-10-24

### Nowe
- Lista życzeń zastąpiona flagą „chcę obejrzeć” / „chcę przeczytać” przy sezonach, z przyciskami „Zaczynam” i „Usuń z listy”; istniejące wpisy przeniesiono automatycznie.
- Wieloczęściowe książki i mangi: części jako siatka okładek, z edycją, usuwaniem i scalaniem każdej części.
- Eksport MediaLog do JSON z publikacją na GitHub Pages (skrypt `export:medialog`).
- Rok wydania przy pozycjach, także w eksporcie CSV.

### Usunięte
- Typ YouTube razem z jego danymi i polem adresu źródła.

### Poprawki
- Powiadomienia VOD wyświetlają się w poprawnym formacie.

## 2026-10-14

### Nowe
- Eksport kalendarza do HTML.

## 2026-10-10 – 2026-10-11

### Nowe
- Pobieranie okładek i drukowanie kalendarza.
- Sesje z dzieckiem widoczne w statystykach.
- Nowy układ zakładek pozycji i listy życzeń.

### Poprawki
- Kolidujące wpisy w kalendarzu „do obejrzenia” przesuwają się na najbliższy wolny dzień.

## 2026-09-06

### Nowe
- Filtr ukrywający porzucone pozycje.
- Numery sezonów na liście „do obejrzenia”.

## 2026-08-23 – 2026-08-29

### Nowe
- Sesje z dzieckiem: oznaczenie przy sesji i znacznik przy pozycjach oraz sezonach.
- Filtr sesji w kinie.
- Flaga „chcę obejrzeć” przy sezonach; znika po dodaniu prawdziwej sesji.
- Sortowanie po dacie ostatniej sesji.
- Rozszerzona obsługa YouTube (adresy i identyfikatory).

## 2026-05-23 – 2026-06-15

### Nowe
- Stronicowanie i filtrowanie pozycji, pole z adresem źródła.
- Scalanie osób („⇄ Scal z osobą”).
- Daty odcinków podcastów z Apple Podcasts.
- Filtr kategorii w galerii kalendarza.
- Sekcja spektakli w statystykach, z autorami.
- Czyszczenie pozycji z YouTube razem z ich danymi.

### Poprawki
- Lepsze grupowanie w statystykach i wyszukiwanie pozycji.

## 2026-05-03

### Nowe
- Pierwsza wersja MediaLog.
- Pole opisu pozycji (zamiast notatek), informacje o uniwersum przy pozycjach.
