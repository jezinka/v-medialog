"use client";

import { Suspense, useEffect, useState, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import CoverImg from "@/components/CoverImg";
import { toast } from "@/components/Toast";
import { CALENDAR_TYPES, MONTH_NAMES, DAY_LABELS, MEDIA_TYPES, MEDIA_TYPE_LABELS, MEDIA_TYPE_EMOJI } from "@/lib/utils";

interface CalendarEntry {
  season_id: number;
  media_id: number;
  title: string;
  media_type: string;
  cover_url: string | null;
  month: number;
  assigned_day: number;
  is_placeholder: boolean;
  cinema: boolean;
  with_child: boolean;
}

function getDaysInMonth(year: number, month: number) {
  return new Date(year, month, 0).getDate();
}

function getFirstDayOfMonth(year: number, month: number) {
  const d = new Date(year, month - 1, 1).getDay();
  return d === 0 ? 6 : d - 1;
}

function dateKey(year: number, month: number, day: number) {
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function getPolishHolidays(year: number) {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const easter = new Date(year, Math.floor((h + l - 7 * m + 114) / 31) - 1, (h + l - 7 * m + 114) % 31 + 1);
  const movable = (offset: number) => {
    const date = new Date(easter);
    date.setDate(date.getDate() + offset);
    return dateKey(date.getFullYear(), date.getMonth() + 1, date.getDate());
  };

  return new Set([
    dateKey(year, 1, 1), dateKey(year, 1, 6), dateKey(year, 5, 1), dateKey(year, 5, 3),
    dateKey(year, 8, 15), dateKey(year, 11, 1), dateKey(year, 11, 11),
    dateKey(year, 12, 24), dateKey(year, 12, 25), dateKey(year, 12, 26),
    movable(0), movable(1), movable(49), movable(60),
  ]);
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
    return t ? new Set(t.split(",").filter(Boolean)) : new Set(CALENDAR_TYPES);
  });
  const [withChildOnly, setWithChildOnly] = useState(() => searchParams.get("with_child") === "1");
  const [cinemaOnly, setCinemaOnly] = useState(() => searchParams.get("cinema") === "1");
  const [entries, setEntries] = useState<CalendarEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [downloadingMonth, setDownloadingMonth] = useState<number | null>(null);

  const buildUrl = useCallback((y: number, types: Set<string>, childOnly: boolean, cinemaOnlyFilter: boolean) => {
    const params = new URLSearchParams({ year: String(y) });
    if (types.size > 0) params.set("types", Array.from(types).join(","));
    if (childOnly) params.set("with_child", "1");
    if (cinemaOnlyFilter) params.set("cinema", "1");
    return `/calendar?${params.toString()}`;
  }, []);

  const changeYear = useCallback((newYear: number) => {
    setYear(newYear);
  }, []);

  const toggleType = useCallback((type: string) => {
    setActiveTypes((prev) => {
      const next = new Set(prev);
      if (next.has(type)) next.delete(type);
      else next.add(type);
      return next;
    });
  }, []);

  const clearTypes = useCallback(() => {
    setActiveTypes(new Set());
  }, []);

  const toggleWithChildOnly = useCallback(() => {
    setWithChildOnly((prev) => !prev);
  }, []);

  const toggleCinemaOnly = useCallback(() => {
    setCinemaOnly((prev) => !prev);
  }, []);

  useEffect(() => {
    router.replace(buildUrl(year, activeTypes, withChildOnly, cinemaOnly));
  }, [year, activeTypes, withChildOnly, cinemaOnly, router, buildUrl]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ year: String(year) });
      if (activeTypes.size > 0) params.set("types", Array.from(activeTypes).join(","));
      if (withChildOnly) params.set("with_child", "1");
      if (cinemaOnly) params.set("cinema", "1");
      const res = await fetch(`/api/calendar-gallery?${params.toString()}`);
      const data = await res.json();
      setEntries(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error(err);
      setEntries([]);
    } finally {
      setLoading(false);
    }
  }, [year, activeTypes, withChildOnly, cinemaOnly]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const downloadCovers = useCallback(async (month: number, monthEntries: CalendarEntry[]) => {
    const seasonIds = [...new Set(monthEntries.map((entry) => entry.season_id))];
    if (seasonIds.length === 0) return;
    setDownloadingMonth(month);
    try {
      const res = await fetch(`/api/calendar-covers?year=${year}&month=${month}&season_ids=${seasonIds.join(",")}`);
      if (!res.ok) {
        const data = await res.json() as { error?: string };
        throw new Error(data.error ?? "Nie udało się pobrać okładek");
      }
      const url = URL.createObjectURL(await res.blob());
      const link = document.createElement("a");
      link.href = url;
      link.download = `okladki-${year}-${String(month).padStart(2, "0")}.zip`;
      link.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error(error);
      toast(error instanceof Error ? error.message : "Nie udało się pobrać okładek", "error");
    } finally {
      setDownloadingMonth(null);
    }
  }, [year]);

  const printCovers = useCallback((month: number, monthEntries: CalendarEntry[]) => {
    if (monthEntries.every((entry) => !entry.cover_url)) return;

    const printWindow = window.open("", "_blank");
    if (!printWindow) {
      toast("Przeglądarka zablokowała okno druku", "error");
      return;
    }

    printWindow.opener = null;
    printWindow.document.write(`<!doctype html><html lang="pl"><head><title>Okładki ${MONTH_NAMES[month - 1]} ${year}</title><style>
      @page { size: A4 landscape; margin: 10mm; }
      body { font-family: Arial, sans-serif; margin: 0; color: #111; }
      h1 { font-size: 16pt; margin: 0 0 4mm; }
      .grid { display: grid; grid-template-columns: repeat(7, 1fr); gap: .75mm; }
      .label { text-align: center; font-size: 8pt; font-weight: bold; color: #666; padding: 1mm 0; }
      .day { position: relative; height: 27mm; border: .25mm solid #ddd; overflow: hidden; }
      .empty { background: #fafafa; }
      img { position: absolute; top: 5mm; width: 100%; height: calc(100% - 5mm); object-fit: contain; }
      .number { position: absolute; top: 0; left: 0; box-sizing: border-box; width: 100%; height: 5mm; padding: 1mm; border-bottom: .25mm solid #bbb; background: #fff; color-adjust: exact; -webkit-print-color-adjust: exact; print-color-adjust: exact; font-size: 8pt; font-weight: bold; color: #555; }
      .saturday .number { background: #e5e7eb; }
      .sunday .number { background: #fee2e2; color: #b91c1c; }
      .holiday .number { background: #fee2e2; color: #b91c1c; }
    </style></head><body><h1>${MONTH_NAMES[month - 1]} ${year}</h1><div class="grid"></div></body></html>`);
    printWindow.document.close();

    const grid = printWindow.document.querySelector(".grid");
    if (!grid) return;

    const images: HTMLImageElement[] = [];
    for (const label of DAY_LABELS) {
      const header = printWindow.document.createElement("div");
      header.className = "label";
      header.textContent = label;
      grid.append(header);
    }

    const firstDay = getFirstDayOfMonth(year, month);
    for (let i = 0; i < firstDay; i++) {
      const empty = printWindow.document.createElement("div");
      empty.className = "day empty";
      grid.append(empty);
    }

    const entriesByDay = new Map(monthEntries.map((entry) => [entry.assigned_day, entry]));
    const holidays = getPolishHolidays(year);
    for (let day = 1; day <= getDaysInMonth(year, month); day++) {
      const cell = printWindow.document.createElement("div");
      const weekday = (firstDay + day - 1) % 7;
      cell.className = `day${holidays.has(dateKey(year, month, day)) ? " holiday" : weekday === 5 ? " saturday" : weekday === 6 ? " sunday" : ""}`;
      const entry = entriesByDay.get(day);
      if (entry?.cover_url) {
        const image = printWindow.document.createElement("img");
        image.src = new URL(entry.cover_url, window.location.href).href;
        image.alt = entry.title;
        cell.append(image);
        images.push(image);
      }
      const number = printWindow.document.createElement("span");
      number.className = "number";
      number.textContent = String(day);
      cell.append(number);
      grid.append(cell);
    }

    Promise.all(images.map((image) => new Promise<void>((resolve) => {
      image.onload = () => resolve();
      image.onerror = () => resolve();
      if (image.complete) resolve();
    }))).then(() => {
      printWindow.focus();
      printWindow.print();
    });
  }, [year]);

  // Build lookup: month → Map<day, entry>
  const monthDayMap = new Map<number, Map<number, CalendarEntry>>();
  for (const entry of entries) {
    if (!monthDayMap.has(entry.month)) monthDayMap.set(entry.month, new Map());
    monthDayMap.get(entry.month)!.set(entry.assigned_day, entry);
  }
  const holidays = getPolishHolidays(year);

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
        <button
          onClick={toggleWithChildOnly}
          className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
            withChildOnly
              ? "bg-emerald-700 text-white"
              : "bg-emerald-100 text-emerald-700 hover:bg-emerald-200"
          }`}
        >
          👶 Z dzieckiem
        </button>
        <button
          onClick={toggleCinemaOnly}
          className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
            cinemaOnly
              ? "bg-amber-600 text-white"
              : "bg-amber-100 text-amber-700 hover:bg-amber-200"
          }`}
        >
          🎟️ W kinie
        </button>
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
            const monthEntries = [...dayMap.values()];

            return (
              <div key={month} className="bg-white rounded-xl border border-gray-200 shadow-sm p-3">
                <div className="flex items-center justify-between gap-2 mb-2">
                  <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">
                    {MONTH_NAMES[month - 1]}
                  </h3>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => void downloadCovers(month, monthEntries)}
                      disabled={monthEntries.length === 0 || downloadingMonth !== null}
                      className="text-[10px] text-gray-500 hover:text-gray-800 disabled:opacity-30"
                      title="Pobierz okładki z tego miesiąca"
                    >
                      {downloadingMonth === month ? "Pobieram…" : "⬇ Okładki"}
                    </button>
                    <button
                      onClick={() => printCovers(month, monthEntries)}
                      disabled={monthEntries.every((entry) => !entry.cover_url)}
                      className="text-[10px] text-gray-500 hover:text-gray-800 disabled:opacity-30"
                      title="Drukuj okładki z tego miesiąca jako PDF"
                    >
                      🖨️ PDF
                    </button>
                  </div>
                </div>

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
                    const weekday = (firstDay + day - 1) % 7;
                    const isHoliday = holidays.has(dateKey(year, month, day));
                    const href = entry
                      ? `/media/${entry.media_id}`
                      : undefined;
                    return (
                      <a
                        key={day}
                        href={href}
                        target={undefined}
                        rel={undefined}
                        title={entry ? (entry.is_placeholder ? `${entry.title} (brak daty)` : entry.title) : undefined}
                        className={[
                          "relative aspect-square rounded overflow-hidden block",
                          entry
                            ? "cursor-pointer shadow-sm hover:shadow-md hover:scale-[1.08] transition-all duration-150 border border-gray-200"
                            : "bg-gray-50 border border-gray-100",
                        ].join(" ")}
                      >
                        <div className="absolute inset-x-0 bottom-0 top-4">
                          {entry?.cover_url && (
                            <CoverImg
                              src={entry.cover_url}
                              alt={entry.title}
                              fill
                              className="object-contain"
                              sizes="(max-width: 640px) 14vw, (max-width: 1024px) 9vw, 6vw"
                            />
                          )}
                          {entry?.is_placeholder && (
                            <div className="absolute inset-0 bg-gray-400/50 z-10" />
                          )}
                          {entry && (
                            <div className="absolute inset-0 bg-black/0 hover:bg-black/20 transition-colors z-10" />
                          )}
                        </div>
                        <span
                          className={[
                            "absolute inset-x-0 top-0 z-20 h-4 px-1 text-[9px] font-bold leading-4",
                            isHoliday || weekday === 6
                              ? "bg-red-100 text-red-700"
                              : weekday === 5
                                ? "bg-gray-200 text-gray-600"
                                : "bg-white text-gray-600",
                          ].join(" ")}
                        >
                          {day}
                        </span>
                        {/* Cinema star */}
                        {entry?.cinema && (
                          <span className="absolute top-4 right-0.5 text-[10px] leading-none z-20 drop-shadow-[0_1px_2px_rgba(0,0,0,0.9)]">⭐</span>
                        )}
                        {entry?.with_child && (
                          <span className="absolute bottom-0.5 right-0.5 text-[10px] leading-none z-20 drop-shadow-[0_1px_2px_rgba(0,0,0,0.9)]">👶</span>
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
