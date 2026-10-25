<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

---

## Zasady pracy dla agentów

- **Gałąź:** każdą zmianę w kodzie rób na nowej gałęzi od `main` (np. `feat/...`, `fix/...`). Nigdy nie commituj bezpośrednio na `main`.
- **Commity:** na swojej gałęzi możesz commitować i pushować bez pytania. Małe, spójne commity z opisem po co jest zmiana.
- **Code review:** po każdym commicie uruchom code review tego commita w osobnej sesji (tylko do odczytu, w tym samym katalogu). Uwagi z review popraw kolejnym commitem albo opisz, dlaczego je pomijasz.
- **Testy:** do każdej nietrywialnej zmiany logiki dopisz test. Używaj wbudowanego `node:test`, bez dodawania frameworka testowego bez zgody. `npm test` wymaga Node ≥ 23.6 (natywne usuwanie typów) i nie rozwiązuje aliasów `@/`, więc testowane moduły nie mogą ich importować. Przed commitem uruchom testy, `npx tsc --noEmit` i `npm run lint`.
- **Changelog:** każdą zmianę widoczną dla użytkownika dopisz do `CHANGELOG.md` w sekcji „Niewdrożone”, w tym samym commicie. Gdy opiekun napisze, że wdrożył, agent zmienia nagłówek „Niewdrożone” na datę wdrożenia i dodaje nad nim nową, pustą sekcję „Niewdrożone” (osobny commit na gałęzi `docs/...`).
- **Wymaga wyraźnej zgody opiekuna projektu:** merge do `main`, push do `main` i cudzych gałęzi, force-push, usuwanie gałęzi i tagów, dodawanie zależności oraz zmiany poza kodem projektu (bazy danych `*.db`, `dane/`, `data/`, skrypty deploy).
