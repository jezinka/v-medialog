"use client";
import { useState } from "react";
import { toast } from "../Toast";
import type { MediaForm } from "./CreateMediaForm";

/** Fills the new-media form from a lubimyczytac.pl link or a TMDB link / title. */
export default function QuickFill({ onFilled }: {
  onFilled: (update: (f: MediaForm) => MediaForm, source: "lubimyczytac" | "tmdb") => void;
}) {
  const [lcUrl, setLcUrl] = useState("");
  const [lcLoading, setLcLoading] = useState(false);
  const [tmdbUrl, setTmdbUrl] = useState("");
  const [tmdbLoading, setTmdbLoading] = useState(false);

  const handleLcFetch = async () => {
    if (!lcUrl.trim()) return;
    setLcLoading(true);
    try {
      const res = await fetch("/api/scrape/lubimyczytac", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: lcUrl.trim() }),
      });
      const data = await res.json();
      if (!res.ok) { toast(data.error ?? "Błąd scrapowania", "error"); return; }
      onFilled((f) => ({
        ...f,
        title: data.title || f.title,
        original_title: data.original_title || f.original_title,
        author: data.author || f.author,
        cover_url: data.cover_url || f.cover_url,
        description: data.description || f.description,
        media_type: "book",
      }), "lubimyczytac");
      toast("Dane pobrane ✓", "success");
    } catch {
      toast("Błąd połączenia", "error");
    } finally {
      setLcLoading(false);
    }
  };

  const handleTmdbFetch = async () => {
    if (!tmdbUrl.trim()) return;
    setTmdbLoading(true);
    try {
      const value = tmdbUrl.trim();
      const applyTmdbData = (data: { title?: string; original_title?: string; director?: string; poster_url?: string; overview?: string }, type: "movie" | "series", tmdbId: string) => {
        onFilled((f) => ({
          ...f,
          title: data.title || f.title,
          original_title: data.original_title || f.original_title,
          author: data.director || f.author,
          cover_url: data.poster_url || f.cover_url,
          description: data.overview || f.description,
          media_type: type,
          tmdb_id: tmdbId,
        }), "tmdb");
      };

      const match = value.match(/themoviedb\.org\/(movie|tv)\/(\d+)/);
      if (match) {
        const [, tmdbType, tmdbId] = match;
        const type = tmdbType === "movie" ? "movie" : "series";
        const res = await fetch(`/api/tmdb/info?tmdb_id=${tmdbId}&type=${type}`);
        const data = await res.json();
        if (!res.ok) { toast(data.error ?? "Błąd TMDB", "error"); return; }
        applyTmdbData(data, type, tmdbId);
        toast("Dane pobrane ✓", "success");
        return;
      }

      let resolved:
        | { data: { tmdb_id: number; title?: string; original_title?: string; director?: string; poster_url?: string; overview?: string; candidates?: Array<{ tmdb_id: number; name: string }> }; type: "series" | "movie" }
        | null = null;
      for (const type of ["series", "movie"] as const) {
        const res = await fetch(`/api/tmdb/info?title=${encodeURIComponent(value)}&type=${type}`);
        const data = await res.json() as { candidates?: Array<{ tmdb_id: number; name: string }> };
        if (res.ok) { resolved = { data: data as { tmdb_id: number; title?: string; original_title?: string; director?: string; poster_url?: string; overview?: string; candidates?: Array<{ tmdb_id: number; name: string }> }, type }; break; }
        if (res.status !== 404) { toast((data as { error?: string }).error ?? "Błąd TMDB", "error"); return; }
      }
      if (!resolved) { toast(`Nie znaleziono "${value}"`, "error"); return; }

      let finalData = resolved.data;
      if (finalData.candidates?.length) {
        // ponytail: pick first candidate; add picker UI only if this proves too often wrong
        const picked = finalData.candidates[0];
        const detailRes = await fetch(`/api/tmdb/info?tmdb_id=${picked.tmdb_id}&type=${resolved.type}`);
        const detailData = await detailRes.json();
        if (!detailRes.ok) { toast(detailData.error ?? "Błąd TMDB", "error"); return; }
        finalData = detailData as { tmdb_id: number; title?: string; original_title?: string; director?: string; poster_url?: string; overview?: string };
      }

      applyTmdbData(finalData, resolved.type, String(finalData.tmdb_id));
      toast("Dane pobrane ✓", "success");
    } catch {
      toast("Błąd połączenia z TMDB", "error");
    } finally {
      setTmdbLoading(false);
    }
  };

  return (
    <>
      {/* lubimyczytac.pl quick-fill */}
      <div className="pt-1 border-t border-gray-100">
        <p className="text-[11px] text-gray-400 mb-1.5">Uzupełnij z lubimyczytac.pl</p>
        <div className="flex gap-2">
          <input
            type="url"
            value={lcUrl}
            onChange={(e) => setLcUrl(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleLcFetch()}
            placeholder="https://lubimyczytac.pl/ksiazka/..."
            className="flex-1 border border-gray-200 rounded-lg px-3 py-1.5 text-xs focus:ring-2 focus:ring-blue-200 focus:outline-none"
          />
          <button
            type="button"
            onClick={handleLcFetch}
            disabled={lcLoading || !lcUrl.trim()}
            className="shrink-0 bg-orange-500 text-white px-3 py-1.5 rounded-lg text-xs hover:bg-orange-600 disabled:opacity-50"
          >
            {lcLoading ? "⏳" : "Pobierz"}
          </button>
        </div>
      </div>
      {/* TMDB quick-fill */}
      <div className="pt-1 border-t border-gray-100">
        <p className="text-[11px] text-gray-400 mb-1.5">Uzupełnij z TMDB (link lub tytuł)</p>
        <div className="flex gap-2">
          <input
            type="text"
            value={tmdbUrl}
            onChange={(e) => setTmdbUrl(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleTmdbFetch()}
            placeholder="np. Inception lub https://www.themoviedb.org/movie/..."
            className="flex-1 border border-gray-200 rounded-lg px-3 py-1.5 text-xs focus:ring-2 focus:ring-blue-200 focus:outline-none"
          />
          <button
            type="button"
            onClick={handleTmdbFetch}
            disabled={tmdbLoading || !tmdbUrl.trim()}
            className="shrink-0 bg-teal-600 text-white px-3 py-1.5 rounded-lg text-xs hover:bg-teal-700 disabled:opacity-50"
          >
            {tmdbLoading ? "⏳" : "Pobierz"}
          </button>
        </div>
      </div>
    </>
  );
}
