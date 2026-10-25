"use client";
import { useState } from "react";
import Modal from "../Modal";
import CoverUrlField from "../CoverUrlField";
import { toast } from "../Toast";
import type { SeasonRow } from "./types";

export default function EditSeasonModal({ season, partLabel, onClose, onSaved }: {
  season: SeasonRow;
  partLabel: string;
  onClose: () => void;
  onSaved: () => Promise<void>;
}) {
  const [seasonEditForm, setSeasonEditForm] = useState({
    season_number: season.season_number != null ? String(season.season_number) : "",
    title: season.title ?? "",
    cover_url: season.cover_url ?? "",
  });
  const [seasonEditSaving, setSeasonEditSaving] = useState(false);
  const [uploadingSeason, setUploadingSeason] = useState(false);

  const handleSave = async () => {
    setSeasonEditSaving(true);
    try {
      const res = await fetch(`/api/seasons/${season.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          season_number: seasonEditForm.season_number ? parseInt(seasonEditForm.season_number) : null,
          title: seasonEditForm.title || null,
          cover_url: seasonEditForm.cover_url || null,
        }),
      });
      if (!res.ok) throw new Error();
      toast("Sezon zapisany ✓", "success");
      onClose();
      await onSaved();
    } catch {
      toast("Błąd zapisu sezonu", "error");
    } finally {
      setSeasonEditSaving(false);
    }
  };

  return (
    <Modal onClose={onClose} label={`Edytuj ${partLabel.toLowerCase()}`} className="rounded-xl shadow-xl p-5 max-w-sm w-full space-y-3">
        <h3 className="text-sm font-semibold text-gray-900">Edytuj {partLabel.toLowerCase()}</h3>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="text-xs font-medium text-gray-600 block mb-1">Numer {partLabel.toLowerCase()}</label>
            <input
              type="number"
              value={seasonEditForm.season_number}
              onChange={(e) => setSeasonEditForm((f) => ({ ...f, season_number: e.target.value }))}
              placeholder="np. 1"
              className="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-sm"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-gray-600 block mb-1">Tytuł {partLabel.toLowerCase()}</label>
            <input
              type="text"
              value={seasonEditForm.title}
              onChange={(e) => setSeasonEditForm((f) => ({ ...f, title: e.target.value }))}
              placeholder="opcjonalnie"
              className="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-sm"
            />
          </div>
        </div>
        <div>
          <label className="text-xs font-medium text-gray-600 block mb-1">Okładka</label>
          <CoverUrlField
            value={seasonEditForm.cover_url}
            onChange={(cover_url) => setSeasonEditForm((f) => ({ ...f, cover_url }))}
            placeholder="https://... lub wgraj →"
            uploading={uploadingSeason}
            onUploadingChange={setUploadingSeason}
          />
        </div>
        <div className="flex gap-2 pt-1">
          <button
            onClick={handleSave}
            disabled={seasonEditSaving || uploadingSeason}
            className="flex-1 bg-blue-600 text-white rounded-lg py-2 text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
          >
            {seasonEditSaving ? "Zapisuję..." : uploadingSeason ? "Wgrywanie…" : "Zapisz"}
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
