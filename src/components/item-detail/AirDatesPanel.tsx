"use client";
import { useState } from "react";
import Image from "next/image";
import { toast } from "../Toast";
import { formatDate } from "@/lib/utils";
import { addDaySessions } from "@/lib/session-actions";
import type { MediaData, SeasonRow } from "./types";

interface AirDateSeason {
  seasonId: number | null;   // null = season doesn't exist in DB yet
  seasonLabel: string;
  tmdbSeasonNum: number;
  dates: string[];           // unique air dates (for pills display)
  episodeCount: number;      // total episode count (may differ from dates.length)
  seasonPosterPath: string | null; // TMDB season poster URL
  loading: boolean;
  error: string | null;
}
type TmdbCandidate = { tmdb_id: number; name: string; first_air_date: string; poster_path: string | null };

/**
 * TMDB episode air dates per season (linking the series to TMDB first if needed),
 * importable as one-day sessions, plus each season's TMDB poster as its cover.
 */
export default function AirDatesPanel({ media, seasons, sessionDaysMap, onChanged }: {
  media: MediaData;
  seasons: SeasonRow[];
  sessionDaysMap: Map<string, string>;
  onChanged: () => Promise<void>;
}) {
  const [showAirDates, setShowAirDates] = useState(false);
  const [airDateSeasons, setAirDateSeasons] = useState<AirDateSeason[]>([]);
  const [importingDates, setImportingDates] = useState<Set<string>>(new Set());
  const [savingCover, setSavingCover] = useState<Set<number>>(new Set()); // tmdbSeasonNum being saved
  const [tmdbLinkSearch, setTmdbLinkSearch] = useState("");
  const [tmdbLinkCandidates, setTmdbLinkCandidates] = useState<TmdbCandidate[]>([]);
  const [tmdbLinkLoading, setTmdbLinkLoading] = useState(false);
  const [showTmdbLink, setShowTmdbLink] = useState(false);

  // Fetch all TMDB seasons for a given tmdb_id, using DB seasons for id mapping
  const fetchAllTmdbSeasons = async (tmdbId: number, dbSeasons: SeasonRow[]) => {
    // First get number_of_seasons from TMDB info
    let numSeasons = dbSeasons.length || 1;
    try {
      const infoRes = await fetch(`/api/tmdb/info?tmdb_id=${tmdbId}&type=series`);
      if (infoRes.ok) {
        const info = await infoRes.json() as { number_of_seasons?: number };
        if (info.number_of_seasons) numSeasons = info.number_of_seasons;
      }
    } catch { /* use fallback */ }

    // Seasons 1..N + season 0 (Specials) probe
    const seasonNums = [0, ...Array.from({ length: numSeasons }, (_, i) => i + 1)];

    const initial: AirDateSeason[] = seasonNums.map((n) => {
      // Specials (season 0) never take part in the index-based fallbacks for regular seasons
      const regular = dbSeasons.filter((s) => s.season_number !== 0);
      const dbSeason = n > 0
        ? (dbSeasons.find((s) => s.season_number === n)
            ?? (numSeasons === 1 && regular.length === 1 ? regular[0] : null)
            ?? (regular.length >= n && regular[n - 1].season_number == null ? regular[n - 1] : null))
        : (dbSeasons.find((s) => s.season_number === 0) ?? null);
      return {
        seasonId: dbSeason?.id ?? null,
        seasonLabel: n === 0 ? "Speciale (sezon 0)" : (dbSeason?.title ?? `Sezon ${n}`),
        tmdbSeasonNum: n,
        dates: [], episodeCount: 0, seasonPosterPath: null, loading: true, error: null,
      };
    });
    setAirDateSeasons(initial);

    const results = await Promise.all(
      initial.map(async (as) => {
        try {
          const res = await fetch(`/api/tmdb/season?tmdb_id=${tmdbId}&season=${as.tmdbSeasonNum}`);
          const data = await res.json() as { episode_dates?: string[]; episode_count?: number; season_poster_path?: string | null; error?: string };
          if (!res.ok || data.error) return { ...as, loading: false, error: data.error ?? "Błąd" };
          return { ...as, loading: false, dates: data.episode_dates ?? [], episodeCount: data.episode_count ?? data.episode_dates?.length ?? 0, seasonPosterPath: data.season_poster_path ?? null };
        } catch { return { ...as, loading: false, error: "Błąd połączenia" }; }
      })
    );
    // Filter out season 0 if it has no episodes
    setAirDateSeasons(results.filter((s) => s.tmdbSeasonNum > 0 || s.episodeCount > 0));
  };

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

  const linkTmdbAndLoad = async (tmdbId: number) => {
    try {
      const res = await fetch(`/api/media/${media.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tmdb_id: tmdbId }),
      });
      if (!res.ok) throw new Error();
      toast("Powiązano z TMDB ✓", "success");
      setShowTmdbLink(false);
      setTmdbLinkCandidates([]);
      setShowAirDates(true);
      await onChanged();
      await fetchAllTmdbSeasons(tmdbId, seasons);
    } catch {
      toast("Błąd zapisu tmdb_id", "error");
    }
  };

  const loadAirDates = async () => {
    if (!media.tmdb_id) { toast("Brak powiązania z TMDB", "error"); return; }
    setShowAirDates(true);
    await fetchAllTmdbSeasons(media.tmdb_id, seasons);
  };

  /** The DB season for a TMDB season, created on first use; remembered in the panel state. */
  const ensureSeasonId = async (as: AirDateSeason): Promise<number> => {
    if (as.seasonId !== null) return as.seasonId;
    let seasonId = seasons.find((s) => s.season_number === as.tmdbSeasonNum)?.id;
    if (seasonId === undefined) {
      const sRes = await fetch("/api/seasons", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ media_id: media.id, season_number: as.tmdbSeasonNum }),
      });
      if (!sRes.ok) throw new Error(`Błąd tworzenia sezonu ${as.tmdbSeasonNum}`);
      seasonId = (await sRes.json() as { id: number }).id;
    }
    const id = seasonId;
    setAirDateSeasons((prev) => prev.map((a) => a.tmdbSeasonNum === as.tmdbSeasonNum ? { ...a, seasonId: id } : a));
    return id;
  };

  const saveSeasonCover = async (as: AirDateSeason) => {
    if (!as.seasonPosterPath) return;
    setSavingCover((prev) => new Set([...prev, as.tmdbSeasonNum]));
    try {
      const seasonId = await ensureSeasonId(as);

      // Download cover locally
      const dlRes = await fetch("/api/cover/download", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: as.seasonPosterPath }),
      });
      if (!dlRes.ok) throw new Error("Błąd pobierania okładki");
      const { path: localPath } = await dlRes.json() as { path: string };

      // Save to season
      const putRes = await fetch(`/api/seasons/${seasonId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cover_url: localPath }),
      });
      if (!putRes.ok) throw new Error("Błąd zapisu okładki");

      toast("Okładka sezonu zapisana ✓", "success");
      await onChanged();
    } catch (e) {
      toast(e instanceof Error ? e.message : "Błąd zapisu okładki", "error");
    } finally {
      setSavingCover((prev) => { const n = new Set(prev); n.delete(as.tmdbSeasonNum); return n; });
    }
  };

  const importSeasonDates = async (as: AirDateSeason, datesToImport: string[]) => {
    const newDates = datesToImport.filter((d) => !sessionDaysMap.has(d));
    if (!newDates.length) { toast("Wszystkie daty już istnieją", "error"); return; }

    let seasonId: number;
    try {
      seasonId = await ensureSeasonId(as);
    } catch (e) {
      toast(e instanceof Error ? e.message : "Błąd tworzenia sezonu", "error");
      return;
    }

    setImportingDates((prev) => new Set([...prev, ...newDates]));
    const added = await addDaySessions(seasonId, newDates);
    setImportingDates((prev) => { const n = new Set(prev); newDates.forEach((d) => n.delete(d)); return n; });
    toast(`Dodano ${added} sesji ✓`, "success");
    await onChanged();
  };

  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <button
          onClick={() => {
            if (showAirDates) { setShowAirDates(false); setShowTmdbLink(false); return; }
            if (media.tmdb_id) { loadAirDates(); }
            else { setShowTmdbLink(true); setShowAirDates(true); setTmdbLinkSearch(media.original_title || media.title || ""); }
          }}
          className={`text-xs flex items-center gap-1 px-2 py-1 rounded border transition-colors ${
            showAirDates
              ? "border-green-400 bg-green-50 text-green-700"
              : "border-gray-200 text-gray-500 hover:text-gray-700 hover:bg-gray-50"
          }`}
        >
          📅 {showAirDates ? "Ukryj daty emisji" : "Daty emisji TMDB"}
        </button>
      </div>

      {/* TMDB linking panel (when no tmdb_id) */}
      {showTmdbLink && !media.tmdb_id && (
        <div className="mb-4 border border-blue-200 rounded-lg p-3 bg-blue-50 space-y-3">
          <p className="text-xs text-blue-700 font-medium">Powiąż z TMDB żeby zaciągnąć daty emisji</p>
          <div className="flex gap-2">
            <input
              type="text"
              value={tmdbLinkSearch}
              onChange={(e) => setTmdbLinkSearch(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && searchTmdbCandidates()}
              placeholder="Tytuł serialu..."
              className="flex-1 text-sm border border-blue-200 rounded px-2 py-1 bg-white"
            />
            <button
              onClick={searchTmdbCandidates}
              disabled={tmdbLinkLoading}
              className="text-sm bg-blue-600 text-white px-3 py-1 rounded hover:bg-blue-700 disabled:opacity-50"
            >
              {tmdbLinkLoading ? "..." : "Szukaj"}
            </button>
          </div>
          {tmdbLinkCandidates.length > 0 && (
            <div className="space-y-1">
              {tmdbLinkCandidates.map((c) => (
                <button
                  key={c.tmdb_id}
                  onClick={() => linkTmdbAndLoad(c.tmdb_id)}
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
      )}

      {/* Air dates panel */}
      {showAirDates && airDateSeasons.length > 0 && (
        <div className="mt-4 space-y-3">
          <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
            Daty pierwszej emisji odcinków (TMDB)
          </h4>
          {airDateSeasons.map((as) => {
            const newDates = as.dates.filter((d) => !sessionDaysMap.has(d));
            return (
              <div key={as.tmdbSeasonNum} className="border border-gray-200 rounded-lg overflow-hidden">
                <div className="flex items-center gap-2 px-3 py-2 bg-gray-50 border-b border-gray-100">
                  {/* Season poster thumbnail */}
                  {as.seasonPosterPath && (
                    <Image
                      unoptimized
                      src={as.seasonPosterPath}
                      alt={as.seasonLabel}
                      width={28}
                      height={40}
                      className="h-10 w-7 object-cover rounded flex-shrink-0"
                    />
                  )}
                  <span className="text-sm font-medium text-gray-800 flex-1">{as.seasonLabel}</span>
                  {as.loading && <span className="text-xs text-gray-400">⏳ Ładowanie...</span>}
                  {!as.loading && as.error && <span className="text-xs text-red-500">{as.error}</span>}
                  {!as.loading && !as.error && (
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-gray-400">
                        {as.episodeCount} odc. · {newDates.length} nowych
                      </span>
                      {as.seasonPosterPath && (
                        <button
                          onClick={() => saveSeasonCover(as)}
                          disabled={savingCover.has(as.tmdbSeasonNum)}
                          title="Zapisz okładkę sezonu z TMDB"
                          className="text-xs bg-purple-600 text-white px-2 py-0.5 rounded hover:bg-purple-700 disabled:opacity-50"
                        >
                          {savingCover.has(as.tmdbSeasonNum) ? "⏳" : "🖼️ Okładka"}
                        </button>
                      )}
                      {newDates.length > 0 && (
                        <button
                          onClick={() => importSeasonDates(as, newDates)}
                          disabled={newDates.some((d) => importingDates.has(d))}
                          className="text-xs bg-green-600 text-white px-2 py-0.5 rounded hover:bg-green-700 disabled:opacity-50"
                        >
                          + Dodaj wszystkie nowe
                        </button>
                      )}
                    </div>
                  )}
                </div>
                {!as.loading && !as.error && as.dates.length > 0 && (
                  <div className="p-3 flex flex-wrap gap-1.5">
                    {as.dates.map((date) => {
                      const exists = sessionDaysMap.has(date);
                      const importing = importingDates.has(date);
                      return (
                        <button
                          key={date}
                          onClick={() => !exists && !importing && importSeasonDates(as, [date])}
                          disabled={exists || importing}
                          title={exists ? "Już zalogowane" : `Dodaj ${date} jako sesję`}
                          className={`text-[11px] px-2 py-0.5 rounded-full border transition-colors ${
                            exists
                              ? "bg-green-100 border-green-200 text-green-700 cursor-default"
                              : importing
                              ? "bg-gray-100 border-gray-200 text-gray-400 cursor-wait"
                              : "bg-white border-gray-300 text-gray-700 hover:bg-blue-50 hover:border-blue-300 cursor-pointer"
                          }`}
                        >
                          {formatDate(date)}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
