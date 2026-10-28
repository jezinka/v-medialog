"use client";
import { useEffect, useMemo, useRef } from "react";
import { BOOK_TYPES, MEDIA_TYPE_HEX, MONTH_NAMES, SCREEN_TYPES } from "@/lib/utils";
import { mergeRuns, packLanes } from "@/lib/gantt-lanes";
import { dateKey } from "@/lib/calendar-days";

interface GanttItem {
  id: number;
  mediaId: number;
  title: string;
  mediaType: string;
  startDate: string;
  endDate: string | null;
  volumeEpisode: string | null;
  withChild: boolean | number;
}

const DAY_PX = 12;
const ROW_PX = 26;
/** Sessions of a title at most this many days apart show as one bar */
const MERGE_GAP_DAYS = 7;
/** Day index of `date` (YYYY-MM-DD) within `year`, 0 = 1 January */
const dayOf = (year: number, date: string) => Math.round((Date.parse(date) - Date.UTC(year, 0, 1)) / 864e5);

const GROUPS: { label: string; has: (i: GanttItem) => boolean }[] = [
  { label: "📚 Czytanie", has: (i) => BOOK_TYPES.includes(i.mediaType) },
  { label: "🎬 Ekran", has: (i) => SCREEN_TYPES.includes(i.mediaType) && !i.withChild },
  { label: "👶 Z dzieckiem", has: (i) => SCREEN_TYPES.includes(i.mediaType) && !!i.withChild },
];

/** The year's sessions as bars on a time axis, books, screen and screen with the child in separate bands. */
export default function GanttView({ year, items, onOpen }: { year: number; items: GanttItem[]; onOpen: (mediaId: number) => void }) {
  const days = dayOf(year, `${year + 1}-01-01`);
  const scrollRef = useRef<HTMLDivElement>(null);

  const groups = useMemo(() => GROUPS.map(({ label, has }) => {
    const bars = items
      .filter(has)
      .map((i) => ({ item: i, key: i.mediaId, start: Math.max(0, dayOf(year, i.startDate)), end: Math.min(days - 1, dayOf(year, i.endDate ?? i.startDate)) }))
      // Skip year placeholders (whole-year spans) like the calendar does
      .filter((b) => b.end >= b.start && b.end - b.start < 364);
    const runs = mergeRuns(bars, MERGE_GAP_DAYS);
    const { lanes, count } = packLanes(runs);
    return { label, bars: runs.map((r, i) => ({ ...r, lane: lanes[i] })), count };
  }), [items, year, days]);

  const now = new Date(); // local date, so the line doesn't sit on yesterday just after midnight
  const today = now.getFullYear() === year ? dayOf(year, dateKey(year, now.getMonth() + 1, now.getDate())) : null;

  // Open the current year with today near the right edge, the weeks before it in view
  useEffect(() => {
    const el = scrollRef.current;
    if (today == null || !el) return;
    el.scrollLeft = (today + 7) * DAY_PX - el.clientWidth;
  }, [today]);

  const width = days * DAY_PX;
  const months = MONTH_NAMES.map((name, m) => ({ name, x: dayOf(year, `${year}-${String(m + 1).padStart(2, "0")}-01`) * DAY_PX }));
  const saturdays = Array.from({ length: days }, (_, d) => d).filter((d) => new Date(Date.UTC(year, 0, 1 + d)).getUTCDay() === 6);

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
      <div ref={scrollRef} className="overflow-x-auto">
        <div className="relative" style={{ width }}>
          {saturdays.map((d) => (
            <div key={d} className="absolute top-0 bottom-0 bg-gray-50" style={{ left: d * DAY_PX, width: 2 * DAY_PX }} />
          ))}
          {months.map(({ name, x }) => (
            <div key={name} className="absolute top-0 bottom-0 border-l border-gray-200" style={{ left: x }} />
          ))}
          {today != null && (
            <div className="absolute top-0 bottom-0 border-l-2 border-red-400" style={{ left: today * DAY_PX + DAY_PX / 2 }} title="Dziś" />
          )}
          <div className="relative h-6">
            {months.map(({ name, x }) => (
              <span key={name} className="absolute top-0 text-xs font-semibold text-gray-600 uppercase tracking-wide" style={{ left: x + 4 }}>{name}</span>
            ))}
          </div>
          {groups.map(({ label, bars, count }) => (
            <div key={label} className="relative mt-2">
              <div className="sticky left-0 inline-block text-sm font-semibold text-gray-800 mb-1 bg-white/80 pr-2">{label}</div>
              <div className="relative" style={{ height: Math.max(count, 1) * ROW_PX }}>
                {bars.map(({ members, start, end, lane }) => {
                  const item = members[0].item;
                  const w = (end - start + 1) * DAY_PX - 1;
                  const volumes = [...new Set(members.map((m) => m.item.volumeEpisode).filter((v) => v != null))].sort((x, y) => Number(x) - Number(y));
                  // "1–3" only for consecutive seasons, otherwise list them
                  const consecutive = volumes.every((v, i) => i === 0 || Number(v) === Number(volumes[i - 1]) + 1);
                  const seasons = volumes.length > 2 && consecutive ? `${volumes[0]}–${volumes.at(-1)}` : volumes.join(", ");
                  const name = volumes.length ? `${item.title} (${seasons})` : item.title;
                  const last = members.map((m) => m.item.endDate ?? m.item.startDate).sort().at(-1)!;
                  const dates = last !== item.startDate ? `${item.startDate} – ${last}` : item.startDate;
                  return (
                    <button
                      key={item.id}
                      onClick={() => onOpen(item.mediaId)}
                      aria-label={name}
                      title={`${name}\n${dates}${members.length > 1 ? ` · ${members.length} sesji` : ""}`}
                      className="absolute h-[22px] rounded px-1.5 text-left text-xs leading-[22px] text-white font-medium truncate hover:ring-2 hover:ring-gray-800 focus-visible:ring-2 focus-visible:ring-gray-800 focus-visible:outline-none"
                      style={{ left: start * DAY_PX, top: lane * ROW_PX, width: w, backgroundColor: MEDIA_TYPE_HEX[item.mediaType] ?? "#9333ea" }}
                    >
                      {w > 40 ? name : ""}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
