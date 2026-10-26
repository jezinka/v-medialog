"use client";

import { useEffect, useState } from "react";
import { toast } from "../Toast";

interface PersonSearchResult {
  id: number;
  name: string;
  photo_url: string | null;
  media_count: number;
  roles: string[];
}

/** Merges another person into this one: their links move here and they are deleted. */
export default function MergePersonPanel({ personId, personName, onMerged }: {
  personId: number;
  personName: string;
  onMerged: () => void;
}) {
  const [showMerge, setShowMerge] = useState(false);
  const [mergeSearch, setMergeSearch] = useState("");
  const [mergeResults, setMergeResults] = useState<PersonSearchResult[]>([]);
  const [mergeTarget, setMergeTarget] = useState<PersonSearchResult | null>(null);
  const [merging, setMerging] = useState(false);

  // Merge persons: search
  useEffect(() => {
    if (!mergeSearch.trim() || mergeSearch.length < 2) { setMergeResults([]); return; }
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`/api/persons`);
        const data = await res.json() as PersonSearchResult[];
        const q = mergeSearch.toLowerCase();
        setMergeResults(
          data.filter((p) => p.id !== personId && p.name.toLowerCase().includes(q)).slice(0, 8)
        );
      } catch {
        setMergeResults([]);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [mergeSearch, personId]);

  const handleMerge = async () => {
    if (!mergeTarget) return;
    setMerging(true);
    try {
      const res = await fetch(`/api/persons/${personId}/merge`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sourceId: mergeTarget.id }),
      });
      if (!res.ok) { const d = await res.json() as { error?: string }; throw new Error(d.error); }
      toast(`Scalono "${mergeTarget.name}" z "${personName}"`, "success");
      setShowMerge(false);
      setMergeTarget(null);
      setMergeSearch("");
      onMerged();
    } catch (e) {
      toast(e instanceof Error ? e.message : "Błąd scalania", "error");
    } finally {
      setMerging(false);
    }
  };

  return (
  <section className="space-y-2">
    <div className="flex items-center justify-between">
      <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">Połącz osoby</h2>
      <button
        onClick={() => { setShowMerge((v) => !v); setMergeTarget(null); setMergeSearch(""); }}
        className="text-xs px-2.5 py-1 rounded-full border border-gray-300 text-gray-600 hover:border-orange-300 hover:text-orange-700 transition-colors"
      >
        {showMerge ? "✕ Anuluj" : "⇄ Scal z osobą"}
      </button>
    </div>

    {showMerge && (
      <div className="rounded-xl border border-orange-100 bg-orange-50 p-3 space-y-2">
        <p className="text-xs text-gray-500">
          Wyszukaj osobę do scalenia. Jej powiązania zostaną przeniesione do <strong>{personName}</strong>, a ona zostanie usunięta.
        </p>
        {!mergeTarget ? (
          <>
            <input
              type="search"
              value={mergeSearch}
              onChange={(e) => setMergeSearch(e.target.value)}
              placeholder="Wpisz imię i nazwisko…"
              className="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-sm bg-white"
              autoFocus
            />
            {mergeResults.length > 0 && (
              <div className="rounded-lg border border-gray-200 bg-white divide-y divide-gray-100 max-h-48 overflow-y-auto">
                {mergeResults.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => setMergeTarget(p)}
                    className="flex items-center justify-between w-full px-3 py-2 text-left hover:bg-orange-50 text-sm transition-colors"
                  >
                    <span className="font-medium">{p.name}</span>
                    <span className="text-xs text-gray-400">{p.media_count} pozycji</span>
                  </button>
                ))}
              </div>
            )}
            {mergeSearch.length >= 2 && mergeResults.length === 0 && (
              <p className="text-xs text-gray-400">Brak wyników.</p>
            )}
          </>
        ) : (
          <div className="space-y-2">
            <div className="flex items-center gap-2 rounded-lg border border-orange-200 bg-white px-3 py-2">
              <span className="text-sm font-medium flex-1">{mergeTarget.name}</span>
              <button
                onClick={() => setMergeTarget(null)}
                className="text-xs text-gray-400 hover:text-red-500"
              >
                ✕
              </button>
            </div>
            <p className="text-xs text-orange-700">
              ⚠ Powiązania z <strong>{mergeTarget.name}</strong> zostaną przeniesione do <strong>{personName}</strong>. Ta operacja jest nieodwracalna.
            </p>
            <button
              onClick={() => void handleMerge()}
              disabled={merging}
              className="w-full py-1.5 rounded-lg bg-orange-600 text-white text-sm font-medium hover:bg-orange-700 disabled:opacity-50 transition-colors"
            >
              {merging ? "Scalanie…" : `Scal "${mergeTarget.name}" z "${personName}"`}
            </button>
          </div>
        )}
      </div>
    )}
  </section>
  );
}
