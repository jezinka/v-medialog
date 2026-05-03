"use client";

import { useEffect, useRef, useState } from "react";
import CoverImg from "./CoverImg";

interface MediaItem {
  id: number;
  title: string;
  original_title: string | null;
  media_type: string;
  cover_url: string | null;
  season_count?: number;
  first_session_date?: string | null;
}

interface Props {
  onClose: () => void;
  onSuccess: () => void;
}

export default function MergeMediaModal({ onClose, onSuccess }: Props) {
  const [allMedia, setAllMedia] = useState<MediaItem[]>([]);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [targetId, setTargetId] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setLoading(true);
    fetch("/api/media?all=true")
      .then((r) => r.json())
      .then((data: MediaItem[]) => setAllMedia(data))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    searchRef.current?.focus();
  }, []);

  const filtered = allMedia.filter((m) => {
    const q = search.toLowerCase();
    return (
      m.title.toLowerCase().includes(q) ||
      (m.original_title?.toLowerCase().includes(q) ?? false)
    );
  });

  const toggleSelect = (id: number) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
        if (targetId === id) setTargetId(null);
      } else {
        next.add(id);
        if (!targetId) setTargetId(id);
      }
      return next;
    });
  };

  const handleMerge = async () => {
    if (!targetId || selected.size < 2) return;
    const source_ids = [...selected].filter((id) => id !== targetId);
    setSaving(true);
    try {
      const res = await fetch("/api/media/merge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ target_media_id: targetId, source_ids }),
      });
      if (!res.ok) throw new Error(await res.text());
      const { merged } = await res.json();
      alert(`Połączono ${merged} pozycji pod medium #${targetId}`);
      onSuccess();
      onClose();
    } catch (err) {
      alert("Błąd: " + (err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const targetMedia = allMedia.find((m) => m.id === targetId);

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
          <div>
            <h2 className="text-base font-semibold text-gray-900">Połącz tomy / odcinki</h2>
            <p className="text-xs text-gray-400 mt-0.5">
              Zaznacz pozycje → wybierz główne medium → Połącz
            </p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-lg leading-none">✕</button>
        </div>

        {/* Search */}
        <div className="px-4 py-3 border-b border-gray-100">
          <input
            ref={searchRef}
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Szukaj po tytule..."
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-200 focus:outline-none"
          />
        </div>

        {/* Selected summary */}
        {selected.size > 0 && (
          <div className="px-4 py-2 bg-blue-50 border-b border-blue-100 text-xs text-blue-700 flex items-center gap-2 flex-wrap">
            <span className="font-medium">{selected.size} zaznaczonych</span>
            {targetMedia && (
              <>
                <span>•</span>
                <span>Główne: <strong>{targetMedia.title}</strong></span>
              </>
            )}
            <span className="ml-auto text-blue-400">Kliknij ★ żeby zmienić główne</span>
          </div>
        )}

        {/* List */}
        <div className="overflow-y-auto flex-1 divide-y divide-gray-50">
          {loading && (
            <p className="text-center text-sm text-gray-400 py-8">Wczytywanie...</p>
          )}
          {!loading && filtered.length === 0 && (
            <p className="text-center text-sm text-gray-400 py-8">Brak wyników</p>
          )}
          {filtered.map((m) => {
            const isSelected = selected.has(m.id);
            const isTarget = targetId === m.id;
            return (
              <div
                key={m.id}
                onClick={() => toggleSelect(m.id)}
                className={`flex items-center gap-3 px-4 py-2.5 cursor-pointer transition-colors ${
                  isSelected ? "bg-blue-50 hover:bg-blue-100" : "hover:bg-gray-50"
                }`}
              >
                {/* Cover */}
                <div className="relative w-8 h-12 shrink-0 rounded overflow-hidden bg-gray-100">
                  {m.cover_url ? (
                    <CoverImg src={m.cover_url} alt={m.title} fill className="object-cover" sizes="32px" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-gray-300 text-lg">📖</div>
                  )}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-800 truncate">{m.title}</p>
                  {m.original_title && m.original_title !== m.title && (
                    <p className="text-xs text-gray-400 truncate">{m.original_title}</p>
                  )}
                  <p className="text-[10px] text-gray-400">
                    {m.season_count ?? 0} sez. · {m.first_session_date?.slice(0, 4) ?? "—"}
                  </p>
                </div>

                {/* Checkbox + star */}
                <div className="flex items-center gap-2 shrink-0">
                  {isSelected && (
                    <button
                      onClick={(e) => { e.stopPropagation(); setTargetId(m.id); }}
                      title="Ustaw jako główne medium"
                      className={`text-base ${isTarget ? "text-yellow-400" : "text-gray-300 hover:text-yellow-300"}`}
                    >
                      ★
                    </button>
                  )}
                  <div className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${
                    isSelected ? "border-blue-500 bg-blue-500" : "border-gray-300"
                  }`}>
                    {isSelected && <span className="text-white text-xs leading-none">✓</span>}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Footer */}
        <div className="px-5 py-4 border-t border-gray-100 flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 border border-gray-200 text-gray-600 py-2.5 rounded-xl text-sm hover:bg-gray-50 transition-colors"
          >
            Anuluj
          </button>
          <button
            onClick={handleMerge}
            disabled={saving || selected.size < 2 || !targetId}
            className="flex-1 bg-gray-900 text-white py-2.5 rounded-xl text-sm font-medium hover:bg-gray-700 transition-colors disabled:opacity-40"
          >
            {saving ? "Łączenie..." : `Połącz ${selected.size > 0 ? `(${selected.size})` : ""}`}
          </button>
        </div>
      </div>
    </div>
  );
}
