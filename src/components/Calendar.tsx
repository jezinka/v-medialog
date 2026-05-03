"use client";
import { useMemo, useState, useCallback } from "react";
import { MEDIA_TYPE_HEX, DAY_LABELS, MONTH_NAMES, isDateInRange, daysBetween } from "@/lib/utils";

interface MediaItem {
  id: number;
  mediaId?: number;
  title: string;
  author: string | null;
  mediaType: string;
  startDate: string;
  endDate: string | null;
  volumeEpisode: string | null;
  discontinued: boolean | null;
  additionalSessions?: string | null;
}

interface Props {
  year: number;
  items: MediaItem[];
  title: string;
  onDayClick?: (startDate: string, endDate: string, mediaType: "book" | "movie", itemIds: number[]) => void;
  calendarType?: "book" | "movie";
}

function getDaysInMonth(year: number, month: number) {
  return new Date(year, month + 1, 0).getDate();
}

function getFirstDayOfMonth(year: number, month: number) {
  const d = new Date(year, month, 1).getDay();
  return d === 0 ? 6 : d - 1;
}

/** Blend hex color toward white by `amount` (0=unchanged, 1=white) */
function lightenColor(hex: string, amount: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgb(${Math.round(r + (255 - r) * amount)},${Math.round(g + (255 - g) * amount)},${Math.round(b + (255 - b) * amount)})`;
}

function getItemColor(mediaType: string, isAlt: boolean): string {
  const hex = MEDIA_TYPE_HEX[mediaType] || "#9333ea";
  return isAlt ? lightenColor(hex, 0.42) : hex;
}

export default function Calendar({ year, items: rawItems, title, onDayClick, calendarType = "book" }: Props) {
  // Skip year-placeholder items (start=YYYY-01-01, end=YYYY-12-31, ~365 days)
  const items = rawItems.filter((item) => daysBetween(item.startDate, item.endDate) < 365);

  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState<string | null>(null);
  const [dragEnd, setDragEnd] = useState<string | null>(null);
  // Media IDs whose ALL sessions should be highlighted (set on day hover)
  const [hoveredMediaIds, setHoveredMediaIds] = useState<Set<number>>(new Set());

  const isInDragRange = useCallback((dateStr: string): boolean => {
    if (!dragStart) return false;
    const end = dragEnd ?? dragStart;
    const [a, b] = dragStart <= end ? [dragStart, end] : [end, dragStart];
    return dateStr >= a && dateStr <= b;
  }, [dragStart, dragEnd]);

  /** Assign alternating parity to items sorted by startDate (then id) so adjacent items have different shades */
  const itemParityMap = useMemo(() => {
    const sorted = [...items].sort((a, b) => a.startDate.localeCompare(b.startDate) || a.id - b.id);
    return new Map(sorted.map((item, idx) => [item.id, idx % 2 === 1]));
  }, [items]);

  const months = useMemo(() => {
    return Array.from({ length: 12 }, (_, monthIdx) => {
      const daysCount = getDaysInMonth(year, monthIdx);
      const firstDay = getFirstDayOfMonth(year, monthIdx);

      const days = Array.from({ length: daysCount }, (_, dayIdx) => {
        const day = dayIdx + 1;
        const dateStr = `${year}-${String(monthIdx + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
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

  /** Precomputed map: dateStr → media IDs on that day (for hover grouping) */
  const dayMediaIdsMap = useMemo(() => {
    const map = new Map<string, number[]>();
    for (const { days } of months) {
      for (const { dateStr, mediaOnDay } of days) {
        if (mediaOnDay.length > 0) {
          const mediaIds = [...new Set(mediaOnDay.map((m) => m.mediaId ?? m.id))];
          map.set(dateStr, mediaIds);
        }
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
    // Only update highlight when entering a day that has media.
    // Don't clear when passing through empty days — container onMouseLeave handles that.
    if (mediaOnDay.length > 0) {
      setHoveredMediaIds(new Set(mediaOnDay.map((m) => m.mediaId ?? m.id)));
    }
  };

  const handleDayMouseLeave = () => {
    // No-op on individual days — clearing is handled by the container's onMouseLeave
    // so hover stays active when passing through empty days between sessions of the same medium
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
    onDayClick(start, finish, calendarType, itemIds);
  }, [isDragging, dragStart, dragEnd, onDayClick, calendarType, dayItemIdsMap]);

  return (
    <div
      className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 select-none"
      onMouseLeave={() => {
        if (isDragging) handleMouseUp();
        setHoveredMediaIds(new Set());
      }}
    >
      <h3 className="text-lg font-semibold text-gray-800 mb-4">{title}</h3>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
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
                const hasMedia = mediaOnDay.length > 0;
                const inRange = isInDragRange(dateStr);

                // Is this day highlighted due to hover?
                const dayMediaIds = dayMediaIdsMap.get(dateStr);
                const isHighlighted = hoveredMediaIds.size > 0 && !!dayMediaIds?.some((id) => hoveredMediaIds.has(id));
                const isDimmed = hoveredMediaIds.size > 0 && hasMedia && !isHighlighted;

                // Build background using per-item parity colors
                let bgStyle: React.CSSProperties = {};
                if (inRange) {
                  bgStyle = { backgroundColor: "#a855f7" };
                } else if (hasMedia) {
                  const colors = mediaOnDay.map((item) =>
                    getItemColor(item.mediaType, itemParityMap.get(item.id) ?? false)
                  );
                  const uniqueColors = [...new Set(colors)];
                  bgStyle = uniqueColors.length === 1
                    ? { backgroundColor: uniqueColors[0] }
                    : { background: `linear-gradient(135deg, ${uniqueColors.join(", ")})` };
                }

                // Hover ring via box-shadow (no extra DOM element needed)
                if (isHighlighted && hasMedia) {
                  bgStyle = { ...bgStyle, boxShadow: "0 0 0 1.5px white, 0 0 0 2.5px rgba(0,0,0,0.35)" };
                }

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
                    style={{
                      ...bgStyle,
                      opacity: isDimmed ? 0.25 : 1,
                      transition: "opacity 0.1s, box-shadow 0.1s",
                    }}
                    onMouseDown={() => handleMouseDown(dateStr)}
                    onMouseEnter={() => handleDayMouseEnter(dateStr, mediaOnDay)}
                    onMouseLeave={handleDayMouseLeave}
                    onMouseUp={handleMouseUp}
                    className={[
                      "aspect-square flex items-center justify-center text-xs rounded-sm",
                      hasMedia || inRange ? "text-white font-medium" : "text-gray-500",
                      onDayClick ? "cursor-pointer" : "cursor-default",
                      !hasMedia && !inRange ? "hover:bg-gray-50" : "",
                    ].join(" ")}
                  >
                    {day}
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

