"use client";
import { useState } from "react";
import { toast } from "../Toast";
import { partNo } from "@/lib/part-number";
import type { SeasonRow } from "./types";

export interface SplitTarget { sessionIds: number[]; dateRange: string }

/** Moves the sessions picked in split mode to an existing or a new season. */
export default function SplitAssignForm({
  target, mediaId, seasons, partLabel, hasSpecials, onAssigned, onCancel,
}: {
  target: SplitTarget;
  mediaId: number;
  seasons: SeasonRow[];
  partLabel: string;
  hasSpecials: boolean;
  onAssigned: () => Promise<void>;
  onCancel: () => void;
}) {
  const [choice, setChoice] = useState<"existing" | "new">("new");
  const [existingSeasonId, setExistingSeasonId] = useState("");
  const [newSeasonNumber, setNewSeasonNumber] = useState("");
  const [newSeasonTitle, setNewSeasonTitle] = useState("");
  const [saving, setSaving] = useState(false);

  const handleAssign = async () => {
    setSaving(true);
    try {
      const body: Record<string, unknown> = { session_ids: target.sessionIds };
      if (choice === "existing" && existingSeasonId) {
        body.target_season_id = parseInt(existingSeasonId);
      } else {
        body.new_season = {
          media_id: mediaId,
          season_number: newSeasonNumber ? parseInt(newSeasonNumber) : undefined,
          title: newSeasonTitle || undefined,
        };
      }
      const res = await fetch("/api/sessions/reassign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error();
      toast("Przeniesiono sesje ✓", "success");
      await onAssigned();
    } catch {
      toast("Błąd przenoszenia", "error");
    } finally {
      setSaving(false);
    }
  };

  const part = partLabel.toLowerCase();
  return (
    <div className="mb-4 border border-amber-300 rounded-lg p-4 bg-amber-50 space-y-3">
      <p className="text-sm font-medium text-amber-800">
        Przypisz {target.sessionIds.length} sesji ({target.dateRange}) do {part}:
      </p>
      <div className="flex gap-4">
        <label className="flex items-center gap-1 text-sm text-gray-700 cursor-pointer">
          <input type="radio" name="splitChoice" value="new" checked={choice === "new"} onChange={() => setChoice("new")} />
          Nowa {part}
        </label>
        <label className="flex items-center gap-1 text-sm text-gray-700 cursor-pointer">
          <input type="radio" name="splitChoice" value="existing" checked={choice === "existing"} onChange={() => setChoice("existing")} />
          Istniejąca {part}
        </label>
      </div>
      {choice === "new" && (
        <div className="flex gap-2">
          <input
            type="number" placeholder={`Nr ${part}`} value={newSeasonNumber}
            onChange={(e) => setNewSeasonNumber(e.target.value)}
            className="w-28 text-sm border border-gray-300 rounded px-2 py-1"
          />
          <input
            type="text" placeholder="Tytuł (opcjonalny)" value={newSeasonTitle}
            onChange={(e) => setNewSeasonTitle(e.target.value)}
            className="flex-1 text-sm border border-gray-300 rounded px-2 py-1"
          />
        </div>
      )}
      {choice === "existing" && (
        <select
          value={existingSeasonId} onChange={(e) => setExistingSeasonId(e.target.value)}
          className="w-full text-sm border border-gray-300 rounded px-2 py-1"
        >
          <option value="">— wybierz {part} —</option>
          {seasons.map((s, idx) => (
            <option key={s.id} value={s.id}>
              {s.title ?? (partNo(seasons, idx, hasSpecials) === "Sp." ? "Speciale" : `${partLabel} ${partNo(seasons, idx, hasSpecials)}`)}
            </option>
          ))}
        </select>
      )}
      <div className="flex gap-2">
        <button
          onClick={handleAssign} disabled={saving}
          className="text-sm bg-amber-600 text-white px-4 py-1.5 rounded hover:bg-amber-700 disabled:opacity-50"
        >
          {saving ? "Zapisuję..." : "Przypisz"}
        </button>
        <button
          onClick={onCancel}
          className="text-sm border border-gray-300 px-4 py-1.5 rounded hover:bg-gray-50"
        >
          Anuluj
        </button>
      </div>
    </div>
  );
}
