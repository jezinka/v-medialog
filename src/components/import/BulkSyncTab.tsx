"use client";
import React from "react";
import Image from "next/image";

type TmdbSyncCandidate = { tmdb_id: number; name: string; first_air_date: string; poster_path: string | null };
type BookSyncCandidate = { ol_key: string; title: string; author: string; year: number | null; cover_url: string | null };
type ItunesSyncCandidate = { itunes_id: number; title: string; artist: string; year: number | null; cover_url: string | null };

type SyncedItem = { id: number; title: string; media_type: string };
type FailedItem = { id: number; title: string; media_type: string; error: string };
type NeedsReviewItem = {
  id: number;
  title: string;
  media_type: string;
  source: "tmdb" | "books" | "itunes";
  candidates: TmdbSyncCandidate[] | BookSyncCandidate[] | ItunesSyncCandidate[];
};

type BulkSyncResult = {
  synced: SyncedItem[];
  needs_review: NeedsReviewItem[];
  failed: FailedItem[];
  total: number;
};

type TmdbInfoResponse = {
  tmdb_id: number;
  overview: string;
  poster_url: string | null;
  genres: string[];
  vote_average: number;
  persons: unknown[];
  status?: string;
  first_air_date?: string;
  release_date?: string;
  number_of_seasons?: number;
  runtime?: number;
};

type BookInfoResponse = {
  ol_key: string | null;
  description: string;
  subjects: string[];
  first_publish_year: number | null;
  cover_url: string | null;
  authors: string[];
};

type ItunesInfoResponse = {
  itunes_id: number;
  description: string | null;
  genres: string[];
  release_year: number | null;
  cover_url: string | null;
  tracks: Array<{ number: number; title: string; duration_ms: number | null }> | null;
};

export default function BulkSyncTab() {
  const [skipSynced, setSkipSynced] = React.useState(true);
  const [loading, setLoading] = React.useState(false);
  const [result, setResult] = React.useState<BulkSyncResult | null>(null);
  const [needsReview, setNeedsReview] = React.useState<NeedsReviewItem[]>([]);
  const [applyingId, setApplyingId] = React.useState<number | null>(null);

  const handleSync = async () => {
    setLoading(true);
    setResult(null);
    setNeedsReview([]);
    try {
      const res = await fetch("/api/media/bulk-sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ skip_synced: skipSynced }),
      });
      if (!res.ok) throw new Error("Błąd synchronizacji");
      const data = await res.json() as BulkSyncResult;
      setResult(data);
      setNeedsReview(data.needs_review);
    } catch (err) {
      alert("Błąd: " + (err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const applyCandidate = async (item: NeedsReviewItem, candidateId: number | string) => {
    setApplyingId(item.id);
    try {
      let infoData: TmdbInfoResponse | BookInfoResponse | ItunesInfoResponse | null = null;

      if (item.source === "tmdb") {
        const type = ["series", "anime"].includes(item.media_type) ? "series" : "movie";
        const res = await fetch(`/api/tmdb/info?tmdb_id=${candidateId}&type=${type}`);
        if (!res.ok) throw new Error("Błąd TMDB");
        infoData = await res.json() as TmdbInfoResponse;
      } else if (item.source === "books") {
        const res = await fetch(`/api/books/info?ol_key=${encodeURIComponent(String(candidateId))}`);
        if (!res.ok) throw new Error("Błąd serwisu książek");
        infoData = await res.json() as BookInfoResponse;
      } else if (item.source === "itunes") {
        const type = item.media_type === "podcast" ? "podcast" : "record";
        const res = await fetch(`/api/itunes/info?itunes_id=${candidateId}&type=${type}`);
        if (!res.ok) throw new Error("Błąd iTunes");
        infoData = await res.json() as ItunesInfoResponse;
      }
      if (!infoData) throw new Error("Brak danych");

      let body: Record<string, unknown> = {};
      if (item.source === "tmdb") {
        const d = infoData as TmdbInfoResponse;
        const isTv = ["series", "anime"].includes(item.media_type);
        const dateStr = isTv ? d.first_air_date : d.release_date;
        const releaseYear = dateStr ? parseInt(dateStr.slice(0, 4)) || null : null;
        body = {
          tmdb_id: d.tmdb_id,
          description: d.overview,
          genres: d.genres,
          vote_average: d.vote_average,
          runtime: isTv ? null : (d.runtime ?? null),
          release_year: releaseYear,
          series_status: isTv ? (d.status ?? null) : null,
          tmdb_seasons_count: isTv ? (d.number_of_seasons ?? null) : null,
          persons: d.persons,
        };
      } else if (item.source === "books") {
        const d = infoData as BookInfoResponse;
        body = {
          ol_key: d.ol_key,
          description: d.description,
          genres: d.subjects?.slice(0, 8) ?? [],
          release_year: d.first_publish_year ?? null,
          persons: (d.authors ?? []).map((a, i) => ({ name: a, role: "author", display_order: i })),
        };
      } else if (item.source === "itunes") {
        const d = infoData as ItunesInfoResponse;
        body = {
          ol_key: `itunes:${d.itunes_id}`,
          description: d.description,
          genres: d.genres,
          release_year: d.release_year ?? null,
          track_list: d.tracks ?? null,
          persons: [],
        };
      }

      await fetch(`/api/media/${item.id}/external`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      const posterUrl = item.source === "tmdb"
        ? (infoData as TmdbInfoResponse).poster_url
        : item.source === "books"
        ? (infoData as BookInfoResponse).cover_url
        : (infoData as ItunesInfoResponse).cover_url;

      if (posterUrl) {
        const dlRes = await fetch("/api/cover/download", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ url: posterUrl }),
        });
        if (dlRes.ok) {
          const { path } = await dlRes.json() as { path: string };
          await fetch(`/api/media/${item.id}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ cover_url: path }),
          });
        }
      }

      setNeedsReview((prev) => prev.filter((i) => i.id !== item.id));
      setResult((prev) =>
        prev ? { ...prev, synced: [...prev.synced, { id: item.id, title: item.title, media_type: item.media_type }] } : prev
      );
    } catch (err) {
      alert("Błąd: " + (err as Error).message);
    } finally {
      setApplyingId(null);
    }
  };

  return (
    <div className="space-y-5">
      <div>
        <h3 className="text-sm font-semibold text-gray-800 mb-1">Masowe pobieranie opisów i okładek</h3>
        <p className="text-xs text-gray-500 mb-4">
          Automatycznie pobiera opisy, gatunki i okładki z TMDB (filmy/seriale), lubimyczytac (książki/komiksy) i iTunes (muzyka/podcasty).
          Jeśli jest tylko jedno dopasowanie — zostaje zastosowane od razu.
        </p>
        <label className="flex items-center gap-2 text-sm text-gray-700 mb-4 cursor-pointer">
          <input
            type="checkbox"
            checked={skipSynced}
            onChange={(e) => setSkipSynced(e.target.checked)}
            className="rounded"
          />
          Pomiń już zsynchronizowane
        </label>
        <button
          onClick={handleSync}
          disabled={loading}
          className="bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white px-5 py-2 rounded-lg text-sm font-medium transition-colors"
        >
          {loading ? "⏳ Synchronizuję..." : "🔄 Rozpocznij synchronizację"}
        </button>
      </div>

      {loading && (
        <div className="text-sm text-gray-500 animate-pulse">Pobieranie danych z zewnętrznych źródeł — może potrwać chwilę…</div>
      )}

      {result && (
        <div className="space-y-4">
          <div className="flex gap-3 flex-wrap text-sm">
            <span className="bg-green-100 text-green-800 px-3 py-1 rounded-full font-medium">✅ {result.synced.length} zsynchronizowanych</span>
            {needsReview.length > 0 && (
              <span className="bg-yellow-100 text-yellow-800 px-3 py-1 rounded-full font-medium">🔍 {needsReview.length} do przeglądu</span>
            )}
            {result.failed.length > 0 && (
              <span className="bg-red-100 text-red-800 px-3 py-1 rounded-full font-medium">❌ {result.failed.length} błędów</span>
            )}
            <span className="text-gray-500">z {result.total} łącznie</span>
          </div>

          {needsReview.length > 0 && (
            <div className="space-y-3">
              <h4 className="text-sm font-semibold text-gray-700">🔍 Wymagają ręcznego wyboru:</h4>
              {needsReview.map((item) => (
                <div key={item.id} className="border border-yellow-200 rounded-lg p-3 bg-yellow-50 space-y-2">
                  <p className="text-sm font-medium text-gray-800">
                    {item.title} <span className="text-xs text-gray-500">({item.media_type})</span>
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {(item.candidates as (TmdbSyncCandidate & BookSyncCandidate & ItunesSyncCandidate)[]).map((c) => {
                      const id = c.tmdb_id ?? c.itunes_id ?? c.ol_key;
                      const name = c.name ?? c.title ?? "";
                      const sub = c.author ?? c.artist ?? "";
                      const year = c.year ?? (c.first_air_date ? c.first_air_date.slice(0, 4) : null);
                      const img = c.poster_path ?? c.cover_url ?? null;
                      return (
                        <button
                          key={String(id)}
                          disabled={applyingId === item.id}
                          onClick={() => applyCandidate(item, id!)}
                          className="flex items-center gap-2 px-3 py-1.5 bg-white border border-yellow-300 rounded-lg text-xs hover:bg-yellow-100 transition-colors disabled:opacity-50"
                        >
                          {img && <Image unoptimized src={img} alt="" width={20} height={28} className="w-5 h-7 object-cover rounded" />}
                          <span className="font-medium">{name}</span>
                          {sub && <span className="text-gray-500">{sub}</span>}
                          {year && <span className="text-gray-400">{year}</span>}
                        </button>
                      );
                    })}
                  </div>
                  {applyingId === item.id && <p className="text-xs text-yellow-700 animate-pulse">Zapisuję…</p>}
                </div>
              ))}
            </div>
          )}

          {result.failed.length > 0 && (
            <details className="text-sm">
              <summary className="cursor-pointer font-medium text-red-700">❌ Błędy ({result.failed.length})</summary>
              <ul className="mt-2 space-y-1 pl-3">
                {result.failed.map((f) => (
                  <li key={f.id} className="text-gray-700">
                    <span className="font-medium">{f.title}</span>
                    <span className="text-gray-400 ml-2 text-xs">{f.error}</span>
                  </li>
                ))}
              </ul>
            </details>
          )}

          {result.synced.length > 0 && (
            <details className="text-sm">
              <summary className="cursor-pointer font-medium text-green-700">✅ Zsynchronizowane ({result.synced.length})</summary>
              <ul className="mt-2 space-y-1 pl-3 columns-2">
                {result.synced.map((s) => (
                  <li key={s.id} className="text-gray-700 text-xs">{s.title}</li>
                ))}
              </ul>
            </details>
          )}
        </div>
      )}
    </div>
  );
}
