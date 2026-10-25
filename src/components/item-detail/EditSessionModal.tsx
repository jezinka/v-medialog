"use client";
import { useState } from "react";
import Modal from "../Modal";
import { toast } from "../Toast";
import { SCREEN_TYPES } from "@/lib/utils";
import { partNo } from "@/lib/part-number";
import type { SeasonRow, SessionApiRow } from "./types";

export default function EditSessionModal({
  session, seasons, mediaType, partLabel, hasSpecials, onClose, onSaved,
}: {
  session: SessionApiRow;
  seasons: SeasonRow[];
  mediaType: string;
  partLabel: string;
  hasSpecials: boolean;
  onClose: () => void;
  onSaved: () => Promise<void>;
}) {
  const [editStartDate, setEditStartDate] = useState(session.start_date);
  const [editEndDate, setEditEndDate] = useState(session.end_date ?? session.start_date);
  const [editCinema, setEditCinema] = useState(Boolean(session.cinema));
  const [editWithChild, setEditWithChild] = useState(Boolean(session.with_child));
  const [editSeasonId, setEditSeasonId] = useState(String(session.season_id));
  const [editEpisodeCount, setEditEpisodeCount] = useState("");
  const [editSaving, setEditSaving] = useState(false);

  const handleSave = async () => {
    if (editEndDate && editEndDate < editStartDate) {
      toast("Data końca nie może być wcześniej niż data początku", "error");
      return;
    }
    setEditSaving(true);
    try {
      const res = await fetch(`/api/sessions/${session.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          start_date: editStartDate,
          end_date: editEndDate || null,
          cinema: editCinema,
          with_child: editWithChild,
          season_id: parseInt(editSeasonId),
        }),
      });
      if (!res.ok) throw new Error();
      toast("Sesja zapisana ✓", "success");
      onClose();
      await onSaved();
    } catch {
      toast("Błąd zapisu", "error");
    } finally {
      setEditSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm("Usunąć tę sesję?")) return;
    try {
      const res = await fetch(`/api/sessions/${session.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error();
      toast("Sesja usunięta ✓", "success");
      onClose();
      await onSaved();
    } catch {
      toast("Błąd usuwania", "error");
    }
  };

  return (
    <Modal onClose={onClose} label="Edytuj sesję" className="rounded-xl shadow-xl p-5 max-w-sm w-full space-y-4">
        <h3 className="text-sm font-semibold text-gray-900">Edytuj sesję</h3>
        <div className="space-y-3">
          <div>
            <label className="block text-xs text-gray-500 mb-1">Data rozpoczęcia</label>
            <input
              type="date"
              value={editStartDate}
              onChange={(e) => setEditStartDate(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Data zakończenia</label>
            <input
              type="date"
              value={editEndDate}
              onChange={(e) => setEditEndDate(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-sm"
            />
            <div className="flex items-center gap-2 mt-1.5">
              <span className="text-xs text-gray-400">start +</span>
              <input
                type="number"
                min="1"
                placeholder="odcinki"
                value={editEpisodeCount}
                onChange={(e) => setEditEpisodeCount(e.target.value)}
                className="w-24 border border-gray-200 rounded px-2 py-1 text-xs"
              />
              <button
                type="button"
                onClick={() => {
                  const count = parseInt(editEpisodeCount);
                  if (!editStartDate || isNaN(count) || count < 1) return;
                  const d = new Date(editStartDate);
                  d.setDate(d.getDate() + count - 1);
                  setEditEndDate(d.toISOString().slice(0, 10));
                }}
                className="px-2 py-1 text-xs bg-gray-100 hover:bg-gray-200 rounded text-gray-600 transition-colors"
              >
                Ustaw
              </button>
            </div>
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">{partLabel}</label>
            <select
              value={editSeasonId}
              onChange={(e) => setEditSeasonId(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-sm"
            >
              {seasons.map((s, idx) => (
                <option key={s.id} value={s.id}>
                  {s.title ?? (partNo(seasons, idx, hasSpecials) === "Sp." ? "Speciale" : `${partLabel} ${partNo(seasons, idx, hasSpecials)}`)}
                </option>
              ))}
            </select>
          </div>
          <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
            <input
              type="checkbox"
              checked={editCinema}
              onChange={(e) => setEditCinema(e.target.checked)}
              className="w-4 h-4"
            />
            Kino
          </label>
          {SCREEN_TYPES.includes(mediaType) && (
            <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
              <input
                type="checkbox"
                checked={editWithChild}
                onChange={(e) => setEditWithChild(e.target.checked)}
                className="w-4 h-4"
              />
              👶 Z dzieckiem
            </label>
          )}
        </div>
        <div className="flex gap-2 pt-1">
          <button
            onClick={handleSave}
            disabled={editSaving}
            className="flex-1 bg-blue-600 text-white rounded-lg py-2 text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
          >
            {editSaving ? "Zapisuję..." : "Zapisz"}
          </button>
          <button
            onClick={handleDelete}
            disabled={editSaving}
            className="px-3 py-2 bg-red-50 border border-red-200 text-red-600 rounded-lg text-sm hover:bg-red-100 disabled:opacity-50"
          >
            🗑️
          </button>
          <button
            onClick={onClose}
            className="px-3 py-2 bg-gray-100 text-gray-600 rounded-lg text-sm hover:bg-gray-200"
          >
            Anuluj
          </button>
        </div>
    </Modal>
  );
}
