"use client";
import { useEffect, useState } from "react";
import Image from "next/image";
import { toast } from "../Toast";
import type { MediaData } from "./types";

/** The media's universe with covers of its other members, and a panel to change it. */
export default function UniversePanel({ media, onOpenDetail, onChanged }: {
  media: MediaData;
  onOpenDetail?: (mediaId: number) => void;
  onChanged: () => Promise<void>;
}) {
  const [showUniversePanel, setShowUniversePanel] = useState(false);
  const [universesList, setUniversesList] = useState<{ id: number; name: string }[]>([]);
  const [universeSearch, setUniverseSearch] = useState("");
  const [newUniverseName, setNewUniverseName] = useState("");
  const [savingUniverse, setSavingUniverse] = useState(false);
  const [universeMembers, setUniverseMembers] = useState<{ id: number; title: string; cover_url: string | null; media_type: string }[]>([]);

  useEffect(() => {
    if (!media.universe_id) { setUniverseMembers([]); return; }
    fetch(`/api/universes/${media.universe_id}`)
      .then((r) => r.ok ? r.json() : null)
      .then((data) => { if (data?.media) setUniverseMembers(data.media); });
  }, [media.universe_id]);

  const loadUniverses = async () => {
    const res = await fetch("/api/universes");
    if (res.ok) setUniversesList(await res.json());
  };

  const handleAssignUniverse = async (universeId: number | null) => {
    setSavingUniverse(true);
    try {
      const res = await fetch(`/api/media/${media.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ universe_id: universeId }),
      });
      if (!res.ok) throw new Error();
      toast(universeId ? "Przypisano do uniwersum ✓" : "Usunięto z uniwersum ✓", "success");
      setShowUniversePanel(false);
      setUniverseSearch("");
      setNewUniverseName("");
      await onChanged();
    } catch {
      toast("Błąd zapisu", "error");
    } finally {
      setSavingUniverse(false);
    }
  };

  const handleCreateAndAssignUniverse = async () => {
    if (!newUniverseName.trim()) return;
    setSavingUniverse(true);
    try {
      const res = await fetch("/api/universes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newUniverseName.trim() }),
      });
      if (!res.ok) throw new Error();
      const created = await res.json() as { id: number };
      await handleAssignUniverse(created.id);
    } catch {
      toast("Błąd tworzenia uniwersum", "error");
      setSavingUniverse(false);
    }
  };

  return (
    <>
      {/* Universe */}
      <div className="pt-1">
        {media.universe_name ? (
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-500">🌐 <span className="font-medium text-gray-700">{media.universe_name}</span></span>
              <button
                onClick={() => { setShowUniversePanel(true); loadUniverses(); }}
                className="text-[11px] text-gray-400 hover:text-gray-600 underline"
              >
                zmień
              </button>
            </div>
            {universeMembers.filter((m) => m.id !== media.id).length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {universeMembers
                  .filter((m) => m.id !== media.id)
                  .map((m) => (
                    <button
                      key={m.id}
                      onClick={() => onOpenDetail?.(m.id)}
                      title={m.title}
                      className="group relative w-9 h-[54px] rounded overflow-hidden border border-gray-200 hover:border-gray-400 transition-colors shrink-0"
                    >
                      {m.cover_url ? (
                        <Image unoptimized src={m.cover_url} alt={m.title} fill className="object-cover" />
                      ) : (
                        <div className="w-full h-full bg-gray-100 flex items-center justify-center text-[9px] text-gray-400 text-center px-0.5 leading-tight">
                          {m.title.slice(0, 12)}
                        </div>
                      )}
                    </button>
                  ))}
              </div>
            )}
          </div>
        ) : (
          <button
            onClick={() => { setShowUniversePanel(true); loadUniverses(); }}
            className="text-xs text-gray-400 hover:text-gray-600 border border-dashed border-gray-300 hover:border-gray-400 rounded px-2 py-0.5 transition-colors"
          >
            + Dodaj do uniwersum
          </button>
        )}
      </div>

      {/* Universe assignment panel */}
      {showUniversePanel && (
        <div className="mt-2 border border-gray-200 rounded-xl p-3 bg-gray-50 space-y-3 text-sm">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Wybierz uniwersum</p>
            <button onClick={() => { setShowUniversePanel(false); setUniverseSearch(""); setNewUniverseName(""); }} className="text-gray-400 hover:text-gray-600 text-lg leading-none">&times;</button>
          </div>
          {media.universe_name && (
            <button
              onClick={() => handleAssignUniverse(null)}
              disabled={savingUniverse}
              className="text-xs text-red-500 hover:text-red-700 disabled:opacity-50"
            >
              ✕ Usuń z uniwersum
            </button>
          )}
          <input
            type="text"
            value={universeSearch}
            onChange={(e) => setUniverseSearch(e.target.value)}
            placeholder="Szukaj istniejącego…"
            className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-xs focus:ring-2 focus:ring-blue-200 focus:outline-none"
          />
          <div className="max-h-40 overflow-y-auto space-y-1">
            {universesList
              .filter((u) => u.name.toLowerCase().includes(universeSearch.toLowerCase()))
              .map((u) => (
                <button
                  key={u.id}
                  onClick={() => handleAssignUniverse(u.id)}
                  disabled={savingUniverse}
                  className={`w-full text-left px-2 py-1.5 rounded-lg text-xs transition-colors disabled:opacity-50 ${
                    u.id === media.universe_id
                      ? "bg-blue-100 text-blue-800 font-medium"
                      : "hover:bg-white hover:shadow-sm text-gray-700"
                  }`}
                >
                  {u.id === media.universe_id ? "✓ " : ""}{u.name}
                </button>
              ))}
          </div>
          <div className="border-t border-gray-200 pt-2 space-y-1">
            <p className="text-[11px] text-gray-400">Utwórz nowe</p>
            <div className="flex gap-2">
              <input
                type="text"
                value={newUniverseName}
                onChange={(e) => setNewUniverseName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleCreateAndAssignUniverse()}
                placeholder="Nazwa nowego uniwersum"
                className="flex-1 border border-gray-200 rounded-lg px-2 py-1.5 text-xs focus:ring-2 focus:ring-blue-200 focus:outline-none"
              />
              <button
                onClick={handleCreateAndAssignUniverse}
                disabled={savingUniverse || !newUniverseName.trim()}
                className="shrink-0 bg-gray-800 text-white px-3 py-1.5 rounded-lg text-xs hover:bg-gray-700 disabled:opacity-50"
              >
                {savingUniverse ? "…" : "Utwórz"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
