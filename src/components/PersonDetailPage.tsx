"use client";

import { useEffect, useMemo, useState } from "react";
import CoverImg from "./CoverImg";
import { MEDIA_TYPE_EMOJI, MEDIA_TYPE_LABELS } from "@/lib/utils";
import { toast } from "./Toast";

const POLISH_MONTHS = [
  "Styczeń","Luty","Marzec","Kwiecień","Maj","Czerwiec",
  "Lipiec","Sierpień","Wrzesień","Październik","Listopad","Grudzień",
];
const DAY_LABELS = ["Pn","Wt","Śr","Cz","Pt","So","Nd"];

function PersonYearCalendar({ year, daysMap }: { year: number; daysMap: Map<string, string> }) {
  const activeMonths = Array.from({ length: 12 }, (_, i) => i + 1).filter((month) => {
    const daysInMonth = new Date(year, month, 0).getDate();
    for (let d = 1; d <= daysInMonth; d++) {
      if (daysMap.has(`${year}-${String(month).padStart(2,"0")}-${String(d).padStart(2,"0")}`)) return true;
    }
    return false;
  });

  if (activeMonths.length === 0) return null;

  return (
    <div>
      <h3 className="text-xs font-semibold text-gray-500 mb-2">{year}</h3>
      <div className="flex flex-wrap gap-4">
        {activeMonths.map((month) => {
          const daysInMonth = new Date(year, month, 0).getDate();
          const offset = (new Date(year, month - 1, 1).getDay() + 6) % 7;
          const cells: Array<number | null> = [];
          for (let i = 0; i < offset; i++) cells.push(null);
          for (let d = 1; d <= daysInMonth; d++) cells.push(d);
          return (
            <div key={month} className="w-[160px] shrink-0">
              <p className="text-xs font-semibold text-gray-700 mb-1.5">
                {POLISH_MONTHS[month - 1]}
              </p>
              <div className="grid grid-cols-7 gap-px">
                {DAY_LABELS.map((d) => (
                  <div key={d} className="text-center text-[9px] text-gray-400 font-medium pb-0.5">{d}</div>
                ))}
                {cells.map((day, idx) => {
                  if (day === null) return <div key={`e-${idx}`} />;
                  const dateStr = `${year}-${String(month).padStart(2,"0")}-${String(day).padStart(2,"0")}`;
                  const color = daysMap.get(dateStr) ?? null;
                  return (
                    <div
                      key={dateStr}
                      title={color ? dateStr : undefined}
                      className={`w-full aspect-square flex items-center justify-center text-[10px] rounded-full
                        ${color ? `${color} text-white font-semibold` : "text-gray-400"}`}
                    >
                      {day}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

interface MediaEntry {
  media_id: number;
  title: string;
  media_type: string;
  cover_url: string | null;
  release_year: number | null;
  role: string;
  character_name: string | null;
  watch_dates: string | null;
}

interface PersonDetail {
  id: number;
  name: string;
  photo_url: string | null;
  tmdb_id: number | null;
  media: MediaEntry[];
}

interface PersonSearchResult {
  id: number;
  name: string;
  photo_url: string | null;
  media_count: number;
  roles: string[];
}

interface Props {
  personId: number;
  onBack: () => void;
  onOpenMedia?: (mediaId: number) => void;
}

const ROLE_BADGE: Record<string, string> = {
  actor: "bg-blue-100 text-blue-700",
  director: "bg-purple-100 text-purple-700",
  creator: "bg-indigo-100 text-indigo-700",
  author: "bg-green-100 text-green-700",
};

const ROLE_NAME: Record<string, string> = {
  actor: "Aktor",
  director: "Reżyser",
  creator: "Twórca",
  author: "Autor",
};

const SCREEN_AND_GAME_ROLES = ["actor", "director", "creator"];
const BOOK_ROLES = ["author"];

function Initials({ name, size = "sm" }: { name: string; size?: "sm" | "lg" }) {
  const parts = name.trim().split(/\s+/);
  const initials =
    parts.length >= 2
      ? parts[0][0] + parts[parts.length - 1][0]
      : parts[0]?.[0] ?? "?";
  const cls =
    size === "lg"
      ? "w-full h-full flex items-center justify-center bg-gray-200 text-gray-600 font-bold text-2xl select-none"
      : "w-full h-full flex items-center justify-center bg-gray-200 text-gray-500 font-semibold text-xs select-none";
  return <div className={cls}>{initials.toUpperCase()}</div>;
}

function formatWatchDates(raw: string | null): string | null {
  if (!raw) return null;
  const dates = raw.split(",").filter(Boolean);
  if (dates.length === 0) return null;
  const fmt = (d: string) => {
    const parts = d.trim().split("-");
    if (parts.length === 3) return `${parts[2]}.${parts[1]}.${parts[0]}`;
    return d.trim();
  };
  if (dates.length === 1) return fmt(dates[0]);
  return `${fmt(dates[dates.length - 1])} – ${fmt(dates[0])}`;
}

function MediaTile({
  entry,
  onClick,
}: {
  entry: MediaEntry;
  onClick?: () => void;
}) {
  const dates = formatWatchDates(entry.watch_dates);
  return (
    <button
      onClick={onClick}
      disabled={!onClick}
      className="flex flex-col rounded-xl overflow-hidden border border-gray-200 bg-white hover:shadow-md hover:border-purple-300 transition-all group text-left w-20 flex-shrink-0"
    >
      <div className="w-20 bg-gray-100 overflow-hidden flex-shrink-0">
        {entry.cover_url ? (
          <CoverImg
            src={entry.cover_url}
            alt={entry.title}
            width={80}
            height={120}
            className="w-full h-auto object-contain"
          />
        ) : (
          <div className="w-20 h-20 flex items-center justify-center text-2xl">
            {MEDIA_TYPE_EMOJI[entry.media_type] ?? "🎬"}
          </div>
        )}
      </div>
      <div className="p-1.5 space-y-0.5">
        <p className="text-[10px] font-semibold leading-tight line-clamp-2 group-hover:text-purple-700">
          {entry.title}
        </p>
        {dates && (
          <p className="text-[9px] text-blue-500 font-medium">{dates}</p>
        )}
        {entry.character_name && (
          <p className="text-[9px] text-gray-400 italic">{entry.character_name}</p>
        )}
      </div>
    </button>
  );
}

export default function PersonDetailPage({ personId, onBack, onOpenMedia }: Props) {
  const [person, setPerson] = useState<PersonDetail | null>(null);
  const [loading, setLoading] = useState(true);

  // Merge persons state
  const [showMerge, setShowMerge] = useState(false);
  const [mergeSearch, setMergeSearch] = useState("");
  const [mergeResults, setMergeResults] = useState<PersonSearchResult[]>([]);
  const [mergeTarget, setMergeTarget] = useState<PersonSearchResult | null>(null);
  const [merging, setMerging] = useState(false);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/persons/${personId}`)
      .then((r) => r.json())
      .then((data: PersonDetail) => setPerson(data))
      .catch(() => toast("Błąd ładowania osoby", "error"))
      .finally(() => setLoading(false));
  }, [personId]);

  // Merge persons: search
  useEffect(() => {
    if (!mergeSearch.trim() || mergeSearch.length < 2) { setMergeResults([]); return; }
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`/api/persons`);
        const data = await res.json() as PersonSearchResult[];
        const q = mergeSearch.toLowerCase();
        setMergeResults(
          data.filter((p) => p.id !== personId && p.name.toLowerCase().includes(q)).slice(0, 8)
        );
      } catch {
        setMergeResults([]);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [mergeSearch, personId]);

  const handleMerge = async () => {
    if (!mergeTarget) return;
    setMerging(true);
    try {
      const res = await fetch(`/api/persons/${personId}/merge`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sourceId: mergeTarget.id }),
      });
      if (!res.ok) { const d = await res.json() as { error?: string }; throw new Error(d.error); }
      toast(`Scalono "${mergeTarget.name}" z "${person?.name}"`, "success");
      setShowMerge(false);
      setMergeTarget(null);
      setMergeSearch("");
      // Reload person data
      const updated = await fetch(`/api/persons/${personId}`);
      const data = await updated.json() as PersonDetail;
      setPerson(data);
    } catch (e) {
      toast(e instanceof Error ? e.message : "Błąd scalania", "error");
    } finally {
      setMerging(false);
    }
  };

  const watchDaysMap = useMemo(() => {
    const map = new Map<string, string>();
    (person?.media ?? []).forEach((m) => {
      if (!m.watch_dates) return;
      m.watch_dates.split(",").forEach((d) => {
        const date = d.trim();
        if (date) map.set(date, "bg-purple-500");
      });
    });
    return map;
  }, [person?.media]);

  const watchYears = useMemo(() => {
    const years = new Set<number>();
    watchDaysMap.forEach((_, date) => years.add(Number(date.slice(0, 4))));
    return Array.from(years).sort((a, b) => b - a);
  }, [watchDaysMap]);

  if (loading) return <div className="p-6 text-sm text-gray-400">Ładowanie…</div>;

  if (!person) {
    return (
      <div className="p-6 space-y-2">
        <p className="text-sm text-gray-500">Nie znaleziono osoby.</p>
        <button onClick={onBack} className="text-sm text-blue-600 hover:underline">← Wróć</button>
      </div>
    );
  }

  const uniqueRoles = [...new Set(person.media.map((m) => m.role))];

  const screenEntries = person.media.filter((m) => SCREEN_AND_GAME_ROLES.includes(m.role));
  const bookEntries = person.media.filter((m) => BOOK_ROLES.includes(m.role));

  return (
    <div className="space-y-6">
      <button
        onClick={onBack}
        className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-800 transition-colors"
      >
        ← Wróć
      </button>

      {/* Header */}
      <div className="flex items-center gap-4">
        <div className="w-20 h-20 rounded-full overflow-hidden flex-shrink-0 border border-gray-200 shadow-sm">
          {person.photo_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={person.photo_url} alt={person.name} className="w-full h-full object-cover" />
          ) : (
            <Initials name={person.name} size="lg" />
          )}
        </div>
        <div className="space-y-1">
          <h1 className="text-2xl font-bold">{person.name}</h1>
          <div className="flex flex-wrap gap-1">
            {uniqueRoles.map((role) => (
              <span
                key={role}
                className={`text-xs px-2 py-0.5 rounded-full font-medium ${ROLE_BADGE[role] ?? "bg-gray-100 text-gray-600"}`}
              >
                {ROLE_NAME[role] ?? role}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* Section: Połącz osoby */}
      <section className="space-y-2">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">Połącz osoby</h2>
          <button
            onClick={() => { setShowMerge((v) => !v); setMergeTarget(null); setMergeSearch(""); }}
            className="text-xs px-2.5 py-1 rounded-full border border-gray-300 text-gray-600 hover:border-orange-300 hover:text-orange-700 transition-colors"
          >
            {showMerge ? "✕ Anuluj" : "⇄ Scal z osobą"}
          </button>
        </div>

        {showMerge && (
          <div className="rounded-xl border border-orange-100 bg-orange-50 p-3 space-y-2">
            <p className="text-xs text-gray-500">
              Wyszukaj osobę do scalenia. Jej powiązania zostaną przeniesione do <strong>{person.name}</strong>, a ona zostanie usunięta.
            </p>
            {!mergeTarget ? (
              <>
                <input
                  type="search"
                  value={mergeSearch}
                  onChange={(e) => setMergeSearch(e.target.value)}
                  placeholder="Wpisz imię i nazwisko…"
                  className="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-sm bg-white"
                  autoFocus
                />
                {mergeResults.length > 0 && (
                  <div className="rounded-lg border border-gray-200 bg-white divide-y divide-gray-100 max-h-48 overflow-y-auto">
                    {mergeResults.map((p) => (
                      <button
                        key={p.id}
                        onClick={() => setMergeTarget(p)}
                        className="flex items-center justify-between w-full px-3 py-2 text-left hover:bg-orange-50 text-sm transition-colors"
                      >
                        <span className="font-medium">{p.name}</span>
                        <span className="text-xs text-gray-400">{p.media_count} pozycji</span>
                      </button>
                    ))}
                  </div>
                )}
                {mergeSearch.length >= 2 && mergeResults.length === 0 && (
                  <p className="text-xs text-gray-400">Brak wyników.</p>
                )}
              </>
            ) : (
              <div className="space-y-2">
                <div className="flex items-center gap-2 rounded-lg border border-orange-200 bg-white px-3 py-2">
                  <span className="text-sm font-medium flex-1">{mergeTarget.name}</span>
                  <button
                    onClick={() => setMergeTarget(null)}
                    className="text-xs text-gray-400 hover:text-red-500"
                  >
                    ✕
                  </button>
                </div>
                <p className="text-xs text-orange-700">
                  ⚠ Powiązania z <strong>{mergeTarget.name}</strong> zostaną przeniesione do <strong>{person.name}</strong>. Ta operacja jest nieodwracalna.
                </p>
                <button
                  onClick={() => void handleMerge()}
                  disabled={merging}
                  className="w-full py-1.5 rounded-lg bg-orange-600 text-white text-sm font-medium hover:bg-orange-700 disabled:opacity-50 transition-colors"
                >
                  {merging ? "Scalanie…" : `Scal "${mergeTarget.name}" z "${person.name}"`}
                </button>
              </div>
            )}
          </div>
        )}
      </section>
      {screenEntries.length > 0 && (
        <section className="space-y-2">
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">Filmy i seriale</h2>
          <div className="flex flex-wrap gap-2">
            {screenEntries.map((entry) => (
              <MediaTile
                key={`${entry.media_id}-${entry.role}`}
                entry={entry}
                onClick={onOpenMedia ? () => onOpenMedia(entry.media_id) : undefined}
              />
            ))}
          </div>
        </section>
      )}

      {/* Section: Książki */}
      {bookEntries.length > 0 && (
        <section className="space-y-2">
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">Książki</h2>
          <div className="flex flex-wrap gap-2">
            {bookEntries.map((entry) => (
              <MediaTile
                key={`${entry.media_id}-${entry.role}`}
                entry={entry}
                onClick={onOpenMedia ? () => onOpenMedia(entry.media_id) : undefined}
              />
            ))}
          </div>
        </section>
      )}

      {/* Calendar section */}
      {watchYears.length > 0 && (
        <section className="space-y-6">
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">Historia oglądania</h2>
          {watchYears.map((year) => (
            <PersonYearCalendar key={year} year={year} daysMap={watchDaysMap} />
          ))}
        </section>
      )}

      {person.media.length === 0 && (
        <p className="text-sm text-gray-400">Brak powiązanych mediów.</p>
      )}
    </div>
  );
}

