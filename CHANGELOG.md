# Changelog

Zmiany w MediaLog, od najnowszych. Nowe zmiany trafiają najpierw do sekcji „Niewdrożone”, a przy wdrożeniu dostają datę wdrożenia.

Sekcje sprzed 2026-10-25 odtworzono z historii gita: daty to dni commitów, nie wdrożeń, a pominięto zmiany niewidoczne dla użytkownika (refaktoryzacje, porządki w kodzie).

## Niewdrożone

## 2026-10-29

- Dziennik otwiera się na osi czasu: rok jako wykres Gantta, w którym każda sesja to pasek od początku do końca, osobno czytanie, ekran i oglądanie z dzieckiem. Sesje jednego tytułu z przerwą do tygodnia łączą się w jeden pasek. Po najechaniu na pasek widać okładkę, daty i liczbę sesji, a kliknięcie otwiera tytuł. Kalendarz (przełącznik obok) służy już tylko do dodawania sesji: jasne dni z fioletową kropką przy czytaniu i pomarańczową przy oglądaniu, bez kolorowych pasków.
- Kliknięcie w kalendarzu dnia, w którym już jest sesja, pozwala nie tylko ją otworzyć, ale też dodać nową sesję w tym dniu (np. oglądanie do dnia z czytaniem).
- Przełącznik roku w nagłówku nie cofa się dalej niż do pierwszego roku z zapisaną sesją.


- Publikacja na stronę (`publish-medialog.sh`) eksportuje też zakończone lata od 2024 do `data/medialog-RRRR.json`.

## 2026-10-28

- Większe kafelki dni w kalendarzu dziennika: 4 miesiące w rzędzie zamiast 6.


- Dziennik ma jeden kalendarz zamiast dwóch: książki, komiksy, filmy i seriale razem. Dzień z kilkoma tytułami jest podzielony na poziome paski, po jednym na tytuł.


- Przy dodawaniu sesji z dziennika serialu (lub książki) z kilkoma sezonami (częściami) pojawia się wybór sezonu, a nie zawsze pierwszy. Można też zaznaczyć „w kinie” i „z dzieckiem”. Przy serialach można tam od razu dodać nowy sezon o wybranym numerze.

## 2026-10-27

- Aplikacja używa systemowej czcionki zamiast Ariala. Pola formularzy mają jednolite obramowanie i niebieską obwódkę po kliknięciu (także te, które dotąd nie miały żadnej), a niebieskie przyciski jeden wygląd. Wskaźniki ładowania i etykiety pól w oknach edycji też wyglądają wszędzie tak samo.

## 2026-10-26

- Przy dodawaniu sesji z kalendarza okienko pokazuje okładkę książki lub filmu (gdy nie ma osobnych części) zamiast pustego kafelka czy wiersza „1”.


- Przy serialach na liście „✨ Nowe seriale” widać ich gatunki (np. „Dramat, Kryminał”).


- Tytuł serialu na liście „✨ Nowe seriale” otwiera jego stronę na TMDB w nowej karcie.


- Przy serialach na liście „✨ Nowe seriale” widać średnią ocenę z TMDB i liczbę głosów (np. „★ 7,4 (12)”), o ile ktoś już oceniał.


- Na liście „✨ Nowe seriale” można zaznaczyć „Bez seriali z biblioteki”, żeby ukryć seriale, które już są w bibliotece. Wybór zapisuje się w adresie strony.


- Zakładkę „✨ Nowe seriale” można zawęzić do kraju (Polska, USA, Wielka Brytania) i platformy lub stacji dostępnej w Polsce (np. Netflix, HBO Max, Disney+, SkyShowtime, TVP). Seriale z Hulu i FX są pod Disney+, z HBO i Max pod HBO Max, a z Paramount+ i Peacock pod SkyShowtime. Miesiąc i filtry zapisują się w adresie strony, więc zostają po odświeżeniu i w skopiowanym linku.

- Serial na liście „✨ Nowe seriale” można ukryć przyciskiem „ukryj”: znika we wszystkich miesiącach, a „Pokaż ukryte (n)” pod listą pozwala go przywrócić.

- Na liście „✨ Nowe seriale” każdy serial ma krótki opis (do dwóch linijek, pełny po najechaniu): po polsku, a gdy TMDB nie ma polskiego, po angielsku.

- „✨ Nowe seriale” mają własną zakładkę w nawigacji (obok „Do obejrzenia”) z przełącznikiem miesięcy; link „✨ Nowe seriale →” w rozkładzie jazdy otwiera ją w tym samym miesiącu. Rozkład jazdy pokazuje już tylko premiery kolejnych sezonów śledzonych seriali.


- Rozkład jazdy pokazuje też „✨ Nowe seriale”: premiery w danym miesiącu seriali z Polski, USA i Wielkiej Brytanii od stacji i platform dostępnych w Polsce (bez reality show, talk show i programów informacyjnych). Przycisk „+ do obejrzenia” dodaje serial do biblioteki i listy z datą premiery; seriale, które już są w bibliotece, mają link „✓ w bibliotece”.
- Na liście „Do obejrzenia” serial ma jedną kartę z sezonami w środku (każdy z własnym ▶ i ×), zamiast osobnej karty dla każdego sezonu.

## 2026-10-25

- Serialowy rozkład jazdy: na stronie „Do obejrzenia” lista premier kolejnych sezonów śledzonych seriali i anime w danym miesiącu (z przełączaniem miesięcy i przyciskiem „Sprawdź nowe sezony”), a w dzwonku wpis „Premiery w tym miesiącu”. Serwer sam sprawdza nowe sezony w TMDB na początku miesiąca i raz w tygodniu.
- Biblioteka w panelu admina ma filtry „🎮 Gra”, „🎙️ Podcast” i „🎵 Płyta” — dotąd te typy były widoczne tylko pod „Wszystkie”.


- W panelu admina jest zakładka „🌌 Uniwersa”: lista uniwersów z liczbą pozycji, podgląd członków, dodawanie i usuwanie pozycji, zmiana nazwy, usuwanie uniwersum (pozycje zostają) oraz propozycje grupowania mediów o podobnych tytułach.
- Dziennik (dymki w kalendarzu i wybór sesji) nie dopisuje już numeru sezonu do książek, komiksów, filmów i bajek.
- Bajki są traktowane jak filmy pełnometrażowe: kolejne seanse nie dostają numerów sezonów, można zaznaczyć kino, sprawdzanie VOD szuka filmu, a nie serialu, w kalendarzu „do obejrzenia” są wśród filmów i nie trafiają do filtrów ani sprawdzania nowych sezonów seriali.


- Okna dialogowe (edycja sesji, medium i sezonu, dodawanie sesji, łączenie mediów) zamykają się klawiszem Esc i są oznaczone jako dialogi dla czytników ekranu.
- Kalendarze na stronach pozycji i osoby skracają sobotę jako „Sb”, tak jak kalendarz główny.
- Synchronizacja z TMDB pojedynczej pozycji (i ręczny wybór kandydata w synchronizacji zbiorczej) zapisuje identyfikatory TMDB aktorów, więc ten sam aktor z różnych pozycji jest łączony w jedną osobę także przy zmienionej pisowni nazwiska.


- Usunięto jednorazowy endpoint `/api/sessions/placeholders` (sprzątanie zostało wykonane).


- Filmy nie mają już przycisku „Daty emisji TMDB” (pokazywał przypadkowy serial o tym samym identyfikatorze TMDB) ani siatki z jednym sezonem „1”; „chcę obejrzeć” nie nadaje filmom i książkom numeru sezonu.
- Dodanie prawdziwej sesji usuwa ukrytą sesję „kiedyś w roku RRRR” (placeholder) z tego samego roku, więc licznik sesji nie pokazuje już jednej sesji za dużo; istniejące takie sesje zostały posprzątane (69).


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
