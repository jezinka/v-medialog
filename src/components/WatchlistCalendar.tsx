"use client";

import { useCallback, useEffect, useState } from "react";
import CoverImg from "./CoverImg";
import { MONTH_NAMES, DAY_LABELS } from "@/lib/utils";

interface WatchlistEntry {
  media_id: number;
  season_id: number;
  title: string;
  media_type: string;
  cover_url: string | null;
  last_session_date: string | null;
  category: "future" | "past" | "no_date";
}

function getDaysInMonth(year: number, month: number) {
  return new Date(year, month, 0).getDate();
}

function getFirstDayOfMonth(year: number, month: number) {
  const d = new Date(year, month - 1, 1).getDay();
  return d === 0 ? 6 : d - 1;
}

export default function WatchlistCalendar() {
  const [entries, setEntries] = useState<WatchlistEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const year = new Date().getFullYear();

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/watchlist-calendar");
      const data = await res.json();
      setEntries(Array.isArray(data) ? data : []);
    } catch {
      setEntries([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-400" />
      </div>
    );
  }

  if (entries.length === 0) {
    return (
      <div className="text-center py-16 text-gray-400">
        <p className="text-4xl mb-3">👁</p>
        <p className="text-sm">Brak oznaczonych sezonów.</p>
        <p className="text-xs mt-1">Otwórz medium i zaznacz „👁 Chcę obejrzeć" przy sezonie.</p>
      </div>
    );
  }

  // Entries with a date in the current year go into the calendar; everything else goes to the list
  const calendarEntries = entries.filter(
    (e) => e.last_session_date && (
      e.last_session_date.startsWith(String(year)) ||
      e.last_session_date.startsWith(String(year + 1))
    )
  );
  const listEntries = entries.filter(
    (e) => !e.last_session_date || (
      !e.last_session_date.startsWith(String(year)) &&
      !e.last_session_date.startsWith(String(year + 1))
    )
  );

  // Build calendar: map `${year}-${month}` → Map<day, entry>
  const monthDayMap = new Map<string, Map<number, WatchlistEntry>>();
  const occupiedKeys = new Set<string>();

  for (const entry of calendarEntries) {
    if (!entry.last_session_date) continue;
    const entryYear = parseInt(entry.last_session_date.slice(0, 4));
    const month = parseInt(entry.last_session_date.slice(5, 7));
    const day = parseInt(entry.last_session_date.slice(8, 10));
    const mapKey = `${entryYear}-${month}`;
    const dayKey = `${mapKey}-${day}`;
    if (!monthDayMap.has(mapKey)) monthDayMap.set(mapKey, new Map());
    if (!occupiedKeys.has(dayKey)) {
      occupiedKeys.add(dayKey);
      monthDayMap.get(mapKey)!.set(day, entry);
    }
  }

  const calendarYears = [year, year + 1].filter(
    (y) => calendarEntries.some((e) => e.last_session_date?.startsWith(String(y)))
  );

  return (
    <div className="space-y-6">
      {/* List: no-date and other-year entries */}
      {listEntries.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-gray-700 mb-3">
            Dostępne / bez daty premiery
          </h3>
          <div className="grid grid-cols-4 sm:grid-cols-6 lg:grid-cols-8 gap-2">
            {listEntries.map((entry) => (
              <a
                key={entry.season_id}
                href={`/media/${entry.media_id}`}
                title={`${entry.title}${entry.last_session_date ? ` (${entry.last_session_date})` : " (brak daty)"}`}
                className={[
                  "relative rounded-lg overflow-hidden cursor-pointer shadow-sm hover:shadow-md hover:scale-[1.05] transition-all duration-150 border aspect-[2/3] block",
                  entry.category === "past"
                    ? "border-blue-300"
                    : "border-gray-200",
                ].join(" ")}
              >
                {entry.cover_url ? (
                  <CoverImg
                    src={entry.cover_url}
                    alt={entry.title}
                    fill
                    className="object-contain"
                    sizes="(max-width: 640px) 25vw, (max-width: 1024px) 16vw, 12vw"
                  />
                ) : (
                  <div className="absolute inset-0 bg-gray-100 flex items-center justify-center">
                    <span className="text-base">📺</span>
                  </div>
                )}
                {entry.category === "past" && (
                  <div className="absolute inset-0 bg-blue-500/20" />
                )}
                {entry.category === "no_date" && (
                  <div className="absolute inset-0 bg-gray-400/40" />
                )}
                <span className="absolute top-0.5 left-0.5 text-[8px] font-bold text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.9)] leading-none z-10">
                  {entry.last_session_date ? entry.last_session_date.slice(5) : "?"}
                </span>
              </a>
            ))}
          </div>
        </div>
      )}

      {/* Calendar: current and next year entries */}
      {calendarYears.map((calYear) => (
        <div key={calYear}>
          <h3 className="text-sm font-semibold text-gray-700 mb-3">
            Premiery {calYear}
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {Array.from({ length: 12 }, (_, i) => i + 1).map((month) => {
              const daysCount = getDaysInMonth(calYear, month);
              const firstDay = getFirstDayOfMonth(calYear, month);
              const dayMap = monthDayMap.get(`${calYear}-${month}`) ?? new Map<number, WatchlistEntry>();

              return (
                <div key={month} className="bg-white rounded-xl border border-gray-200 shadow-sm p-3">
                  <h4 className="text-sm font-semibold text-gray-700 mb-2 uppercase tracking-wide">
                    {MONTH_NAMES[month - 1]}
                  </h4>

                  <div className="grid grid-cols-7 gap-px">
                    {DAY_LABELS.map((label) => (
                      <div key={label} className="text-center text-[10px] font-medium text-gray-400 py-1">
                        {label}
                      </div>
                    ))}

                    {Array.from({ length: firstDay }, (_, i) => (
                      <div key={`e-${i}`} className="aspect-square" />
                    ))}

                    {Array.from({ length: daysCount }, (_, i) => {
                      const day = i + 1;
                      const entry = dayMap.get(day);
                      return (
                        <a
                          key={day}
                          href={entry ? `/media/${entry.media_id}` : undefined}
                          title={entry ? entry.title : undefined}
                          className={[
                            "relative aspect-square rounded overflow-hidden block",
                            entry
                              ? "cursor-pointer shadow-sm hover:shadow-md hover:scale-[1.08] transition-all duration-150 border border-gray-200"
                              : "bg-gray-50 border border-gray-100",
                          ].join(" ")}
                        >
                          {entry?.cover_url && (
                            <CoverImg
                              src={entry.cover_url}
                              alt={entry.title}
                              fill
                              className="object-contain"
                              sizes="(max-width: 640px) 14vw, (max-width: 1024px) 9vw, 6vw"
                            />
                          )}
                          {entry && !entry.cover_url && (
                            <div className="absolute inset-0 bg-blue-100 flex items-center justify-center">
                              <span className="text-[10px]">📺</span>
                            </div>
                          )}
                          <span
                            className={[
                              "absolute top-0.5 left-0.5 text-[9px] font-bold leading-none z-10",
                              entry ? "text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.9)]" : "text-gray-400",
                            ].join(" ")}
                          >
                            {day}
                          </span>
                          {entry && (
                            <div className="absolute inset-0 bg-black/0 hover:bg-black/20 transition-colors z-10" />
                          )}
                        </a>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
