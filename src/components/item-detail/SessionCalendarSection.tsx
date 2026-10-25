"use client";
import { useCallback, useMemo, useState, type ReactNode } from "react";
import { toast } from "../Toast";
import MonthGrid from "../MonthGrid";
import { hasSeasonNumbers, MONTH_NAMES } from "@/lib/utils";
import { groupByYearMonth } from "@/lib/calendar-days";
import { createDefaultSeason } from "@/lib/session-actions";
import SeasonPickerModal from "./SeasonPickerModal";
import EditSessionModal from "./EditSessionModal";
import YearPickerView from "./YearPickerView";
import SplitAssignForm, { type SplitTarget } from "./SplitAssignForm";
import { partLabels } from "./part-labels";
import type { MediaData, SeasonRow, SessionApiRow } from "./types";

/**
 * Watch / reading history as month calendars. A click on an empty day adds a session (picking the season),
 * on a session day edits it; split mode reassigns a date range of sessions to another season.
 * With no real sessions it shows a whole year where days can be selected and added in one go.
 * `actions` go next to the split button, `children` under the header.
 */
export default function SessionCalendarSection({
  media, sessions, seasons, sessionDaysMap, loadData, onChanged, actions, children,
}: {
  media: MediaData;
  sessions: SessionApiRow[];
  seasons: SeasonRow[];
  sessionDaysMap: Map<string, string>;
  loadData: () => Promise<void>;
  onChanged: () => Promise<void>;
  actions?: ReactNode;
  children?: ReactNode;
}) {
  const { isBook, hasSpecials, partLabel, partsLabel, historyLabel } = partLabels(media.media_type);
  const [seasonPickerDate, setSeasonPickerDate] = useState<string | null>(null);
  const [addingSession, setAddingSession] = useState(false);
  const [editingSession, setEditingSession] = useState<SessionApiRow | null>(null);
  const [extraMonths, setExtraMonths] = useState<Set<string>>(new Set());
  // ── Split-into-seasons mode ─────────────────────────────────────────────────
  const [splitMode, setSplitMode] = useState(false);
  const [splitRangeStart, setSplitRangeStart] = useState<string | null>(null);
  const [splitRangeEnd, setSplitRangeEnd] = useState<string | null>(null);
  // When range is confirmed, show assignment dialog
  const [splitTarget, setSplitTarget] = useState<SplitTarget | null>(null);
  const addSession = useCallback(
    async (date: string, seasonId: number, flags = { cinema: false, withChild: false }) => {
      setAddingSession(true);
      try {
        const res = await fetch("/api/sessions", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            season_id: seasonId,
            start_date: date,
            end_date: date,
            cinema: flags.cinema,
            with_child: flags.withChild,
          }),
        });
        if (!res.ok) throw new Error();
        toast("Dodano sesję ✓", "success");
        await onChanged();
      } catch {
        toast("Błąd zapisu sesji", "error");
      } finally {
        setAddingSession(false);
        setSeasonPickerDate(null);
      }
    },
    [onChanged]
  );

  /** True when every session is a year-long placeholder (YYYY-01-01 → YYYY-12-31). */
  const isOnlyPlaceholders = useMemo(
    () =>
      sessions.length > 0 &&
      sessions.every(
        (s) =>
          s.start_date.endsWith("-01-01") &&
          s.end_date === `${s.start_date.slice(0, 4)}-12-31`
      ),
    [sessions]
  );

  // Map each calendar date to the session it belongs to (for click-to-edit)
  const dateToSessionMap = useMemo(() => {
    const m = new Map<string, SessionApiRow>();
    for (const session of sessions) {
      const start = new Date(session.start_date);
      const end = session.end_date ? new Date(session.end_date) : new Date(session.start_date);
      const spanDays = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;
      if (spanDays >= 365) continue;
      const cur = new Date(start);
      while (cur <= end) {
        const dateStr = cur.toISOString().slice(0, 10);
        if (!m.has(dateStr)) m.set(dateStr, session);
        cur.setDate(cur.getDate() + 1);
      }
    }
    return m;
  }, [sessions]);

  const handleDayClick = useCallback(
    async (date: string) => {
      // In split mode: select range
      if (splitMode) {
        if (!splitRangeStart) {
          setSplitRangeStart(date);
          setSplitRangeEnd(date);
        } else if (!splitTarget) {
          const start = splitRangeStart <= date ? splitRangeStart : date;
          const end = splitRangeStart <= date ? date : splitRangeStart;
          // Find sessions whose start_date falls in [start, end]
          const inRange = sessions.filter((s) => {
            const sessionEnd = s.end_date ?? s.start_date;
            return s.start_date <= end && sessionEnd >= start;
          });
          if (inRange.length === 0) {
            toast("Brak sesji w tym zakresie", "error");
            setSplitRangeStart(null); setSplitRangeEnd(null);
            return;
          }
          setSplitTarget({ sessionIds: inRange.map((s) => s.id), dateRange: `${start} – ${end}` });
        }
        return;
      }

      if (sessionDaysMap.has(date)) {
        // Open edit for the session that covers this date
        const session = dateToSessionMap.get(date);
        if (session) setEditingSession(session);
        return;
      }
      if (seasons.length === 0) {
        // Auto-create default season then add session
        try {
          const seasonId = await createDefaultSeason(media.id, hasSeasonNumbers(media.media_type) ? 1 : null);
          addSession(date, seasonId);
        } catch {
          toast("Błąd tworzenia sezonu", "error");
        }
        return;
      }
      setSeasonPickerDate(date);
    },
    [splitMode, splitRangeStart, splitTarget, sessions, sessionDaysMap, dateToSessionMap, seasons, addSession, media]
  );

  const cancelSplitRange = () => { setSplitTarget(null); setSplitRangeStart(null); setSplitRangeEnd(null); };

  const handleSplitDayHover = (date: string) => {
    if (splitMode && splitRangeStart && !splitTarget) setSplitRangeEnd(date);
  };

  // Build a special sessionDaysMap for split mode that highlights the hover range
  const splitHighlightMap = useMemo(() => {
    if (!splitMode || !splitRangeStart) return null;
    const end = splitRangeEnd ?? splitRangeStart;
    const [a, b] = splitRangeStart <= end ? [splitRangeStart, end] : [end, splitRangeStart];
    const m = new Map<string, string>();
    const cur = new Date(a);
    const endDate = new Date(b);
    while (cur <= endDate) {
      m.set(cur.toISOString().slice(0, 10), "bg-amber-400");
      cur.setDate(cur.getDate() + 1);
    }
    return m;
  }, [splitMode, splitRangeStart, splitRangeEnd]);

  // Merge base map with split highlight
  const displayDaysMap = useMemo(() => {
    if (!splitHighlightMap) return sessionDaysMap;
    const merged = new Map(sessionDaysMap);
    for (const [d, c] of splitHighlightMap) merged.set(d, c);
    return merged;
  }, [sessionDaysMap, splitHighlightMap]);

  const grouped = useMemo(() => groupByYearMonth(displayDaysMap), [displayDaysMap]);
  const sortedMonths = useMemo(() => {
    const fromData = new Set(grouped.keys());
    const all = new Set([...fromData, ...extraMonths]);
    return Array.from(all).sort();
  }, [grouped, extraMonths]);

  const addMonth = (ym: string) => setExtraMonths((prev) => new Set([...prev, ym]));

  const currentYearMonth = (() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  })();

  // Month after the last session (or next calendar month if no sessions)
  const nextAfterLastSession = useMemo(() => {
    const dates = sessions
      .flatMap((s) => [s.start_date, s.end_date].filter(Boolean) as string[])
      .sort();
    const lastDate = dates.at(-1);
    const base = lastDate ? new Date(lastDate) : new Date();
    const next = new Date(base.getFullYear(), base.getMonth() + 1, 1);
    return `${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, "0")}`;
  }, [sessions]);

  return (
    <div>
      {/* Modals inside this div, not the page's space-y container, whose margin would shrink their fixed overlay */}
      {seasonPickerDate && (
        <SeasonPickerModal
          date={seasonPickerDate}
          seasons={seasons}
          mediaType={media.media_type}
          isBook={isBook}
          partLabel={partLabel}
          hasSpecials={hasSpecials}
          adding={addingSession}
          onPick={(seasonId, flags) => addSession(seasonPickerDate, seasonId, flags)}
          onClose={() => setSeasonPickerDate(null)}
        />
      )}
      {editingSession && (
        <EditSessionModal
          session={editingSession}
          seasons={seasons}
          mediaType={media.media_type}
          partLabel={partLabel}
          hasSpecials={hasSpecials}
          onClose={() => setEditingSession(null)}
          onSaved={onChanged}
        />
      )}
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-gray-800">{historyLabel}</h3>
        <div className="flex gap-2">
          <button
            onClick={() => {
              if (splitMode) {
                setSplitMode(false); setSplitRangeStart(null); setSplitRangeEnd(null); setSplitTarget(null);
              } else {
                setSplitMode(true);
              }
            }}
            className={`text-xs flex items-center gap-1 px-2 py-1 rounded border transition-colors ${
              splitMode
                ? "border-amber-400 bg-amber-50 text-amber-700"
                : "border-gray-200 text-gray-500 hover:text-gray-700 hover:bg-gray-50"
            }`}
          >
            ✂️ {splitMode ? "Anuluj podział" : `Podziel na ${partsLabel.toLowerCase()}`}
          </button>
          {actions}
        </div>
      </div>

      {children}
      {splitMode && (
        <div className="mb-3 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
          {!splitRangeStart
            ? "Kliknij dzień startowy zakresu"
            : splitTarget
            ? "Zakres wybrany — przypisz poniżej"
            : "Kliknij dzień końcowy zakresu (hover podświetla)"}
        </div>
      )}
      {/* Split assign dialog */}
      {splitTarget && (
        <SplitAssignForm
          target={splitTarget}
          mediaId={media.id}
          seasons={seasons}
          partLabel={partLabel}
          hasSpecials={hasSpecials}
          onAssigned={async () => { cancelSplitRange(); await onChanged(); }}
          onCancel={cancelSplitRange}
        />
      )}
      {sessions.length === 0 || isOnlyPlaceholders ? (
        <YearPickerView
          media={media}
          seasons={seasons}
          sessionDaysMap={sessionDaysMap}
          placeholderYear={isOnlyPlaceholders ? parseInt(sessions[0].start_date.slice(0, 4)) : null}
          loadData={loadData}
          onChanged={onChanged}
        />
      ) : (
        <div className="space-y-4">
          <div className="flex flex-wrap gap-6">
            {sortedMonths.map((key) => {
              const [y, m] = key.split("-").map(Number);
              const monthDays = grouped.get(key) ?? new Map<string, string>();
              return (
                <MonthGrid
                  key={key}
                  year={y}
                  month={m}
                  label={`${MONTH_NAMES[m - 1]} ${y}`}
                  days={monthDays}
                  onDayClick={handleDayClick}
                  onDayHover={handleSplitDayHover}
                />
              );
            })}
          </div>
          <div className="flex gap-2">
            {!sortedMonths.includes(currentYearMonth) && (
              <button
                onClick={() => addMonth(currentYearMonth)}
                className="text-xs text-blue-600 hover:text-blue-800 px-3 py-1.5 border border-blue-200 rounded-lg hover:bg-blue-50"
              >
                + Dodaj {currentYearMonth}
              </button>
            )}
            {!sortedMonths.includes(nextAfterLastSession) && (
              <button
                onClick={() => addMonth(nextAfterLastSession)}
                className="text-xs text-blue-600 hover:text-blue-800 px-3 py-1.5 border border-blue-200 rounded-lg hover:bg-blue-50"
              >
                + Dodaj {nextAfterLastSession}
              </button>
            )}
          </div>
        </div>
      )}

    </div>
  );
}
