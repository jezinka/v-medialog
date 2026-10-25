"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import CoverImg from "./CoverImg";
import { toast } from "./Toast";
import { MEDIA_TYPE_EMOJI } from "@/lib/utils";
import type { SuggestionGroup } from "@/app/api/universes/suggestions/route";

interface UniverseItem { id: number; name: string; media_count: number }
interface MemberItem { id: number; title: string; media_type: string; cover_url: string | null; release_year: number | null }
interface SearchItem { id: number; title: string; media_type: string; universe_id: number | null }

async function setUniverse(mediaId: number, universeId: number | null) {
  const res = await fetch(`/api/media/${mediaId}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ universe_id: universeId }),
  });
  if (!res.ok) throw new Error();
}

async function getJson<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) throw new Error();
  return (await res.json()) as T;
}

/** Creates a universe, linking `mediaIds` to it in the same transaction. */
async function createUniverse(name: string, mediaIds: number[] = []): Promise<number> {
  const res = await fetch("/api/universes", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name, media_ids: mediaIds }),
  });
  if (!res.ok) throw new Error();
  return ((await res.json()) as { id: number }).id;
}

/** Admin list of universes: browse members, add / remove media, rename, delete, and group suggested series. */
export default function UniversesView() {
  const [universes, setUniverses] = useState<UniverseItem[]>([]);
  const [filter, setFilter] = useState("");
  const [newName, setNewName] = useState("");
  const [openId, setOpenId] = useState<number | null>(null);
  const [suggestions, setSuggestions] = useState<SuggestionGroup[] | null>(null);

  // Initial list; later reloads go through refresh()
  useEffect(() => {
    getJson<UniverseItem[]>("/api/universes").then(setUniverses, () => toast("Błąd ładowania uniwersów", "error"));
  }, []);

  const loadSuggestions = useCallback(async () => {
    try {
      setSuggestions(await getJson<SuggestionGroup[]>("/api/universes/suggestions"));
    } catch {
      toast("Błąd ładowania propozycji", "error");
    }
  }, []);

  /** Reloads the list, and the suggestions when they are shown (a change can take media out of them). */
  const refresh = useCallback(async () => {
    try {
      setUniverses(await getJson<UniverseItem[]>("/api/universes"));
    } catch {
      toast("Błąd ładowania uniwersów", "error");
    }
    if (suggestions !== null) await loadSuggestions();
  }, [suggestions, loadSuggestions]);

  const shown = useMemo(() => {
    const q = filter.trim().toLowerCase();
    return q ? universes.filter((u) => u.name.toLowerCase().includes(q)) : universes;
  }, [universes, filter]);

  const handleCreate = async () => {
    if (!newName.trim()) return;
    try {
      const id = await createUniverse(newName.trim());
      setNewName("");
      setOpenId(id);
      await refresh();
    } catch {
      toast("Błąd tworzenia uniwersum", "error");
    }
  };

  const acceptSuggestion = async (group: SuggestionGroup) => {
    // base_name is the lowercased series name; take the same span of the real title to keep its casing
    const name = group.items[0].title.trim().slice(0, group.base_name.length) || group.base_name;
    try {
      await createUniverse(name, group.items.map((i) => i.id));
      toast(`Utworzono „${name}” (${group.items.length}) ✓`, "success");
    } catch {
      toast("Błąd tworzenia uniwersum", "error");
    }
    await refresh();
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        <input
          type="search"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          placeholder="Szukaj uniwersum…"
          aria-label="Szukaj uniwersum"
          className="flex-1 min-w-[12rem] border border-gray-200 rounded-lg px-3 py-1.5 text-sm"
        />
        <form onSubmit={(e) => { e.preventDefault(); void handleCreate(); }} className="flex gap-2">
          <input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="Nowe uniwersum"
            aria-label="Nazwa nowego uniwersum"
            className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm"
          />
          <button type="submit" disabled={!newName.trim()} className="text-sm px-3 py-1.5 rounded-lg bg-purple-600 text-white hover:bg-purple-700 disabled:opacity-40">
            + Utwórz
          </button>
        </form>
      </div>

      <p className="text-xs text-gray-400" aria-live="polite">
        Uniwersa: {shown.length === universes.length ? universes.length : `${shown.length} z ${universes.length}`}
      </p>

      <ul className="divide-y divide-gray-100 border border-gray-200 rounded-xl">
        {shown.map((u) => (
          <li key={u.id}>
            <button
              onClick={() => setOpenId(openId === u.id ? null : u.id)}
              aria-expanded={openId === u.id}
              className="w-full flex items-center justify-between px-4 py-2.5 text-left hover:bg-gray-50"
            >
              <span className="text-sm font-medium text-gray-800">🌌 {u.name}</span>
              <span className="text-xs text-gray-400">{u.media_count} poz.</span>
            </button>
            {openId === u.id && <UniverseDetail universe={u} onChanged={refresh} onDeleted={() => { setOpenId(null); void refresh(); }} />}
          </li>
        ))}
        {shown.length === 0 && <li className="px-4 py-6 text-center text-sm text-gray-400">Brak uniwersów</li>}
      </ul>

      <section className="space-y-2">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-gray-700">Propozycje</h3>
          <button onClick={() => void loadSuggestions()} className="text-xs text-purple-600 hover:text-purple-800">
            {suggestions ? "Odśwież" : "Pokaż media o podobnych tytułach bez uniwersum"}
          </button>
        </div>
        {suggestions?.length === 0 && <p className="text-xs text-gray-400">Brak propozycji.</p>}
        {suggestions?.map((g) => (
          <div key={g.base_name + g.items[0].media_type} className="flex items-start justify-between gap-3 border border-gray-200 rounded-lg px-3 py-2">
            <div className="min-w-0">
              <p className="text-sm text-gray-800">{g.items.map((i) => `${MEDIA_TYPE_EMOJI[i.media_type] ?? ""} ${i.title}`).join(" · ")}</p>
            </div>
            <button onClick={() => void acceptSuggestion(g)} aria-label={`Utwórz uniwersum z: ${g.items.map((i) => i.title).join(", ")}`} className="shrink-0 text-xs px-2 py-1 rounded border border-purple-200 text-purple-700 hover:bg-purple-50">
              Utwórz uniwersum
            </button>
          </div>
        ))}
      </section>
    </div>
  );
}

function UniverseDetail({ universe, onChanged, onDeleted }: {
  universe: UniverseItem;
  onChanged: () => Promise<void>;
  onDeleted: () => void;
}) {
  const [members, setMembers] = useState<MemberItem[]>([]);
  const [name, setName] = useState(universe.name);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchItem[]>([]);

  const membersUrl = `/api/universes/${universe.id}`;
  useEffect(() => {
    getJson<{ media: MemberItem[] }>(membersUrl).then((d) => setMembers(d.media), () => toast("Błąd ładowania pozycji", "error"));
  }, [membersUrl]);

  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) return;
    let stale = false; // a slower answer for an older query must not overwrite a newer one
    const timer = setTimeout(() => {
      getJson<{ items: SearchItem[] }>(`/api/media?search=${encodeURIComponent(q)}&limit=8`)
        .then((d) => { if (!stale) setResults(d.items); }, () => {});
    }, 250);
    return () => { stale = true; clearTimeout(timer); };
  }, [query]);

  const change = async (mediaId: number, universeId: number | null) => {
    try {
      await setUniverse(mediaId, universeId);
      setMembers((await getJson<{ media: MemberItem[] }>(membersUrl)).media);
      setQuery("");
      setResults([]);
      await onChanged();
    } catch {
      toast("Błąd zapisu", "error");
    }
  };

  const rename = async () => {
    const trimmed = name.trim();
    if (!trimmed) { setName(universe.name); return; }
    if (trimmed === universe.name) return;
    try {
      const res = await fetch(`/api/universes/${universe.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: trimmed }),
      });
      if (!res.ok) throw new Error();
      await onChanged();
    } catch {
      toast("Błąd zmiany nazwy", "error");
      setName(universe.name);
    }
  };

  const remove = async () => {
    if (!confirm(`Usunąć uniwersum „${universe.name}”? Pozycje zostaną, tylko bez uniwersum.`)) return;
    try {
      const res = await fetch(`/api/universes/${universe.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error();
      onDeleted();
    } catch {
      toast("Błąd usuwania", "error");
    }
  };

  const memberIds = new Set(members.map((m) => m.id));
  return (
    <div className="px-4 pb-4 pt-1 space-y-3 bg-gray-50">
      <div className="flex flex-wrap items-center gap-2">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          onBlur={() => void rename()}
          onKeyDown={(e) => { if (e.key === "Enter") e.currentTarget.blur(); }}
          aria-label="Nazwa uniwersum"
          className="flex-1 min-w-[10rem] border border-gray-200 rounded px-2 py-1 text-sm bg-white"
        />
        <button onClick={() => void remove()} className="text-xs text-red-500 hover:text-red-700">Usuń uniwersum</button>
      </div>

      <ul className="space-y-1">
        {members.map((m) => (
          <li key={m.id} className="flex items-center gap-2">
            <div className="relative w-7 h-10 shrink-0 rounded overflow-hidden bg-gray-200">
              {m.cover_url && <CoverImg src={m.cover_url} alt="" fill className="object-cover" sizes="28px" />}
            </div>
            <Link href={`/media/${m.id}`} className="flex-1 min-w-0 truncate text-sm text-gray-800 hover:underline">
              {MEDIA_TYPE_EMOJI[m.media_type] ?? ""} {m.title}
              {m.release_year && <span className="text-gray-400"> ({m.release_year})</span>}
            </Link>
            <button onClick={() => void change(m.id, null)} aria-label={`Usuń ${m.title} z uniwersum`} className="text-xs text-gray-400 hover:text-red-600 px-1">✕</button>
          </li>
        ))}
        {members.length === 0 && <li className="text-xs text-gray-400">Pusto — dodaj pozycje poniżej.</li>}
      </ul>

      <div className="space-y-1">
        <input
          type="search"
          value={query}
          onChange={(e) => { setQuery(e.target.value); if (e.target.value.trim().length < 2) setResults([]); }}
          placeholder="Dodaj pozycję: wpisz tytuł…"
          aria-label="Szukaj pozycji do dodania"
          className="w-full border border-gray-200 rounded px-2 py-1 text-sm bg-white"
        />
        {results.filter((r) => !memberIds.has(r.id)).map((r) => (
          <button
            key={r.id}
            onClick={() => void change(r.id, universe.id)}
            className="w-full flex items-center justify-between text-left text-sm px-2 py-1 rounded hover:bg-white"
          >
            <span className="truncate">{MEDIA_TYPE_EMOJI[r.media_type] ?? ""} {r.title}</span>
            <span className="shrink-0 text-xs text-purple-600">{r.universe_id ? "przenieś tutaj" : "+ dodaj"}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
