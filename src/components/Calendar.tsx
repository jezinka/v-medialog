"use client";
import { useMemo, useState, useCallback } from "react";
import { BOOK_TYPES, DAY_LABELS, MONTH_NAMES, isDateInRange, daysBetween } from "@/lib/utils";
import { dateKey, getDaysInMonth, getFirstDayOfMonth } from "@/lib/calendar-days";

interface MediaItem {
  id: number;
  mediaId: number;
  title: string;
  author: string | null;
  mediaType: string;
  startDate: string;
  endDate: string | null;
  volumeEpisode: string | null;
  additionalSessions?: string | null;
}

interface Props {
  year: number;
  items: MediaItem[];
  /** Line above the months, e.g. how to add a session */
  hint: string;
  onDayClick?: (startDate: string, endDate: string, itemIds: number[]) => void;
}

/** Hover colours, one per title on the hovered day (light enough for dark day numbers) */
const HOVER_COLORS = ["#c4b5fd", "#fdba74", "#86efac", "#93c5fd", "#f9a8d4", "#fde047"];

/** Horizontal stripes, one per colour, with a 1px white gap between them */
function stripes(colors: string[]): string {
  const w = 100 / colors.length;
  const stops = colors.map((c, i) => `${i ? `white ${i * w}% calc(${i * w}% + 1px), ${c} calc(${i * w}% + 1px)` : `${c} 0%`} ${(i + 1) * w}%`);
  return `linear-gradient(180deg, ${stops.join(", ")})`;
}

/** A plain year calendar for entering sessions: click a day or drag across several; a purple dot marks days with reading, an orange one days with watching.
 * Hovering a day lights up every day of the titles on it, each title in its own colour, named above the months. */
export default function Calendar({ year, items: rawItems, hint, onDayClick }: Props) {
  // Skip year-placeholder items (start=YYYY-01-01, end=YYYY-12-31, ~365 days)
  const items = rawItems.filter((item) => daysBetween(item.startDate, item.endDate) < 365);

  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState<string | null>(null);
  const [dragEnd, setDragEnd] = useState<string | null>(null);
  // Titles on the hovered day, earliest started first: all their days light up, each title in its own colour
  const [hovered, setHovered] = useState<{ mediaId: number; title: string }[]>([]);

  const isInDragRange = useCallback((dateStr: string): boolean => {
    if (!dragStart) return false;
    const end = dragEnd ?? dragStart;
    const [a, b] = dragStart <= end ? [dragStart, end] : [end, dragStart];
    return dateStr >= a && dateStr <= b;
  }, [dragStart, dragEnd]);

  const months = useMemo(() => {
    return Array.from({ length: 12 }, (_, monthIdx) => {
      const daysCount = getDaysInMonth(year, monthIdx + 1);
      const firstDay = getFirstDayOfMonth(year, monthIdx + 1);

      const days = Array.from({ length: daysCount }, (_, dayIdx) => {
        const day = dayIdx + 1;
        const dateStr = dateKey(year, monthIdx + 1, day);
        const mediaOnDay = items.filter((item) => {
          if (isDateInRange(dateStr, item.startDate, item.endDate)) return true;
          if (item.additionalSessions) {
            try {
              const sessions = JSON.parse(item.additionalSessions) as Array<{ start_date: string; end_date: string }>;
              return sessions.some((s) => isDateInRange(dateStr, s.start_date, s.end_date));
            } catch { return false; }
          }
          return false;
        });
        return { day, dateStr, mediaOnDay };
      });

      return { monthIdx, daysCount, firstDay, days };
    });
  }, [year, items]);

  /** Precomputed map: dateStr → session IDs on that day (for O(1) click lookup) */
  const dayItemIdsMap = useMemo(() => {
    const map = new Map<string, number[]>();
    for (const { days } of months) {
      for (const { dateStr, mediaOnDay } of days) {
        if (mediaOnDay.length > 0) map.set(dateStr, mediaOnDay.map((m) => m.id));
      }
    }
    return map;
  }, [months]);

  const handleMouseDown = (dateStr: string) => {
    if (!onDayClick) return;
    setIsDragging(true);
    setDragStart(dateStr);
    setDragEnd(dateStr);
  };

  const handleDayMouseEnter = (dateStr: string, mediaOnDay: MediaItem[]) => {
    if (isDragging) setDragEnd(dateStr);
    // Empty days keep the highlight, so it doesn't flicker between sessions; leaving the calendar clears it
    if (mediaOnDay.length > 0) {
      const byMedia = new Map<number, string>();
      for (const m of [...mediaOnDay].sort((a, b) => a.startDate.localeCompare(b.startDate) || a.id - b.id)) {
        if (!byMedia.has(m.mediaId)) byMedia.set(m.mediaId, m.title);
      }
      setHovered([...byMedia].map(([mediaId, title]) => ({ mediaId, title })));
    }
  };

  const handleMouseUp = useCallback(() => {
    if (!isDragging || !dragStart || !onDayClick) {
      setIsDragging(false);
      return;
    }
    const end = dragEnd ?? dragStart;
    const [start, finish] = dragStart <= end ? [dragStart, end] : [end, dragStart];
    setIsDragging(false);
    setDragStart(null);
    setDragEnd(null);
    const itemIds = start === finish ? (dayItemIdsMap.get(start) ?? []) : [];
    onDayClick(start, finish, itemIds);
  }, [isDragging, dragStart, dragEnd, onDayClick, dayItemIdsMap]);

  return (
    <div
      className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 select-none"
      onMouseLeave={() => {
        if (isDragging) handleMouseUp();
        setHovered([]);
      }}
    >
      {/* While hovering, the hint gives way to the colour legend */}
      <p className="text-sm text-gray-500 mb-4 min-h-5 flex flex-wrap gap-x-3 gap-y-1">
        {hovered.length > 0 ? hovered.map(({ mediaId, title }, i) => (
          <span key={mediaId} className="inline-flex items-center gap-1.5 text-gray-700">
            <span className="w-3 h-3 rounded-sm" style={{ backgroundColor: HOVER_COLORS[i % HOVER_COLORS.length] }} />
            {title}
          </span>
        )) : hint}
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-6 gap-4">
        {months.map(({ monthIdx, firstDay, days }) => (
          <div key={monthIdx} className="min-w-0">
            <div className="text-xs font-semibold text-gray-600 mb-1 uppercase tracking-wide">
              {MONTH_NAMES[monthIdx]}
            </div>
            <div className="grid grid-cols-7 gap-0.5">
              {DAY_LABELS.map((label) => (
                <div key={label} className="text-center text-xs text-gray-400 py-0.5 font-medium">
                  {label}
                </div>
              ))}
              {Array.from({ length: firstDay }, (_, i) => (
                <div key={`empty-${i}`} />
              ))}
              {days.map(({ day, dateStr, mediaOnDay }) => {
                const read = mediaOnDay.some((m) => BOOK_TYPES.includes(m.mediaType));
                const watched = mediaOnDay.some((m) => !BOOK_TYPES.includes(m.mediaType));
                const inRange = isInDragRange(dateStr);
                const colors = hovered.flatMap(({ mediaId }, i) => mediaOnDay.some((m) => m.mediaId === mediaId) ? [HOVER_COLORS[i % HOVER_COLORS.length]] : []);
                const tooltip = mediaOnDay.map((m) => {
                  let label = m.title;
                  if (m.volumeEpisode) label += ` (${m.volumeEpisode})`;
                  if (m.author) label += ` -- ${m.author}`;
                  return label;
                }).join("\n");

                return (
                  <div
                    key={dateStr}
                    title={tooltip || undefined}
                    onMouseDown={() => handleMouseDown(dateStr)}
                    onMouseEnter={() => handleDayMouseEnter(dateStr, mediaOnDay)}
                    onMouseUp={handleMouseUp}
                    style={!inRange && colors.length ? { background: stripes(colors) } : undefined}
                    className={[
                      "aspect-square flex flex-col items-center justify-center gap-0.5 text-xs rounded-sm",
                      inRange ? "bg-purple-500 text-white font-medium" :  colors.length ? "text-gray-900 font-medium" : "text-gray-700 hover:bg-gray-100",
                      onDayClick ? "cursor-pointer" : "cursor-default",
                    ].join(" ")}
                  >
                    {day}
                    <span className="flex gap-0.5 h-1">
                      {read && <span className={`w-1 h-1 rounded-full ${inRange ? "bg-white" : "bg-purple-500"}`} />}
                      {watched && <span className={`w-1 h-1 rounded-full ${inRange ? "bg-white" : "bg-orange-500"}`} />}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

