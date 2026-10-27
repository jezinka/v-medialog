"use client";
import { useCallback, useEffect, useState } from "react";
import { toast } from "../Toast";
import MonthGrid from "../MonthGrid";
import { SCREEN_TYPES, hasSeasonNumbers, MONTH_NAMES } from "@/lib/utils";
import { addDaySessions, createDefaultSeason } from "@/lib/session-actions";
import type { MediaData, SeasonRow } from "./types";

/**
 * A whole year of month grids for media without real sessions: days are selected and added as one-day
 * sessions in one go (creating the first season if needed). Opens on `placeholderYear` when given.
 */
export default function YearPickerView({
  media, seasons, sessionDaysMap, placeholderYear, loadData, onChanged,
}: {
  media: MediaData;
  seasons: SeasonRow[];
  sessionDaysMap: Map<string, string>;
  placeholderYear: number | null;
  loadData: () => Promise<void>;
  onChanged: () => Promise<void>;
}) {
  const [year, setYear] = useState(() => new Date().getFullYear());
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);
  const [cinema, setCinema] = useState(false);
  const [withChild, setWithChild] = useState(false);

  // Jump to the placeholder's year
  useEffect(() => {
    if (placeholderYear !== null) setYear(placeholderYear);
  }, [placeholderYear]);

  const handleCreate = useCallback(async () => {
    if (selected.size === 0) return;
    setSaving(true);
    try {
      let seasonId: number;
      if (seasons.length === 0) {
        seasonId = await createDefaultSeason(media.id, hasSeasonNumbers(media.media_type) ? 1 : null);
        await loadData();
      } else {
        seasonId = seasons[0].id;
      }
      const dates = Array.from(selected).sort();
      const added = await addDaySessions(seasonId, dates, { cinema, withChild });
      toast(added > 0 ? `Dodano ${added} sesji ✓` : "Błąd zapisu sesji", added > 0 ? "success" : "error");
      setSelected(new Set());
      await onChanged();
    } catch {
      toast("Błąd zapisu sesji", "error");
    } finally {
      setSaving(false);
    }
  }, [selected, seasons, media, loadData, onChanged, cinema, withChild]);

  return (
    <div className="space-y-4">
      {/* Year navigation */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => setYear((y) => y - 1)}
          className="w-7 h-7 flex items-center justify-center rounded-full hover:bg-gray-100 text-gray-600 font-bold"
        >
          ‹
        </button>
        <span className="text-sm font-semibold text-gray-800 min-w-[3rem] text-center">{year}</span>
        <button
          onClick={() => setYear((y) => y + 1)}
          className="w-7 h-7 flex items-center justify-center rounded-full hover:bg-gray-100 text-gray-600 font-bold"
        >
          ›
        </button>
        {selected.size > 0 && (
          <label className="flex items-center gap-1.5 cursor-pointer select-none ml-2">
            <input
              type="checkbox"
              checked={cinema}
              onChange={(e) => setCinema(e.target.checked)}
              className="w-4 h-4 accent-yellow-500"
            />
            <span className="text-xs text-gray-700">🎟️ kino</span>
          </label>
        )}
        {selected.size > 0 && SCREEN_TYPES.includes(media.media_type) && (
          <label className="flex items-center gap-1.5 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={withChild}
              onChange={(e) => setWithChild(e.target.checked)}
              className="w-4 h-4 accent-emerald-500"
            />
            <span className="text-xs text-gray-700">👶 z dzieckiem</span>
          </label>
        )}
        {selected.size > 0 && (
          <button
            onClick={handleCreate}
            disabled={saving}
            className="btn-primary ml-2 text-xs px-3 py-1.5"
          >
            {saving ? "Zapisuję..." : `Utwórz ${selected.size} sesj${selected.size === 1 ? "ę" : "e"}`}
          </button>
        )}
        {selected.size > 0 && (
          <button
            onClick={() => setSelected(new Set())}
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
            year={year}
            month={i + 1}
            label={name}
            days={sessionDaysMap}
            selected={selected}
            onDayClick={(date) =>
              setSelected((prev) => {
                const next = new Set(prev);
                if (next.has(date)) next.delete(date); else next.add(date);
                return next;
              })
            }
          />
        ))}
      </div>
    </div>
  );
}
