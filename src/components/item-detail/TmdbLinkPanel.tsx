"use client";
import { useState } from "react";
import { toast } from "../Toast";
import type { TmdbCandidate } from "@/lib/tmdb";

/** Searches TMDB series by title so a series without a TMDB id can be linked to one. */
export default function TmdbLinkPanel({ initialSearch, onPick }: {
  initialSearch: string;
  onPick: (tmdbId: number) => void;
}) {
  const [tmdbLinkSearch, setTmdbLinkSearch] = useState(initialSearch);
  const [tmdbLinkCandidates, setTmdbLinkCandidates] = useState<TmdbCandidate[]>([]);
  const [tmdbLinkLoading, setTmdbLinkLoading] = useState(false);

  const searchTmdbCandidates = async () => {
    if (!tmdbLinkSearch.trim()) return;
    setTmdbLinkLoading(true);
    try {
      const infoRes = await fetch(`/api/tmdb/info?title=${encodeURIComponent(tmdbLinkSearch)}&type=series`);
      const infoData = await infoRes.json() as { candidates?: TmdbCandidate[]; tmdb_id?: number; title?: string };
      if (infoData.candidates) setTmdbLinkCandidates(infoData.candidates);
      else if (infoData.tmdb_id) setTmdbLinkCandidates([{ tmdb_id: infoData.tmdb_id, name: infoData.title ?? tmdbLinkSearch, first_air_date: "", poster_path: null }]);
      else toast("Nie znaleziono", "error");
    } catch {
      toast("Błąd wyszukiwania", "error");
    } finally {
      setTmdbLinkLoading(false);
    }
  };

  return (
    <div className="mb-4 border border-blue-200 rounded-lg p-3 bg-blue-50 space-y-3">
      <p className="text-xs text-blue-700 font-medium">Powiąż z TMDB żeby zaciągnąć daty emisji</p>
      <div className="flex gap-2">
        <input
          type="text"
          value={tmdbLinkSearch}
          onChange={(e) => setTmdbLinkSearch(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && searchTmdbCandidates()}
          placeholder="Tytuł serialu..."
          className="input flex-1 text-sm px-2 py-1"
        />
        <button
          onClick={searchTmdbCandidates}
          disabled={tmdbLinkLoading}
          className="btn-primary text-sm px-3 py-1"
        >
          {tmdbLinkLoading ? "..." : "Szukaj"}
        </button>
      </div>
      {tmdbLinkCandidates.length > 0 && (
        <div className="space-y-1">
          {tmdbLinkCandidates.map((c) => (
            <button
              key={c.tmdb_id}
              onClick={() => onPick(c.tmdb_id)}
              className="flex items-center gap-2 w-full text-left px-2 py-1.5 rounded bg-white border border-blue-100 hover:border-blue-400 text-sm transition-colors"
            >
              {c.poster_path && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={c.poster_path} alt="" className="w-8 h-12 object-cover rounded shrink-0" />
              )}
              <div>
                <p className="font-medium text-gray-900">{c.name}</p>
                {c.first_air_date && <p className="text-xs text-gray-400">{c.first_air_date}</p>}
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
