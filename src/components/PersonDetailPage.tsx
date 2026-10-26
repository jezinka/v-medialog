"use client";

import { useEffect, useMemo, useState } from "react";
import CoverImg from "./CoverImg";
import { MEDIA_TYPE_EMOJI, MONTH_NAMES } from "@/lib/utils";
import { dateKey, monthCells } from "@/lib/calendar-days";
import MonthGrid from "./MonthGrid";
import { toast } from "./Toast";
import MergePersonPanel from "./person/MergePersonPanel";

function PersonYearCalendar({ year, daysMap }: { year: number; daysMap: Map<string, string> }) {
  const activeMonths = Array.from({ length: 12 }, (_, i) => i + 1)
    .filter((month) => monthCells(year, month).some((d) => d !== null && daysMap.has(dateKey(year, month, d))));

  if (activeMonths.length === 0) return null;

  return (
    <div>
      <h3 className="text-xs font-semibold text-gray-500 mb-2">{year}</h3>
      <div className="flex flex-wrap gap-4">
        {activeMonths.map((month) => (
          <MonthGrid key={month} year={year} month={month} label={MONTH_NAMES[month - 1]} days={daysMap} className="w-[160px]" />
        ))}
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

  useEffect(() => {
    setLoading(true);
    fetch(`/api/persons/${personId}`)
      .then((r) => r.json())
      .then((data: PersonDetail) => setPerson(data))
      .catch(() => toast("Błąd ładowania osoby", "error"))
      .finally(() => setLoading(false));
  }, [personId]);

  // After a merge, shows the links moved over from the merged person
  const reloadPerson = async () => {
    const res = await fetch(`/api/persons/${personId}`);
    setPerson(await res.json() as PersonDetail);
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
    <div className="max-w-7xl mx-auto px-4 py-6 space-y-6">
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

      <MergePersonPanel personId={personId} personName={person.name} onMerged={() => void reloadPerson()} />
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

