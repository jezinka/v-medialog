"use client";
import { useState } from "react";
import Image from "next/image";
import { toast } from "../Toast";
import { formatDate, CALENDAR_TYPES, hasSeasonNumbers } from "@/lib/utils";
import { partNo, seasonLabel } from "@/lib/part-number";
import { SEASON_COLORS } from "@/lib/calendar-days";
import { partLabels } from "./part-labels";
import type { MediaData, SeasonRow } from "./types";

/**
 * Seasons / parts as a cover grid (or one action row for a single unnumbered movie or book),
 * with per-part actions and a form for a new part.
 */
export default function SeasonsSection({ media, seasons, onEditSeason, onChanged, onWantToWatchChanged }: {
  media: MediaData;
  seasons: SeasonRow[];
  onEditSeason: (season: SeasonRow) => void;
  onChanged: () => Promise<void>;
  onWantToWatchChanged: () => Promise<void>;
}) {
  const { isBook, hasSpecials, partLabel, partsLabel, newPartLabel } = partLabels(media.media_type);
  const [showAddSeason, setShowAddSeason] = useState(false);
  const [selectedPartId, setSelectedPartId] = useState<number | null>(null);
  const [addSeasonForm, setAddSeasonForm] = useState({ season_number: "", title: "" });
  const [addSeasonLoading, setAddSeasonLoading] = useState(false);

  const handleAddSeason = async () => {
    setAddSeasonLoading(true);
    try {
      const res = await fetch("/api/seasons", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          media_id: media.id,
          season_number: addSeasonForm.season_number ? parseInt(addSeasonForm.season_number) : null,
          title: addSeasonForm.title || null,
        }),
      });
      if (!res.ok) throw new Error();
      toast("Sezon dodany ✓", "success");
      setShowAddSeason(false);
      setAddSeasonForm({ season_number: "", title: "" });
      await onChanged();
    } catch {
      toast("Błąd dodawania sezonu", "error");
    } finally {
      setAddSeasonLoading(false);
    }
  };

  const handleMergeSeason = async (seasonId: number) => {
    const res = await fetch(`/api/seasons/${seasonId}/merge-sessions`, { method: "POST" });
    if (res.ok) {
      const data = await res.json() as { merged: number };
      toast(data.merged > 0 ? `Scalono ${data.merged} sesji ✓` : "Brak sesji do scalenia", data.merged > 0 ? "success" : "error");
      if (data.merged > 0) await onChanged();
    } else {
      toast("Błąd scalania", "error");
    }
  };

  const handleDeleteSeason = async (seasonId: number) => {
    if (!confirm("Usunąć sezon wraz z wszystkimi sesjami?")) return;
    const res = await fetch(`/api/seasons/${seasonId}`, { method: "DELETE" });
    if (res.ok) {
      toast("Sezon usunięty ✓", "success");
      await onChanged();
    } else {
      toast("Błąd usuwania", "error");
    }
  };

  const handleToggleWantToWatch = async (season: SeasonRow) => {
    const newValue = !season.want_to_watch;
    try {
      const res = await fetch(`/api/seasons/${season.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          season_number: season.season_number,
          title: season.title,
          cover_url: season.cover_url,
          want_to_watch: newValue,
        }),
      });
      if (!res.ok) throw new Error();
      await onWantToWatchChanged();
    } catch {
      toast("Błąd zapisu", "error");
    }
  };

  const removePlaceholders = async (seasonId: number): Promise<number> => {
    try {
      const res = await fetch(`/api/seasons/${seasonId}/placeholders`, { method: "DELETE" });
      const data = await res.json() as { removed?: number };
      return data.removed ?? 0;
    } catch { return 0; }
  };

  // Per-part controls shared by the single-book row and the parts cover grid
  const seasonControls = (s: SeasonRow) => (
    <>
      <span className="text-xs text-gray-500 shrink-0">{s.session_count} sesji</span>
      {CALENDAR_TYPES.includes(media.media_type) && (
        <label className="flex items-center gap-1 cursor-pointer select-none shrink-0">
          <input
            type="checkbox"
            checked={Boolean(s.want_to_watch)}
            onChange={() => handleToggleWantToWatch(s)}
            className="w-3.5 h-3.5 accent-blue-500"
          />
          <span className="text-xs text-blue-600">{isBook ? "📖 Chcę przeczytać" : "👁 Chcę obejrzeć"}</span>
        </label>
      )}
      <button
        onClick={() => onEditSeason(s)}
        title={`Edytuj ${partLabel.toLowerCase()}`}
        className="text-xs text-gray-400 hover:text-gray-700 px-1.5 py-0.5 rounded hover:bg-gray-200"
      >
        ✏️
      </button>
      <button
        onClick={async () => {
          const removed = await removePlaceholders(s.id);
          if (removed > 0) {
            toast(`Usunięto ${removed} placeholder${removed > 1 ? "y" : ""} ✓`, "success");
            await onChanged();
          } else {
            toast("Brak placeholderów", "info");
          }
        }}
        title="Usuń sesje-placeholder (YYYY-01-01 → YYYY-12-31)"
        className="text-xs text-amber-500 hover:text-amber-700 px-1.5 py-0.5 rounded hover:bg-amber-50"
      >
        🗑📅
      </button>
      <button
        onClick={() => handleMergeSeason(s.id)}
        title="Scal sąsiednie sesje w jedną"
        className="text-xs text-blue-600 hover:text-blue-800 px-1.5 py-0.5 rounded hover:bg-blue-50"
      >
        🔀
      </button>
      <button
        onClick={() => handleDeleteSeason(s.id)}
        title={`Usuń ${partLabel.toLowerCase()}`}
        className="text-xs text-red-400 hover:text-red-600 px-1.5 py-0.5 rounded hover:bg-red-50"
      >
        🗑️
      </button>
    </>
  );

  if (seasons.length === 0) return null;
  return (
    <div>
      {!hasSeasonNumbers(media.media_type) && seasons.length === 1 && !seasons[0].cover_url ? (
        // A single movie/book needs no parts list; re-watches are just more sessions in the calendar
        <div className="flex flex-wrap items-center justify-end gap-3">
          {seasonControls(seasons[0])}
        </div>
      ) : (
        <>
          <h3 className="text-sm font-semibold text-gray-800 mb-3">{partsLabel}</h3>
          {/* Parts as a compact cover grid; click one for its dates and actions */}
          <div className="grid grid-cols-6 sm:grid-cols-8 md:grid-cols-10 gap-2">
            {seasons.map((s, idx) => (
              <button
                key={s.id}
                onClick={() => setSelectedPartId((id) => (id === s.id ? null : s.id))}
                title={`${seasonLabel(s, partNo(seasons, idx, hasSpecials), partLabel)} · ${s.session_count} sesji`}
                aria-label={`${seasonLabel(s, partNo(seasons, idx, hasSpecials), partLabel)} · ${s.session_count} sesji${
                  s.want_to_watch ? (isBook ? " · chcę przeczytać" : " · chcę obejrzeć") : ""
                }${s.session_count === 0 ? (isBook ? " · nieprzeczytana" : " · nieobejrzany") : ""}`}
                aria-pressed={selectedPartId === s.id}
                className={`group text-left rounded-md transition-shadow ${
                  selectedPartId === s.id ? "ring-2 ring-blue-500 ring-offset-1" : "hover:ring-2 hover:ring-gray-300"
                }`}
              >
                <div className="relative aspect-[2/3] rounded-md overflow-hidden bg-gray-100">
                  {s.cover_url ? (
                    <Image unoptimized src={s.cover_url} alt="" fill className="object-cover" />
                  ) : (
                    <div className={`absolute inset-0 flex items-center justify-center text-white text-sm font-semibold ${SEASON_COLORS[idx % SEASON_COLORS.length]}`} aria-hidden="true">
                      {partNo(seasons, idx, hasSpecials)}
                    </div>
                  )}
                  {s.want_to_watch ? (
                    <span className="absolute top-0.5 right-0.5 text-[10px] leading-none bg-white/90 rounded px-0.5" title={isBook ? "Chcę przeczytać" : "Chcę obejrzeć"}>{isBook ? "📖" : "👁"}</span>
                  ) : null}
                  {s.session_count === 0 && (
                    <div className="absolute inset-0 bg-white/50" title={isBook ? "Nieprzeczytana" : "Nieobejrzany"} />
                  )}
                </div>
                <p className="text-[11px] text-gray-600 text-center mt-0.5 truncate">{partNo(seasons, idx, hasSpecials)}</p>
              </button>
            ))}
          </div>
          {(() => {
            const sel = seasons.find((s) => s.id === selectedPartId);
            if (!sel) return null;
            const idx = seasons.indexOf(sel);
            return (
              <div className="mt-3 flex flex-wrap items-center gap-3 p-3 rounded-lg bg-gray-50 border border-gray-100">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-800 truncate">{seasonLabel(sel, partNo(seasons, idx, hasSpecials), partLabel)}</p>
                  {(sel.first_session_date || sel.last_session_date) && (
                    <p className="text-xs text-gray-400 mt-0.5">
                      {sel.first_session_date ? formatDate(sel.first_session_date) : "?"} –{" "}
                      {sel.last_session_date ? formatDate(sel.last_session_date) : "?"}
                    </p>
                  )}
                </div>
                {seasonControls(sel)}
              </div>
            );
          })()}
        </>
      )}

      {/* Add season */}
      {!showAddSeason ? (
        <button
          onClick={() => {
            const nextNum = seasons.length > 0 ? Math.max(...seasons.map((s) => s.season_number ?? 0)) + 1 : 1;
            setAddSeasonForm({ season_number: String(nextNum), title: "" });
            setShowAddSeason(true);
          }}
          className="mt-2 text-xs text-blue-600 hover:text-blue-800 flex items-center gap-1"
        >
          + {newPartLabel}
        </button>
      ) : (
        <div className="mt-3 border border-gray-200 rounded-lg p-3 bg-gray-50 space-y-2">
          <p className="text-xs font-semibold text-gray-700">{newPartLabel}</p>
          <div className="flex gap-2">
            <div className="w-20">
              <label className="label">Numer</label>
              <input
                type="number"
                value={addSeasonForm.season_number}
                onChange={(e) => setAddSeasonForm((f) => ({ ...f, season_number: e.target.value }))}
                className="input w-full px-2 py-1 text-sm"
              />
            </div>
            <div className="flex-1">
              <label className="label">Tytuł (opcjonalnie)</label>
              <input
                type="text"
                value={addSeasonForm.title}
                onChange={(e) => setAddSeasonForm((f) => ({ ...f, title: e.target.value }))}
                placeholder="np. Część 1"
                className="input w-full px-2 py-1 text-sm"
              />
            </div>
          </div>
          <div className="flex gap-2 justify-end">
            <button
              onClick={() => setShowAddSeason(false)}
              className="text-xs px-3 py-1.5 rounded border border-gray-300 text-gray-600 hover:bg-gray-100"
            >
              Anuluj
            </button>
            <button
              onClick={handleAddSeason}
              disabled={addSeasonLoading}
              className="btn-primary text-xs px-3 py-1.5"
            >
              {addSeasonLoading ? "Zapisuję..." : `Dodaj ${partLabel.toLowerCase()}`}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
