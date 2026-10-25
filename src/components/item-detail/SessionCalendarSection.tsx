"use client";
import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { toast } from "../Toast";
import MonthGrid from "../MonthGrid";
import { SCREEN_TYPES, hasSeasonNumbers, MONTH_NAMES } from "@/lib/utils";
import { partNo } from "@/lib/part-number";
import { groupByYearMonth } from "@/lib/calendar-days";
import { addDaySessions } from "@/lib/session-actions";
import SeasonPickerModal from "./SeasonPickerModal";
import EditSessionModal from "./EditSessionModal";
import { partLabels } from "./part-labels";
import type { MediaData, SeasonRow, SessionApiRow } from "./types";

interface SplitTarget { sessionIds: number[]; dateRange: string }

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
  const [yearViewYear, setYearViewYear] = useState(() => new Date().getFullYear());
  const [yearSelectedDates, setYearSelectedDates] = useState<Set<string>>(new Set());
  const [yearBatchSaving, setYearBatchSaving] = useState(false);
  const [yearBatchCinema, setYearBatchCinema] = useState(false);
  const [yearBatchWithChild, setYearBatchWithChild] = useState(false);

  // ── Split-into-seasons mode ─────────────────────────────────────────────────
  const [splitMode, setSplitMode] = useState(false);
  const [splitRangeStart, setSplitRangeStart] = useState<string | null>(null);
  const [splitRangeEnd, setSplitRangeEnd] = useState<string | null>(null);
  // When range is confirmed, show assignment dialog
  const [splitTarget, setSplitTarget] = useState<SplitTarget | null>(null);
  const [splitSeasonChoice, setSplitSeasonChoice] = useState<"existing" | "new">("new");
  const [splitExistingSeasonId, setSplitExistingSeasonId] = useState("");
  const [splitNewSeasonNumber, setSplitNewSeasonNumber] = useState("");
  const [splitNewSeasonTitle, setSplitNewSeasonTitle] = useState("");
  const [splitSaving, setSplitSaving] = useState(false);

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

  // When only placeholders are present, jump yearViewYear to the placeholder's year.
  useEffect(() => {
    if (isOnlyPlaceholders) {
      setYearViewYear(parseInt(sessions[0].start_date.slice(0, 4)));
    }
  }, [isOnlyPlaceholders, sessions]);

  const handleYearBatchCreate = useCallback(async () => {
    if (yearSelectedDates.size === 0) return;
    setYearBatchSaving(true);
    try {
      let seasonId: number;
      if (seasons.length === 0) {
        const noSeasonNumber = !hasSeasonNumbers(media.media_type);
        const res = await fetch("/api/seasons", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ media_id: media.id, season_number: noSeasonNumber ? null : 1, title: null }),
        });
        if (!res.ok) throw new Error("Failed to create season");
        const data = await res.json() as { id: number };
        seasonId = data.id;
        await loadData();
      } else {
        seasonId = seasons[0].id;
      }
      const dates = Array.from(yearSelectedDates).sort();
      const added = await addDaySessions(seasonId, dates, { cinema: yearBatchCinema, withChild: yearBatchWithChild });
      toast(added > 0 ? `Dodano ${added} sesji ✓` : "Błąd zapisu sesji", added > 0 ? "success" : "error");
      setYearSelectedDates(new Set());
      await onChanged();
    } catch {
      toast("Błąd zapisu sesji", "error");
    } finally {
      setYearBatchSaving(false);
    }
  }, [yearSelectedDates, seasons, media, loadData, onChanged, yearBatchCinema, yearBatchWithChild]);

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
          const noSeasonNumber = !hasSeasonNumbers(media.media_type);
          const r = await fetch("/api/seasons", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ media_id: media.id, season_number: noSeasonNumber ? null : 1, title: null }),
          });
          if (!r.ok) { toast("Błąd tworzenia sezonu", "error"); return; }
          const newSeason = await r.json() as { id: number };
          addSession(date, newSeason.id);
        } catch {
          toast("Błąd tworzenia sezonu", "error");
        }
        return;
      }
      setSeasonPickerDate(date);
    },
    [splitMode, splitRangeStart, splitTarget, sessions, sessionDaysMap, dateToSessionMap, seasons, addSession, media]
  );

  const handleSplitDayHover = (date: string) => {
    if (splitMode && splitRangeStart && !splitTarget) setSplitRangeEnd(date);
  };

  const handleSplitAssign = async () => {
    if (!splitTarget) return;
    setSplitSaving(true);
    try {
      const body: Record<string, unknown> = { session_ids: splitTarget.sessionIds };
      if (splitSeasonChoice === "existing" && splitExistingSeasonId) {
        body.target_season_id = parseInt(splitExistingSeasonId);
      } else {
        body.new_season = {
          media_id: media.id,
          season_number: splitNewSeasonNumber ? parseInt(splitNewSeasonNumber) : undefined,
          title: splitNewSeasonTitle || undefined,
        };
      }
      const res = await fetch("/api/sessions/reassign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error();
      toast("Przeniesiono sesje ✓", "success");
      setSplitTarget(null); setSplitRangeStart(null); setSplitRangeEnd(null);
      setSplitNewSeasonNumber(""); setSplitNewSeasonTitle(""); setSplitExistingSeasonId("");
      await onChanged();
    } catch {
      toast("Błąd przenoszenia", "error");
    } finally {
      setSplitSaving(false);
    }
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
        <div className="mb-4 border border-amber-300 rounded-lg p-4 bg-amber-50 space-y-3">
          <p className="text-sm font-medium text-amber-800">
            Przypisz {splitTarget.sessionIds.length} sesji ({splitTarget.dateRange}) do {partLabel.toLowerCase()}:
          </p>
          <div className="flex gap-4">
            <label className="flex items-center gap-1 text-sm text-gray-700 cursor-pointer">
              <input type="radio" name="splitChoice" value="new" checked={splitSeasonChoice === "new"} onChange={() => setSplitSeasonChoice("new")} />
              Nowa {partLabel.toLowerCase()}
            </label>
            <label className="flex items-center gap-1 text-sm text-gray-700 cursor-pointer">
              <input type="radio" name="splitChoice" value="existing" checked={splitSeasonChoice === "existing"} onChange={() => setSplitSeasonChoice("existing")} />
              Istniejąca {partLabel.toLowerCase()}
            </label>
          </div>
          {splitSeasonChoice === "new" && (
            <div className="flex gap-2">
              <input
                type="number" placeholder={`Nr ${partLabel.toLowerCase()}`} value={splitNewSeasonNumber}
                onChange={(e) => setSplitNewSeasonNumber(e.target.value)}
                className="w-28 text-sm border border-gray-300 rounded px-2 py-1"
              />
              <input
                type="text" placeholder="Tytuł (opcjonalny)" value={splitNewSeasonTitle}
                onChange={(e) => setSplitNewSeasonTitle(e.target.value)}
                className="flex-1 text-sm border border-gray-300 rounded px-2 py-1"
              />
            </div>
          )}
          {splitSeasonChoice === "existing" && (
            <select
              value={splitExistingSeasonId} onChange={(e) => setSplitExistingSeasonId(e.target.value)}
              className="w-full text-sm border border-gray-300 rounded px-2 py-1"
            >
              <option value="">— wybierz {partLabel.toLowerCase()} —</option>
              {seasons.map((s, idx) => (
                <option key={s.id} value={s.id}>
                  {s.title ?? (partNo(seasons, idx, hasSpecials) === "Sp." ? "Speciale" : `${partLabel} ${partNo(seasons, idx, hasSpecials)}`)}
                </option>
              ))}
            </select>
          )}
          <div className="flex gap-2">
            <button
              onClick={handleSplitAssign} disabled={splitSaving}
              className="text-sm bg-amber-600 text-white px-4 py-1.5 rounded hover:bg-amber-700 disabled:opacity-50"
            >
              {splitSaving ? "Zapisuję..." : "Przypisz"}
            </button>
            <button
              onClick={() => { setSplitTarget(null); setSplitRangeStart(null); setSplitRangeEnd(null); }}
              className="text-sm border border-gray-300 px-4 py-1.5 rounded hover:bg-gray-50"
            >
              Anuluj
            </button>
          </div>
        </div>
      )}
      {sessions.length === 0 || isOnlyPlaceholders ? (
        <div className="space-y-4">
          {/* Year navigation */}
          <div className="flex items-center gap-3">
            <button
              onClick={() => setYearViewYear((y) => y - 1)}
              className="w-7 h-7 flex items-center justify-center rounded-full hover:bg-gray-100 text-gray-600 font-bold"
            >
              ‹
            </button>
            <span className="text-sm font-semibold text-gray-800 min-w-[3rem] text-center">{yearViewYear}</span>
            <button
              onClick={() => setYearViewYear((y) => y + 1)}
              className="w-7 h-7 flex items-center justify-center rounded-full hover:bg-gray-100 text-gray-600 font-bold"
            >
              ›
            </button>
            {yearSelectedDates.size > 0 && (
              <label className="flex items-center gap-1.5 cursor-pointer select-none ml-2">
                <input
                  type="checkbox"
                  checked={yearBatchCinema}
                  onChange={(e) => setYearBatchCinema(e.target.checked)}
                  className="w-4 h-4 accent-yellow-500"
                />
                <span className="text-xs text-gray-700">🎟️ kino</span>
              </label>
            )}
            {yearSelectedDates.size > 0 && SCREEN_TYPES.includes(media.media_type) && (
              <label className="flex items-center gap-1.5 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={yearBatchWithChild}
                  onChange={(e) => setYearBatchWithChild(e.target.checked)}
                  className="w-4 h-4 accent-emerald-500"
                />
                <span className="text-xs text-gray-700">👶 z dzieckiem</span>
              </label>
            )}
            {yearSelectedDates.size > 0 && (
              <button
                onClick={handleYearBatchCreate}
                disabled={yearBatchSaving}
                className="ml-2 text-xs bg-blue-600 text-white px-3 py-1.5 rounded-lg hover:bg-blue-700 disabled:opacity-50"
              >
                {yearBatchSaving ? "Zapisuję..." : `Utwórz ${yearSelectedDates.size} sesj${yearSelectedDates.size === 1 ? "ę" : "e"}`}
              </button>
            )}
            {yearSelectedDates.size > 0 && (
              <button
                onClick={() => setYearSelectedDates(new Set())}
                className="text-xs text-gray-400 hover:text-gray-600"
              >
                Wyczyść
              </button>
            )}
          </div>
          <div className="grid grid-cols-3 gap-x-6 gap-y-6">
            {MONTH_NAMES.map((name, i) => (
              <MonthGrid
                key={name}
                year={yearViewYear}
                month={i + 1}
                label={name}
                days={sessionDaysMap}
                selected={yearSelectedDates}
                onDayClick={(date) =>
                  setYearSelectedDates((prev) => {
                    const next = new Set(prev);
                    if (next.has(date)) next.delete(date); else next.add(date);
                    return next;
                  })
                }
              />
            ))}
          </div>
        </div>
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
