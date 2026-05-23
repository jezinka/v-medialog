"use client";

import { Suspense, useEffect, useState, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import CoverImg from "@/components/CoverImg";
import { MONTH_NAMES, DAY_LABELS, MEDIA_TYPES, MEDIA_TYPE_LABELS, MEDIA_TYPE_EMOJI } from "@/lib/utils";

interface CalendarEntry {
  media_id: number;
  title: string;
  media_type: string;
  cover_url: string;
  month: number;
  assigned_day: number;
  is_placeholder: boolean;
  cinema: boolean;
}

function getDaysInMonth(year: number, month: number) {
  return new Date(year, month, 0).getDate();
}

function getFirstDayOfMonth(year: number, month: number) {
  const d = new Date(year, month - 1, 1).getDay();
  return d === 0 ? 6 : d - 1;
}


function CalendarInner() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [year, setYear] = useState(() => {
    const p = searchParams.get("year");
    return p ? parseInt(p) : new Date().getFullYear();
  });
  const [activeTypes, setActiveTypes] = useState<Set<string>>(() => {
    const t = searchParams.get("types");
    return t ? new Set(t.split(",").filter(Boolean)) : new Set<string>();
  });
  const [entries, setEntries] = useState<CalendarEntry[]>([]);
  const [loading, setLoading] = useState(true);

  const buildUrl = useCallback((y: number, types: Set<string>) => {
    const params = new URLSearchParams({ year: String(y) });
    if (types.size > 0) params.set("types", Array.from(types).join(","));
    return `/calendar?${params.toString()}`;
  }, []);

  const changeYear = useCallback((newYear: number) => {
    setYear(newYear);
    router.replace(buildUrl(newYear, activeTypes));
  }, [router, activeTypes, buildUrl]);

  const toggleType = useCallback((type: string) => {
    setActiveTypes((prev) => {
      const next = new Set(prev);
      if (next.has(type)) next.delete(type);
      else next.add(type);
      router.replace(buildUrl(year, next));
      return next;
    });
  }, [year, router, buildUrl]);

  const clearTypes = useCallback(() => {
    setActiveTypes(new Set());
    router.replace(buildUrl(year, new Set()));
  }, [year, router, buildUrl]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ year: String(year) });
      if (activeTypes.size > 0) params.set("types", Array.from(activeTypes).join(","));
      const res = await fetch(`/api/calendar-gallery?${params.toString()}`);
      const data = await res.json();
      setEntries(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error(err);
      setEntries([]);
    } finally {
      setLoading(false);
    }
  }, [year, activeTypes]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // Build lookup: month → Map<day, entry>
  const monthDayMap = new Map<number, Map<number, CalendarEntry>>();
  for (const entry of entries) {
    if (!monthDayMap.has(entry.month)) monthDayMap.set(entry.month, new Map());
    monthDayMap.get(entry.month)!.set(entry.assigned_day, entry);
  }

  return (
    <main className="px-4 py-6">
      {/* Year navigation */}
      <div className="flex items-center justify-between mb-6">
        <button
          onClick={() => changeYear(year - 1)}
          className="w-10 h-10 flex items-center justify-center bg-white border border-gray-200 shadow rounded-xl hover:shadow-md transition-all text-gray-600 text-xl"
          aria-label="Poprzedni rok"
        >
          ‹
        </button>
        <h2 className="text-xl font-bold text-gray-800">{year}</h2>
        <button
          onClick={() => changeYear(year + 1)}
          className="w-10 h-10 flex items-center justify-center bg-white border border-gray-200 shadow rounded-xl hover:shadow-md transition-all text-gray-600 text-xl"
          aria-label="Następny rok"
        >
          ›
        </button>
      </div>

      {/* Type filter chips */}
      <div className="flex flex-wrap gap-1.5 mb-4">
        <button
          onClick={clearTypes}
          className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
            activeTypes.size === 0
              ? "bg-gray-800 text-white"
              : "bg-gray-100 text-gray-600 hover:bg-gray-200"
          }`}
        >
          Wszystko
        </button>
        {MEDIA_TYPES.map((t) => (
          <button
            key={t}
            onClick={() => toggleType(t)}
            className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
              activeTypes.has(t)
                ? "bg-gray-800 text-white"
                : "bg-gray-100 text-gray-600 hover:bg-gray-200"
            }`}
          >
            {MEDIA_TYPE_EMOJI[t]} {MEDIA_TYPE_LABELS[t]}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-400" />
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {Array.from({ length: 12 }, (_, i) => i + 1).map((month) => {
            const daysCount = getDaysInMonth(year, month);
            const firstDay = getFirstDayOfMonth(year, month);
            const dayMap = monthDayMap.get(month) ?? new Map<number, CalendarEntry>();

            return (
              <div key={month} className="bg-white rounded-xl border border-gray-200 shadow-sm p-3">
                <h3 className="text-sm font-semibold text-gray-700 mb-2 uppercase tracking-wide">
                  {MONTH_NAMES[month - 1]}
                </h3>

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
                        title={entry ? (entry.is_placeholder ? `${entry.title} (brak daty)` : entry.title) : undefined}
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
                        {/* Gray wash for placeholder entries */}
                        {entry?.is_placeholder && (
                          <div className="absolute inset-0 bg-gray-400/50 z-10" />
                        )}
                        {/* Cinema star */}
                        {entry?.cinema && (
                          <span className="absolute top-0.5 right-0.5 text-[10px] leading-none z-20 drop-shadow-[0_1px_2px_rgba(0,0,0,0.9)]">⭐</span>
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
      )}
    </main>
  );
}

export default function CalendarPage() {
  return (
    <Suspense>
      <CalendarInner />
    </Suspense>
  );
}
