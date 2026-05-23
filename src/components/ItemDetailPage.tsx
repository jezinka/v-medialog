"use client";
import { useEffect, useState, useCallback, useMemo, useRef } from "react";
import Image from "next/image";
import CoverImg from "./CoverImg";
import { MEDIA_TYPE_ICONS, MEDIA_TYPE_COLORS, MEDIA_TYPE_LABELS, formatDate, BOOK_TYPES, SCREEN_TYPES, ITUNES_TYPES } from "@/lib/utils";
import { toast } from "./Toast";

interface Props {
  mediaId: number;
  onClose?: () => void;
  onRefresh?: () => void;
  onOpenPerson?: (personId: number) => void;
  onOpenDetail?: (mediaId: number) => void;
}

interface MediaData {
  id: number;
  title: string;
  original_title: string | null;
  author: string | null;
  media_type: string;
  cover_url: string | null;
  universe_id: number | null;
  universe_name: string | null;
  notes: string | null;
  tags: string | null;
  discontinued: boolean | number;
  tmdb_id: number | null;
  ol_key: string | null;
  description: string | null;
  genres: string | null;
  vote_average: number | null;
  runtime: number | null;
  release_year: number | null;
  external_synced_at: string | null;
  series_status: string | null;
  source_url: string | null;
  season_count: number;
  first_session_date: string | null;
  last_session_date: string | null;
  tagList: { id: number; name: string }[];
}

interface SessionApiRow {
  id: number;
  season_id: number;
  start_date: string;
  end_date: string | null;
  cinema: boolean | number;
  season_number: number | null;
  season_title: string | null;
  media_id: number;
  media_title: string;
  media_type: string;
}

interface SeasonRow {
  id: number;
  media_id: number;
  season_number: number | null;
  title: string | null;
  cover_url: string | null;
  session_count: number;
  first_session_date: string | null;
  last_session_date: string | null;
  want_to_watch: boolean | number | null;
}

type CachedData = {
  tmdbId: number | null;
  olKey: string | null;
  externalSyncedAt: string | null;
  description: string | null;
  genres: string[];
  voteAverage: number | null;
  runtime: number | null;
  releaseYear: number | null;
  seriesStatus: string | null;
  tmdbSeasonsCount: number | null;
  trackList: Array<{ number: number; title: string; duration_ms: number | null }> | null;
  persons: Array<{
    personId: number;
    name: string;
    role: string;
    characterName: string | null;
    photoUrl: string | null;
    displayOrder: number;
  }>;
};

type TmdbCandidate = { tmdb_id: number; name: string; first_air_date: string; poster_path: string | null };
type ItunesCandidate = { itunes_id: number; title: string; artist: string; year: number | null; cover_url: string | null };
type ExternalSyncState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "tmdb_candidates"; candidates: TmdbCandidate[] }
  | { status: "itunes_candidates"; candidates: ItunesCandidate[] }
  | { status: "done" }
  | { status: "error"; message: string };

// Full TMDB API response shape
type TmdbInfoResult = {
  tmdb_id: number;
  overview: string | null;
  genres: string[];
  vote_average: number | null;
  runtime: number | null;
  release_date?: string | null;
  first_air_date?: string | null;
  poster_url: string | null;
  director?: string | null;
  created_by?: Array<{ name: string }>;
  cast: Array<{ name: string; character: string; profile_path: string | null }>;
  status?: string | null;
  number_of_seasons?: number | null;
};

const POLISH_MONTHS = [
  "Styczeń", "Luty", "Marzec", "Kwiecień", "Maj", "Czerwiec",
  "Lipiec", "Sierpień", "Wrzesień", "Październik", "Listopad", "Grudzień",
];

const DAY_LABELS = ["Pn", "Wt", "Śr", "Cz", "Pt", "So", "Nd"];

const SEASON_COLORS = [
  "bg-blue-500", "bg-purple-500", "bg-green-500",
  "bg-orange-500", "bg-pink-500", "bg-teal-500",
];

function MiniCalendar({
  year,
  month,
  sessionDaysByItem,
  onDayClick,
  onDayHover,
}: {
  year: number;
  month: number; // 1-12
  sessionDaysByItem: Map<string, string>; // date → tailwind color class
  onDayClick: (date: string) => void | Promise<void>;
  onDayHover?: (date: string) => void;
}) {
  const daysInMonth = new Date(year, month, 0).getDate();
  const offset = (new Date(year, month - 1, 1).getDay() + 6) % 7;

  const cells: Array<number | null> = [];
  for (let i = 0; i < offset; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  return (
    <div className="w-[180px] shrink-0">
      <p className="text-xs font-semibold text-gray-700 mb-1.5">
        {POLISH_MONTHS[month - 1]} {year}
      </p>
      <div className="grid grid-cols-7 gap-px">
        {DAY_LABELS.map((d) => (
          <div key={d} className="text-center text-[9px] text-gray-400 font-medium pb-0.5">
            {d}
          </div>
        ))}
        {cells.map((day, idx) => {
          if (day === null) {
            return <div key={`e-${idx}`} />;
          }
          const mm = String(month).padStart(2, "0");
          const dd = String(day).padStart(2, "0");
          const dateStr = `${year}-${mm}-${dd}`;
          const colorClass = sessionDaysByItem.get(dateStr) ?? null;
          return (
            <button
              key={dateStr}
              onClick={() => onDayClick(dateStr)}
              onMouseEnter={() => onDayHover?.(dateStr)}
              title={dateStr}
              className={`w-full aspect-square flex items-center justify-center text-[10px] rounded-full transition-colors
                ${colorClass
                  ? `${colorClass} text-white font-semibold hover:opacity-80`
                  : "text-gray-500 hover:bg-gray-100"
                }`}
            >
              {day}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function seasonLabel(s: SeasonRow, idx: number): string {
  if (s.season_number != null) return s.title ? `${s.title} (${s.season_number})` : `Sezon ${s.season_number}`;
  if (s.title) return `${s.title} (${idx + 1})`;
  return `${idx + 1}`;
}

function YearCalendar({
  year,
  sessionDaysByItem,
  selectedDates,
  onDayToggle,
}: {
  year: number;
  sessionDaysByItem: Map<string, string>;
  selectedDates: Set<string>;
  onDayToggle: (date: string) => void;
}) {
  return (
    <div className="grid grid-cols-3 gap-x-6 gap-y-6">
      {Array.from({ length: 12 }, (_, i) => i + 1).map((month) => {
        const daysInMonth = new Date(year, month, 0).getDate();
        const offset = (new Date(year, month - 1, 1).getDay() + 6) % 7;
        const cells: Array<number | null> = [];
        for (let i = 0; i < offset; i++) cells.push(null);
        for (let d = 1; d <= daysInMonth; d++) cells.push(d);

        return (
          <div key={month} className="w-[180px] shrink-0">
            <p className="text-xs font-semibold text-gray-700 mb-1.5">
              {POLISH_MONTHS[month - 1]}
            </p>
            <div className="grid grid-cols-7 gap-px">
              {DAY_LABELS.map((d) => (
                <div key={d} className="text-center text-[9px] text-gray-400 font-medium pb-0.5">
                  {d}
                </div>
              ))}
              {cells.map((day, idx) => {
                if (day === null) return <div key={`e-${idx}`} />;
                const mm = String(month).padStart(2, "0");
                const dd = String(day).padStart(2, "0");
                const dateStr = `${year}-${mm}-${dd}`;
                const sessionColor = sessionDaysByItem.get(dateStr) ?? null;
                const isSelected = selectedDates.has(dateStr);
                return (
                  <button
                    key={dateStr}
                    onClick={() => onDayToggle(dateStr)}
                    title={dateStr}
                    className={`w-full aspect-square flex items-center justify-center text-[10px] rounded-full transition-colors
                      ${sessionColor
                        ? `${sessionColor} text-white font-semibold hover:opacity-80`
                        : isSelected
                        ? "bg-blue-500 text-white font-semibold hover:bg-blue-600"
                        : "text-gray-500 hover:bg-gray-100"
                      }`}
                  >
                    {day}
                  </button>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function buildSessionDaysMap(sessions: SessionApiRow[], seasons: SeasonRow[]): Map<string, string> {
  const result = new Map<string, string>();
  for (const session of sessions) {
    const seasonIdx = seasons.findIndex((s) => s.id === session.season_id);
    const color = SEASON_COLORS[(seasonIdx >= 0 ? seasonIdx : 0) % SEASON_COLORS.length];
    const start = new Date(session.start_date);
    const end = session.end_date ? new Date(session.end_date) : new Date(session.start_date);
    const spanDays = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;
    if (spanDays >= 365) continue;
    const cur = new Date(start);
    while (cur <= end) {
      const y = cur.getFullYear();
      const m = String(cur.getMonth() + 1).padStart(2, "0");
      const d = String(cur.getDate()).padStart(2, "0");
      result.set(`${y}-${m}-${d}`, color);
      cur.setDate(cur.getDate() + 1);
    }
  }
  return result;
}

function groupByYearMonthColored(days: Map<string, string>): Map<string, Map<string, string>> {
  const map = new Map<string, Map<string, string>>();
  for (const [d, color] of days) {
    const key = d.slice(0, 7); // YYYY-MM
    if (!map.has(key)) map.set(key, new Map());
    map.get(key)!.set(d, color);
  }
  return map;
}

export default function ItemDetailPage({ mediaId, onClose, onRefresh, onOpenPerson, onOpenDetail }: Props) {
  const [media, setMedia] = useState<MediaData | null>(null);
  const [sessions, setSessions] = useState<SessionApiRow[]>([]);
  const [seasons, setSeasons] = useState<SeasonRow[]>([]);
  const [cachedData, setCachedData] = useState<CachedData | null>(null);
  const [externalSync, setExternalSync] = useState<ExternalSyncState>({ status: "idle" });
  const [appleMusicUrlInput, setAppleMusicUrlInput] = useState("");
  const [loading, setLoading] = useState(true);
  const [seasonPickerDate, setSeasonPickerDate] = useState<string | null>(null);
  const [pendingCinema, setPendingCinema] = useState(false);
  const [addingSession, setAddingSession] = useState(false);
  const [extraMonths, setExtraMonths] = useState<Set<string>>(new Set());
  const [yearViewYear, setYearViewYear] = useState(() => new Date().getFullYear());
  const [yearSelectedDates, setYearSelectedDates] = useState<Set<string>>(new Set());
  const [yearBatchSaving, setYearBatchSaving] = useState(false);
  const [yearBatchCinema, setYearBatchCinema] = useState(false);

  // ── Split-into-seasons mode ─────────────────────────────────────────────────
  const [splitMode, setSplitMode] = useState(false);
  const [splitRangeStart, setSplitRangeStart] = useState<string | null>(null);
  const [splitRangeEnd, setSplitRangeEnd] = useState<string | null>(null);
  // When range is confirmed, show assignment dialog
  interface SplitTarget { sessionIds: number[]; dateRange: string }
  const [splitTarget, setSplitTarget] = useState<SplitTarget | null>(null);
  const [splitSeasonChoice, setSplitSeasonChoice] = useState<"existing" | "new">("new");
  const [splitExistingSeasonId, setSplitExistingSeasonId] = useState("");
  const [splitNewSeasonNumber, setSplitNewSeasonNumber] = useState("");
  const [splitNewSeasonTitle, setSplitNewSeasonTitle] = useState("");
  const [splitSaving, setSplitSaving] = useState(false);

  // ── TMDB air dates ──────────────────────────────────────────────────────────
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
  interface TmdbCandidate { tmdb_id: number; name: string; first_air_date: string; poster_path: string | null }
  const [showAirDates, setShowAirDates] = useState(false);
  const [airDateSeasons, setAirDateSeasons] = useState<AirDateSeason[]>([]);
  const [importingDates, setImportingDates] = useState<Set<string>>(new Set());
  const [showPodcastEpisodes, setShowPodcastEpisodes] = useState(false);
  const [podcastUrl, setPodcastUrl] = useState("");
  const [podcastEpisodeDates, setPodcastEpisodeDates] = useState<string[]>([]);
  const [podcastEpisodesLoading, setPodcastEpisodesLoading] = useState(false);
  const [podcastEpisodesError, setPodcastEpisodesError] = useState<string | null>(null);
  const [savingCover, setSavingCover] = useState<Set<number>>(new Set()); // tmdbSeasonNum being saved
  const [tmdbLinkSearch, setTmdbLinkSearch] = useState("");
  const [tmdbLinkCandidates, setTmdbLinkCandidates] = useState<TmdbCandidate[]>([]);
  const [tmdbLinkLoading, setTmdbLinkLoading] = useState(false);
  const [showTmdbLink, setShowTmdbLink] = useState(false);

  // Fetch all TMDB seasons for a given tmdb_id, using DB seasons for id mapping
  const fetchAllTmdbSeasons = useCallback(async (tmdbId: number, dbSeasons: SeasonRow[]) => {
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
      const dbSeason = n > 0
        ? (dbSeasons.find((s) => s.season_number === n)
            ?? (numSeasons === 1 && dbSeasons.length === 1 ? dbSeasons[0] : null)
            ?? (dbSeasons.length >= n && dbSeasons[n - 1].season_number == null ? dbSeasons[n - 1] : null))
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
  }, []);

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
    if (!media) return;
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
      await loadData();
      await fetchAllTmdbSeasons(tmdbId, seasons);
      onRefresh?.();
    } catch {
      toast("Błąd zapisu tmdb_id", "error");
    }
  };

  const loadAirDates = useCallback(async () => {
    if (!media?.tmdb_id) { toast("Brak powiązania z TMDB", "error"); return; }
    setShowAirDates(true);
    await fetchAllTmdbSeasons(media.tmdb_id, seasons);
  }, [media, seasons, fetchAllTmdbSeasons]);

  const saveSeasonCover = async (as: AirDateSeason) => {
    if (!as.seasonPosterPath || !media) return;
    setSavingCover((prev) => new Set([...prev, as.tmdbSeasonNum]));
    try {
      // Ensure season exists in DB first
      let seasonId = as.seasonId;
      if (seasonId === null) {
        // Check if a season with this season_number already exists in current state
        const existing = seasons.find((s) => s.season_number === as.tmdbSeasonNum);
        if (existing) {
          seasonId = existing.id;
          setAirDateSeasons((prev) => prev.map((a) =>
            a.tmdbSeasonNum === as.tmdbSeasonNum ? { ...a, seasonId: existing.id } : a
          ));
        } else {
          const sRes = await fetch("/api/seasons", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ media_id: media.id, season_number: as.tmdbSeasonNum }),
          });
          if (!sRes.ok) throw new Error("Błąd tworzenia sezonu");
          const sData = await sRes.json() as { id: number };
          seasonId = sData.id;
          setAirDateSeasons((prev) => prev.map((a) =>
            a.tmdbSeasonNum === as.tmdbSeasonNum ? { ...a, seasonId } : a
          ));
        }
      }

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
      await loadData();
      onRefresh?.();
    } catch (e) {
      toast(e instanceof Error ? e.message : "Błąd zapisu okładki", "error");
    } finally {
      setSavingCover((prev) => { const n = new Set(prev); n.delete(as.tmdbSeasonNum); return n; });
    }
  };


  const removePlaceholders = async (seasonId: number): Promise<number> => {
    try {
      const res = await fetch(`/api/seasons/${seasonId}/placeholders`, { method: "DELETE" });
      const data = await res.json() as { removed?: number };
      return data.removed ?? 0;
    } catch { return 0; }
  };

  const importSeasonDates = async (as: AirDateSeason, datesToImport: string[]) => {
    if (!media) return;
    const newDates = datesToImport.filter((d) => !sessionDaysMap.has(d));
    if (!newDates.length) { toast("Wszystkie daty już istnieją", "error"); return; }

    // If season doesn't exist in DB, create it first
    let seasonId = as.seasonId;
    if (seasonId === null) {
      try {
        // Check if a season with this season_number already exists in current state
        const existing = seasons.find((s) => s.season_number === as.tmdbSeasonNum);
        if (existing) {
          seasonId = existing.id;
          setAirDateSeasons((prev) => prev.map((a) =>
            a.tmdbSeasonNum === as.tmdbSeasonNum ? { ...a, seasonId: existing.id } : a
          ));
        } else {
          const sRes = await fetch("/api/seasons", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ media_id: media.id, season_number: as.tmdbSeasonNum }),
          });
          if (!sRes.ok) throw new Error();
          const sData = await sRes.json() as { id: number };
          seasonId = sData.id;
          // Update local state so subsequent imports use correct id
          setAirDateSeasons((prev) => prev.map((a) =>
            a.tmdbSeasonNum === as.tmdbSeasonNum ? { ...a, seasonId } : a
          ));
        }
      } catch {
        toast(`Błąd tworzenia sezonu ${as.tmdbSeasonNum}`, "error");
        return;
      }
    }

    // Auto-remove placeholder (YYYY-01-01→YYYY-12-31) for this season before adding real sessions
    await removePlaceholders(seasonId);

    let added = 0;
    setImportingDates((prev) => new Set([...prev, ...newDates]));
    for (const date of newDates) {
      try {
        const res = await fetch("/api/sessions", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ season_id: seasonId, start_date: date, end_date: date, cinema: false }),
        });
        if (res.ok) added++;
      } catch { /* skip */ }
    }
    setImportingDates((prev) => { const n = new Set(prev); newDates.forEach((d) => n.delete(d)); return n; });
    toast(`Dodano ${added} sesji ✓`, "success");
    await loadData();
    onRefresh?.();
  };

  const fetchPodcastEpisodes = useCallback(async (url: string) => {
    setPodcastEpisodesLoading(true);
    setPodcastEpisodesError(null);
    setPodcastEpisodeDates([]);
    try {
      const res = await fetch(`/api/podcast/episodes?url=${encodeURIComponent(url)}`);
      const data = await res.json() as { dates?: string[]; error?: string };
      if (!res.ok || data.error) { setPodcastEpisodesError(data.error ?? "Błąd"); return; }
      setPodcastEpisodeDates(data.dates ?? []);
    } catch {
      setPodcastEpisodesError("Błąd sieci");
    } finally {
      setPodcastEpisodesLoading(false);
    }
  }, []);

  const [editingSession, setEditingSession] = useState<SessionApiRow | null>(null);
  const [editStartDate, setEditStartDate] = useState("");
  const [editEndDate, setEditEndDate] = useState("");
  const [editCinema, setEditCinema] = useState(false);
  const [editSeasonId, setEditSeasonId] = useState("");
  const [editSaving, setEditSaving] = useState(false);
  const [editEpisodeCount, setEditEpisodeCount] = useState("");

  // ── Edit media state ────────────────────────────────────────────────────────
  const [isEditingMedia, setIsEditingMedia] = useState(false);
  const [mediaEditForm, setMediaEditForm] = useState({
    title: "",
    original_title: "",
    author: "",
    description: "",
    tags: "",
    cover_url: "",
    discontinued: false,
    tmdb_id: "",
    ol_key: "",
    media_type: "",
    source_url: "",
  });
  const [mediaEditSaving, setMediaEditSaving] = useState(false);
  const [uploadingCover, setUploadingCover] = useState(false);
  const [lcEditUrl, setLcEditUrl] = useState("");
  const [lcEditLoading, setLcEditLoading] = useState(false);

  // ── VOD offers ──────────────────────────────────────────────────────────────
  type VodOffer = {
    id: number; provider_name: string; provider_logo: string | null;
    provider_slug: string; monetization_type: string; quality: string | null;
    url: string | null; available_to: string | null; last_checked_at: string | null;
  };
  const [vodOffers, setVodOffers] = useState<VodOffer[]>([]);
  const [vodLastChecked, setVodLastChecked] = useState<string | null>(null);
  const [vodLoading, setVodLoading] = useState(false);

  const fetchVodOffers = useCallback(async (id: number) => {
    const res = await fetch(`/api/vod/offers?itemType=media&itemId=${id}`);
    if (res.ok) {
      const data = await res.json() as { offers: VodOffer[]; lastCheckedAt: string | null };
      setVodOffers(data.offers);
      setVodLastChecked(data.lastCheckedAt);
    }
  }, []);

  const checkVod = useCallback(async (m: MediaData) => {
    setVodLoading(true);
    try {
      const res = await fetch("/api/vod/check", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          itemType: "media",
          itemId: m.id,
          title: m.title,
          year: m.release_year,
          tmdbId: m.tmdb_id,
          mediaType: m.media_type,
        }),
      });
      if (!res.ok) throw new Error("Błąd sprawdzania VOD");
      await fetchVodOffers(m.id);
      toast("Sprawdzono dostępność VOD ✓", "success");
    } catch {
      toast("Nie udało się sprawdzić VOD", "error");
    } finally {
      setVodLoading(false);
    }
  }, [fetchVodOffers]);

  // ── Universe assignment ─────────────────────────────────────────────────────
  const [showUniversePanel, setShowUniversePanel] = useState(false);
  const [universesList, setUniversesList] = useState<{ id: number; name: string }[]>([]);
  const [universeSearch, setUniverseSearch] = useState("");
  const [newUniverseName, setNewUniverseName] = useState("");
  const [savingUniverse, setSavingUniverse] = useState(false);
  const [universeMembers, setUniverseMembers] = useState<{ id: number; title: string; cover_url: string | null; media_type: string }[]>([]);

  useEffect(() => {
    if (!media?.universe_id) { setUniverseMembers([]); return; }
    fetch(`/api/universes/${media.universe_id}`)
      .then((r) => r.ok ? r.json() : null)
      .then((data) => { if (data?.media) setUniverseMembers(data.media); });
  }, [media?.universe_id]);

  const handleLcEditFetch = async () => {
    if (!lcEditUrl.trim()) return;
    setLcEditLoading(true);
    try {
      const res = await fetch("/api/scrape/lubimyczytac", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: lcEditUrl.trim() }),
      });
      const data = await res.json();
      if (!res.ok) { toast(data.error ?? "Błąd scrapowania", "error"); return; }
      setMediaEditForm((f) => ({
        ...f,
        title: data.title || f.title,
        original_title: data.original_title || f.original_title,
        author: data.author || f.author,
        cover_url: data.cover_url || f.cover_url,
        description: data.description || f.description,
      }));
      toast("Dane pobrane ✓", "success");
    } catch {
      toast("Błąd połączenia", "error");
    } finally {
      setLcEditLoading(false);
    }
  };

  // ── Edit season state ───────────────────────────────────────────────────────
  const [editingSeason, setEditingSeason] = useState<SeasonRow | null>(null);
  const [seasonEditForm, setSeasonEditForm] = useState({
    season_number: "",
    title: "",
    cover_url: "",
  });
  const [seasonEditSaving, setSeasonEditSaving] = useState(false);
  const [uploadingSeason, setUploadingSeason] = useState(false);

  // ── Add season state ────────────────────────────────────────────────────────
  const [showAddSeason, setShowAddSeason] = useState(false);
  const [addSeasonForm, setAddSeasonForm] = useState({ season_number: "", title: "" });
  const [addSeasonLoading, setAddSeasonLoading] = useState(false);

  const openEditSession = useCallback((session: SessionApiRow) => {
    setEditingSession(session);
    setEditStartDate(session.start_date);
    setEditEndDate(session.end_date ?? session.start_date);
    setEditCinema(Boolean(session.cinema));
    setEditSeasonId(String(session.season_id));
  }, []);

  const handleSaveSession = async () => {
    if (!editingSession) return;
    if (editEndDate && editEndDate < editStartDate) {
      toast("Data końca nie może być wcześniej niż data początku", "error");
      return;
    }
    setEditSaving(true);
    try {
      const res = await fetch(`/api/sessions/${editingSession.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          start_date: editStartDate,
          end_date: editEndDate || null,
          cinema: editCinema,
          season_id: parseInt(editSeasonId),
        }),
      });
      if (!res.ok) throw new Error();
      toast("Sesja zapisana ✓", "success");
      setEditingSession(null);
      await loadData();
      onRefresh?.();
    } catch {
      toast("Błąd zapisu", "error");
    } finally {
      setEditSaving(false);
    }
  };

  const handleDeleteEditingSession = async () => {
    if (!editingSession) return;
    if (!confirm("Usunąć tę sesję?")) return;
    try {
      const res = await fetch(`/api/sessions/${editingSession.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error();
      toast("Sesja usunięta ✓", "success");
      setEditingSession(null);
      await loadData();
      onRefresh?.();
    } catch {
      toast("Błąd usuwania", "error");
    }
  };

  const openEditMedia = useCallback((m: MediaData) => {
    setMediaEditForm({
      title: m.title,
      original_title: m.original_title ?? "",
      author: m.author ?? "",
      description: m.description ?? "",
      tags: m.tags ?? "",
      cover_url: m.cover_url ?? "",
      discontinued: !!(m.discontinued),
      tmdb_id: m.tmdb_id != null ? String(m.tmdb_id) : "",
      ol_key: m.ol_key ?? "",
      media_type: m.media_type,
      source_url: m.source_url ?? "",
    });
    setIsEditingMedia(true);
  }, []);

  const handleSaveMedia = async () => {
    if (!media) return;
    setMediaEditSaving(true);
    try {
      const res = await fetch(`/api/media/${mediaId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: mediaEditForm.title,
          original_title: mediaEditForm.original_title || null,
          author: mediaEditForm.author || null,
          media_type: mediaEditForm.media_type,
          cover_url: mediaEditForm.cover_url || null,
          description: mediaEditForm.description || null,
          tags: mediaEditForm.tags || null,
          discontinued: mediaEditForm.discontinued,
          tmdb_id: mediaEditForm.tmdb_id ? parseInt(mediaEditForm.tmdb_id) : null,
          ol_key: mediaEditForm.ol_key || null,
          source_url: mediaEditForm.source_url || null,
        }),
      });
      if (!res.ok) throw new Error();
      toast("Zapisano medium ✓", "success");
      setIsEditingMedia(false);
      await loadData();
      onRefresh?.();
    } catch {
      toast("Błąd zapisu", "error");
    } finally {
      setMediaEditSaving(false);
    }
  };

  const openEditSeason = useCallback((s: SeasonRow) => {
    setEditingSeason(s);
    setSeasonEditForm({
      season_number: s.season_number != null ? String(s.season_number) : "",
      title: s.title ?? "",
      cover_url: s.cover_url ?? "",
    });
  }, []);

  const handleSaveSeason = async () => {
    if (!editingSeason) return;
    setSeasonEditSaving(true);
    try {
      const res = await fetch(`/api/seasons/${editingSeason.id}`, {
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
      setEditingSeason(null);
      await loadData();
      onRefresh?.();
    } catch {
      toast("Błąd zapisu sezonu", "error");
    } finally {
      setSeasonEditSaving(false);
    }
  };

  const handleAddSeason = async () => {
    setAddSeasonLoading(true);
    try {
      const res = await fetch("/api/seasons", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          media_id: mediaId,
          season_number: addSeasonForm.season_number ? parseInt(addSeasonForm.season_number) : null,
          title: addSeasonForm.title || null,
        }),
      });
      if (!res.ok) throw new Error();
      toast("Sezon dodany ✓", "success");
      setShowAddSeason(false);
      setAddSeasonForm({ season_number: "", title: "" });
      await loadData();
      onRefresh?.();
    } catch {
      toast("Błąd dodawania sezonu", "error");
    } finally {
      setAddSeasonLoading(false);
    }
  };

  const loadData = useCallback(async () => {
    try {
      const [mediaRes, sessionsRes, seasonsRes] = await Promise.all([
        fetch(`/api/media/${mediaId}`),
        fetch(`/api/sessions?media_id=${mediaId}`),
        fetch(`/api/seasons?media_id=${mediaId}`),
      ]);
      const [mediaData, sessionsData, seasonsData] = await Promise.all([
        mediaRes.ok ? mediaRes.json() : null,
        sessionsRes.ok ? sessionsRes.json() : [],
        seasonsRes.ok ? seasonsRes.json() : [],
      ]);
      if (mediaData) setMedia(mediaData as MediaData);
      if (Array.isArray(sessionsData)) setSessions(sessionsData as SessionApiRow[]);
      if (Array.isArray(seasonsData)) setSeasons(seasonsData as SeasonRow[]);
    } catch {
      toast("Błąd ładowania danych", "error");
    } finally {
      setLoading(false);
    }
  }, [mediaId]);

  const loadExternalData = useCallback(async (currentMedia?: MediaData | null) => {
    try {
      const res = await fetch(`/api/media/${mediaId}/external`);
      if (res.ok) {
        let data = (await res.json()) as CachedData;
        // Auto-create person record from media.author if not yet linked
        if (data.persons.length === 0 && currentMedia?.author) {
          const role = BOOK_TYPES.includes(currentMedia.media_type) ? "author" : "director";
          await fetch(`/api/media/${mediaId}/external`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              tmdb_id: currentMedia.tmdb_id ?? null,
              ol_key: currentMedia.ol_key ?? null,
              description: null, genres: [], vote_average: null, runtime: null, release_year: null,
              persons: [{ name: currentMedia.author, role, display_order: 0 }],
            }),
          });
          const res2 = await fetch(`/api/media/${mediaId}/external`);
          if (res2.ok) data = (await res2.json()) as CachedData;
        }
        setCachedData(data);
        if (data.externalSyncedAt) setExternalSync({ status: "done" });
      }
    } catch {
      // ignore external data errors
    }
  }, [mediaId]);

  const loadUniverses = useCallback(async () => {
    const res = await fetch("/api/universes");
    if (res.ok) setUniversesList(await res.json());
  }, []);

  const handleAssignUniverse = useCallback(async (universeId: number | null) => {
    if (!media) return;
    setSavingUniverse(true);
    try {
      const res = await fetch(`/api/media/${mediaId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ universe_id: universeId }),
      });
      if (!res.ok) throw new Error();
      toast(universeId ? "Przypisano do uniwersum ✓" : "Usunięto z uniwersum ✓", "success");
      setShowUniversePanel(false);
      setUniverseSearch("");
      setNewUniverseName("");
      await loadData();
    } catch {
      toast("Błąd zapisu", "error");
    } finally {
      setSavingUniverse(false);
    }
  }, [media, mediaId, loadData]);

  const handleCreateAndAssignUniverse = useCallback(async () => {
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
  }, [newUniverseName, handleAssignUniverse]);

  const buildPersons = useCallback((data: TmdbInfoResult) => {
    const result: Array<{
      name: string; role: string; character_name?: string;
      display_order?: number; photo_url?: string | null; tmdb_id?: number | null;
    }> = [];
    if ("cast" in data) {
      result.push(...data.cast.map((c, i) => ({
        name: c.name, role: "actor", character_name: c.character,
        display_order: i, photo_url: c.profile_path,
      })));
    }
    if ("director" in data && data.director) {
      result.push({ name: data.director, role: "director", display_order: 0 });
    }
    if ("created_by" in data && data.created_by) {
      result.push(...data.created_by.map((c, i) => ({ name: c.name, role: "creator", display_order: i })));
    }
    return result;
  }, []);

  const saveExternalData = useCallback(async (data: TmdbInfoResult) => {
    const isTvData = "first_air_date" in data;
    const dateStr = data.release_date ?? data.first_air_date;
    const releaseYear = dateStr ? parseInt(dateStr.slice(0, 4)) || null : null;

    const body = {
      tmdb_id: data.tmdb_id,
      ol_key: null,
      description: data.overview,
      genres: data.genres,
      vote_average: data.vote_average,
      runtime: !isTvData ? data.runtime : null,
      release_year: releaseYear,
      series_status: isTvData ? (data.status ?? null) : null,
      tmdb_seasons_count: isTvData ? (data.number_of_seasons ?? null) : null,
      persons: buildPersons(data),
    };

    await fetch(`/api/media/${mediaId}/external`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const res = await fetch(`/api/media/${mediaId}/external`);
    if (res.ok) {
      const cached = await res.json() as CachedData;
      setCachedData(cached);
      setExternalSync({ status: "done" });
    }

    // Download cover from TMDB
    if (data.poster_url) {
      try {
        const dlRes = await fetch("/api/cover/download", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ url: data.poster_url }),
        });
        if (dlRes.ok) {
          const { path } = await dlRes.json() as { path: string };
          await fetch(`/api/media/${mediaId}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              title: media?.title, original_title: media?.original_title ?? "",
              author: media?.author ?? "", media_type: media?.media_type,
              cover_url: path, tags: media?.tags,
              discontinued: media?.discontinued, tmdb_id: media?.tmdb_id, ol_key: media?.ol_key,
            }),
          });
          setMedia((prev) => prev ? { ...prev, cover_url: path } : prev);
          onRefresh?.();
        }
      } catch { /* ignore */ }
    }
  }, [mediaId, media, buildPersons, onRefresh]);

  const syncFromTmdb = useCallback(async (tmdbId?: number) => {
    if (!media) return;
    setExternalSync({ status: "loading" });
    try {
      const params = new URLSearchParams({ type: media.media_type });
      if (tmdbId) {
        params.set("tmdb_id", String(tmdbId));
      } else if (media.tmdb_id) {
        params.set("tmdb_id", String(media.tmdb_id));
      } else {
        params.set("title", media.title);
        if (media.original_title) params.set("original_title", media.original_title);
      }
      const res = await fetch(`/api/tmdb/info?${params}`);
      const data = await res.json() as { candidates?: TmdbCandidate[] } & TmdbInfoResult;
      if (!res.ok) { setExternalSync({ status: "error", message: (data as unknown as { error: string }).error ?? "Błąd TMDB" }); return; }
      if (data.candidates) { setExternalSync({ status: "tmdb_candidates", candidates: data.candidates }); return; }
      await saveExternalData(data);
    } catch {
      setExternalSync({ status: "error", message: "Błąd sieci" });
    }
  }, [media, saveExternalData]);

  const syncFromItunes = useCallback(async (itunesId?: number, appleMusicUrl?: string) => {
    if (!media) return;
    setExternalSync({ status: "loading" });
    try {
      const params = new URLSearchParams({ type: media.media_type });
      if (appleMusicUrl) {
        params.set("apple_music_url", appleMusicUrl);
      } else if (itunesId) {
        params.set("itunes_id", String(itunesId));
      } else {
        params.set("title", media.original_title ?? media.title);
        if (media.author) params.set("artist", media.author);
      }
      const res = await fetch(`/api/itunes/info?${params}`);
      const data = await res.json() as {
        error?: string;
        candidates?: ItunesCandidate[];
        description?: string;
        genres?: string[];
        release_year?: number;
        cover_url?: string;
        itunes_id?: number;
        tracks?: Array<{ number: number; title: string; duration_ms: number | null }> | null;
      };
      if (!res.ok) { setExternalSync({ status: "error", message: data.error ?? "Błąd iTunes" }); return; }
      if (data.candidates) { setExternalSync({ status: "itunes_candidates", candidates: data.candidates }); return; }

      await fetch(`/api/media/${mediaId}/external`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tmdb_id: null,
          ol_key: data.itunes_id ? `itunes:${data.itunes_id}` : null,
          description: data.description ?? null,
          genres: data.genres ?? [],
          vote_average: null,
          runtime: null,
          release_year: data.release_year ?? null,
          track_list: data.tracks ?? null,
          persons: [],
        }),
      });
      const refreshRes = await fetch(`/api/media/${mediaId}/external`);
      if (refreshRes.ok) {
        const cached = await refreshRes.json() as CachedData;
        setCachedData(cached);
        setExternalSync({ status: "done" });
      }
      // Download cover
      if (data.cover_url) {
        try {
          const dlRes = await fetch("/api/cover/download", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ url: data.cover_url }),
          });
          if (dlRes.ok) {
            const { path } = await dlRes.json() as { path: string };
            await fetch(`/api/media/${mediaId}`, {
              method: "PUT",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                title: media.title, original_title: media.original_title ?? "",
                author: media.author ?? "", media_type: media.media_type,
                cover_url: path, tags: media.tags,
                discontinued: media.discontinued, tmdb_id: media.tmdb_id, ol_key: media.ol_key,
              }),
            });
            setMedia((prev) => prev ? { ...prev, cover_url: path } : prev);
            onRefresh?.();
          }
        } catch { /* ignore */ }
      }
    } catch {
      setExternalSync({ status: "error", message: "Błąd sieci" });
    }
  }, [media, mediaId, onRefresh]);

  const triggerSync = useCallback(() => {
    if (!media) return;
    if (SCREEN_TYPES.includes(media.media_type)) syncFromTmdb();
    else if (ITUNES_TYPES.includes(media.media_type)) syncFromItunes();
  }, [media, syncFromTmdb, syncFromItunes]);

  useEffect(() => {
    const init = async () => {
      await loadData();
      // Pass media via ref to avoid stale closure
    };
    init();
  }, [loadData]);

  // Load external data once media is available
  const prevMediaIdRef = useRef<number | null>(null);
  useEffect(() => {
    if (!media) return;
    if (prevMediaIdRef.current === mediaId) return;
    prevMediaIdRef.current = mediaId;
    loadExternalData(media);
    // Load VOD offers for screen media types
    if (["movie", "series", "anime", "cartoon"].includes(media.media_type)) {
      void fetchVodOffers(media.id);
    }
  }, [media, mediaId, loadExternalData, fetchVodOffers]);

  const addSession = useCallback(
    async (date: string, seasonId: number) => {
      setAddingSession(true);
      try {
        await removePlaceholders(seasonId);
        const res = await fetch("/api/sessions", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            season_id: seasonId,
            start_date: date,
            end_date: date,
            cinema: pendingCinema,
          }),
        });
        if (!res.ok) throw new Error();
        toast("Dodano sesję ✓", "success");
        await loadData();
        onRefresh?.();
      } catch {
        toast("Błąd zapisu sesji", "error");
      } finally {
        setAddingSession(false);
        setSeasonPickerDate(null);
        setPendingCinema(false);
      }
    },
    [loadData, onRefresh, pendingCinema]
  );

  const sessionDaysMap = useMemo(
    () => buildSessionDaysMap(sessions, seasons),
    [sessions, seasons]
  );

  const importPodcastDates = useCallback(async (dates: string[]) => {
    if (!media) return;
    const newDates = dates.filter((d) => !sessionDaysMap.has(d));
    if (!newDates.length) { toast("Wszystkie daty już istnieją", "error"); return; }

    let seasonId = seasons[0]?.id ?? null;
    if (seasonId === null) {
      try {
        const sRes = await fetch("/api/seasons", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ media_id: media.id, season_number: 1 }),
        });
        if (!sRes.ok) throw new Error();
        const sData = await sRes.json() as { id: number };
        seasonId = sData.id;
      } catch {
        toast("Błąd tworzenia sezonu", "error");
        return;
      }
    }

    await removePlaceholders(seasonId);

    let added = 0;
    setImportingDates((prev) => new Set([...prev, ...newDates]));
    for (const date of newDates) {
      try {
        const res = await fetch("/api/sessions", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ season_id: seasonId, start_date: date, end_date: date, cinema: false }),
        });
        if (res.ok) added++;
      } catch { /* skip */ }
    }
    setImportingDates((prev) => { const n = new Set(prev); newDates.forEach((d) => n.delete(d)); return n; });
    toast(`Dodano ${added} sesji ✓`, "success");
    await loadData();
    onRefresh?.();
  }, [media, seasons, sessionDaysMap, loadData, onRefresh]);

  /** True when every session is a year-long placeholder (YYYY-01-01 → YYYY-12-31). */
  const isOnlyPlaceholders = useMemo(
    () =>
      sessions.length > 0 &&
      sessions.every(
        (s) =>
          s.start_date.endsWith("-01-01") &&
          s.end_date === `${s.start_date.slice(0, 4)}-12-31`
      ),
    [sessions]
  );

  // When only placeholders are present, jump yearViewYear to the placeholder's year.
  useEffect(() => {
    if (isOnlyPlaceholders) {
      setYearViewYear(parseInt(sessions[0].start_date.slice(0, 4)));
    }
  }, [isOnlyPlaceholders, sessions]);

  const handleYearBatchCreate = useCallback(async () => {
    if (yearSelectedDates.size === 0) return;
    setYearBatchSaving(true);
    try {
      let seasonId: number;
      if (seasons.length === 0) {
        const noSeasonNumber = media?.media_type === "movie" || BOOK_TYPES.includes(media?.media_type ?? "");
        const res = await fetch("/api/seasons", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ media_id: mediaId, season_number: noSeasonNumber ? null : 1, title: null }),
        });
        if (!res.ok) throw new Error("Failed to create season");
        const data = await res.json() as { id: number };
        seasonId = data.id;
        await loadData();
      } else {
        seasonId = seasons[0].id;
      }
      // Remove year-placeholder before adding real sessions
      await removePlaceholders(seasonId);
      const dates = Array.from(yearSelectedDates).sort();
      let added = 0;
      for (const date of dates) {
        const res = await fetch("/api/sessions", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ season_id: seasonId, start_date: date, end_date: date, cinema: yearBatchCinema }),
        });
        if (res.ok) added++;
      }
      toast(`Dodano ${added} sesji ✓`, "success");
      setYearSelectedDates(new Set());
      await loadData();
      onRefresh?.();
    } catch {
      toast("Błąd zapisu sesji", "error");
    } finally {
      setYearBatchSaving(false);
    }
  }, [yearSelectedDates, seasons, mediaId, loadData, onRefresh, yearBatchCinema]);

  // Map each calendar date to the session it belongs to (for click-to-edit)
  const dateToSessionMap = useMemo(() => {
    const m = new Map<string, SessionApiRow>();
    for (const session of sessions) {
      const start = new Date(session.start_date);
      const end = session.end_date ? new Date(session.end_date) : new Date(session.start_date);
      const spanDays = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;
      if (spanDays >= 365) continue;
      const cur = new Date(start);
      while (cur <= end) {
        const dateStr = cur.toISOString().slice(0, 10);
        if (!m.has(dateStr)) m.set(dateStr, session);
        cur.setDate(cur.getDate() + 1);
      }
    }
    return m;
  }, [sessions]);

  const handleDayClick = useCallback(
    async (date: string) => {
      // In split mode: select range
      if (splitMode) {
        if (!splitRangeStart) {
          setSplitRangeStart(date);
          setSplitRangeEnd(date);
        } else if (!splitTarget) {
          const start = splitRangeStart <= date ? splitRangeStart : date;
          const end = splitRangeStart <= date ? date : splitRangeStart;
          // Find sessions whose start_date falls in [start, end]
          const inRange = sessions.filter((s) => {
            const sessionEnd = s.end_date ?? s.start_date;
            return s.start_date <= end && sessionEnd >= start;
          });
          if (inRange.length === 0) {
            toast("Brak sesji w tym zakresie", "error");
            setSplitRangeStart(null); setSplitRangeEnd(null);
            return;
          }
          setSplitTarget({ sessionIds: inRange.map((s) => s.id), dateRange: `${start} – ${end}` });
        }
        return;
      }

      if (sessionDaysMap.has(date)) {
        // Open edit for the session that covers this date
        const session = dateToSessionMap.get(date);
        if (session) openEditSession(session);
        return;
      }
      if (seasons.length === 0) {
        // Auto-create default season then add session
        try {
          const noSeasonNumber = media?.media_type === "movie" || BOOK_TYPES.includes(media?.media_type ?? "");
          const r = await fetch("/api/seasons", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ media_id: mediaId, season_number: noSeasonNumber ? null : 1, title: null }),
          });
          if (!r.ok) { toast("Błąd tworzenia sezonu", "error"); return; }
          const newSeason = await r.json() as { id: number };
          addSession(date, newSeason.id);
        } catch {
          toast("Błąd tworzenia sezonu", "error");
        }
        return;
      }
      if (seasons.length === 1) {
        setSeasonPickerDate(date);
      } else {
        setSeasonPickerDate(date);
      }
    },
    [splitMode, splitRangeStart, splitTarget, sessions, sessionDaysMap, dateToSessionMap, seasons, addSession, openEditSession, mediaId]
  );

  const handleSplitDayHover = (date: string) => {
    if (splitMode && splitRangeStart && !splitTarget) setSplitRangeEnd(date);
  };

  const handleSplitAssign = async () => {
    if (!splitTarget || !media) return;
    setSplitSaving(true);
    try {
      const body: Record<string, unknown> = { session_ids: splitTarget.sessionIds };
      if (splitSeasonChoice === "existing" && splitExistingSeasonId) {
        body.target_season_id = parseInt(splitExistingSeasonId);
      } else {
        body.new_season = {
          media_id: media.id,
          season_number: splitNewSeasonNumber ? parseInt(splitNewSeasonNumber) : undefined,
          title: splitNewSeasonTitle || undefined,
        };
      }
      const res = await fetch("/api/sessions/reassign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error();
      toast("Przeniesiono sesje ✓", "success");
      setSplitTarget(null); setSplitRangeStart(null); setSplitRangeEnd(null);
      setSplitNewSeasonNumber(""); setSplitNewSeasonTitle(""); setSplitExistingSeasonId("");
      await loadData();
      onRefresh?.();
    } catch {
      toast("Błąd przenoszenia", "error");
    } finally {
      setSplitSaving(false);
    }
  };

  const handleMergeSeason = async (seasonId: number) => {
    const res = await fetch(`/api/seasons/${seasonId}/merge-sessions`, { method: "POST" });
    if (res.ok) {
      const data = await res.json() as { merged: number };
      toast(data.merged > 0 ? `Scalono ${data.merged} sesji ✓` : "Brak sesji do scalenia", data.merged > 0 ? "success" : "error");
      if (data.merged > 0) { await loadData(); onRefresh?.(); }
    } else {
      toast("Błąd scalania", "error");
    }
  };

  const handleDeleteSeason = async (seasonId: number) => {
    if (!confirm("Usunąć sezon wraz z wszystkimi sesjami?")) return;
    const res = await fetch(`/api/seasons/${seasonId}`, { method: "DELETE" });
    if (res.ok) {
      toast("Sezon usunięty ✓", "success");
      await loadData();
      onRefresh?.();
    } else {
      toast("Błąd usuwania", "error");
    }
  };

  const handleDeleteMedia = async () => {
    if (!media) return;
    if (!confirm(`Usunąć "${media.title}"? Operacja jest nieodwracalna.`)) return;
    const res = await fetch(`/api/media/${media.id}`, { method: "DELETE" });
    if (res.ok) {
      toast("Medium usunięte ✓", "success");
      onRefresh?.();
      onClose?.();
    } else {
      toast("Błąd usuwania", "error");
    }
  };

  const handleToggleWantToWatch = async (season: SeasonRow) => {
    const newValue = !season.want_to_watch;
    try {
      const res = await fetch(`/api/seasons/${season.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          season_number: season.season_number,
          title: season.title,
          cover_url: season.cover_url,
          want_to_watch: newValue,
        }),
      });
      if (!res.ok) throw new Error();
      await loadData();
    } catch {
      toast("Błąd zapisu", "error");
    }
  };

  // Build a special sessionDaysMap for split mode that highlights the hover range
  const splitHighlightMap = useMemo(() => {
    if (!splitMode || !splitRangeStart) return null;
    const end = splitRangeEnd ?? splitRangeStart;
    const [a, b] = splitRangeStart <= end ? [splitRangeStart, end] : [end, splitRangeStart];
    const m = new Map<string, string>();
    const cur = new Date(a);
    const endDate = new Date(b);
    while (cur <= endDate) {
      m.set(cur.toISOString().slice(0, 10), "bg-amber-400");
      cur.setDate(cur.getDate() + 1);
    }
    return m;
  }, [splitMode, splitRangeStart, splitRangeEnd]);

  // Merge base map with split highlight
  const displayDaysMap = useMemo(() => {
    if (!splitHighlightMap) return sessionDaysMap;
    const merged = new Map(sessionDaysMap);
    for (const [d, c] of splitHighlightMap) merged.set(d, c);
    return merged;
  }, [sessionDaysMap, splitHighlightMap]);

  const grouped = useMemo(() => groupByYearMonthColored(displayDaysMap), [displayDaysMap]);
  const sortedMonths = useMemo(() => {
    const fromData = new Set(grouped.keys());
    const all = new Set([...fromData, ...extraMonths]);
    return Array.from(all).sort();
  }, [grouped, extraMonths]);

  const addMonth = (ym: string) => setExtraMonths((prev) => new Set([...prev, ym]));

  const currentYearMonth = (() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  })();

  // Month after the last session (or next calendar month if no sessions)
  const nextAfterLastSession = useMemo(() => {
    const dates = sessions
      .flatMap((s) => [s.start_date, s.end_date].filter(Boolean) as string[])
      .sort();
    const lastDate = dates.at(-1);
    const base = lastDate ? new Date(lastDate) : new Date();
    const next = new Date(base.getFullYear(), base.getMonth() + 1, 1);
    return `${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, "0")}`;
  }, [sessions]);

  const icon = media ? MEDIA_TYPE_ICONS[media.media_type] : null;
  const color = media
    ? (MEDIA_TYPE_COLORS[media.media_type] ?? "bg-gray-100 text-gray-700")
    : "bg-gray-100 text-gray-700";
  const label = media ? (MEDIA_TYPE_LABELS[media.media_type] ?? media.media_type) : "";

  const directors =
    cachedData?.persons.filter((p) => p.role === "director" || p.role === "creator") ?? [];
  const actors = cachedData?.persons.filter((p) => p.role === "actor") ?? [];
  const authorPersons = cachedData?.persons.filter((p) => p.role === "author") ?? [];

  const displayAuthor =
    media?.author ||
    (directors.length > 0 ? directors.map((d) => d.name).join(", ") : null) ||
    (authorPersons.length > 0 ? authorPersons.map((a) => a.name).join(", ") : null);

  const releaseYear = cachedData?.releaseYear ?? media?.release_year;
  const voteAverage = cachedData?.voteAverage ?? media?.vote_average;
  const description = cachedData?.description ?? media?.description;
  const genres =
    cachedData?.genres ??
    (media?.genres
      ? media.genres
          .split(",")
          .map((g) => g.trim())
          .filter(Boolean)
      : []);

  if (loading) {
    return (
      <div className="fixed inset-0 z-50 overflow-y-auto bg-white flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-sm text-gray-500">Ładowanie...</p>
        </div>
      </div>
    );
  }

  if (!media) {
    return (
      <div className="fixed inset-0 z-50 overflow-y-auto bg-white flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-500 mb-4">Nie znaleziono pozycji</p>
          <button onClick={() => onClose?.()} className="text-sm text-blue-600 hover:underline">
            Wróć
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-white">
      {/* Season picker overlay */}
      {seasonPickerDate && (
        <div className="fixed inset-0 z-[60] bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl p-5 max-w-sm w-full space-y-3">
            <h3 className="text-sm font-semibold text-gray-900">Dodaj sesję</h3>
            <p className="text-xs text-gray-500">{seasonPickerDate}</p>
            {/* Cinema toggle — only for movies */}
            {media.media_type === "movie" && (
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={pendingCinema}
                onChange={(e) => setPendingCinema(e.target.checked)}
                className="w-4 h-4 accent-yellow-500"
              />
              <span className="text-sm text-gray-700">🎟️ Oglądane w kinie</span>
            </label>
            )}
            {seasons.length > 1 && (
              <p className="text-xs font-medium text-gray-500 pt-1">Wybierz sezon:</p>
            )}
            <div className="space-y-2">
              {seasons.map((s, idx) => (
                <button
                  key={s.id}
                  onClick={() => addSession(seasonPickerDate, s.id)}
                  disabled={addingSession}
                  className="flex items-center gap-2 w-full text-left px-3 py-2 rounded-lg border border-gray-200 hover:bg-gray-50 text-sm transition-colors disabled:opacity-50"
                >
                  <span
                    className={`w-2.5 h-2.5 rounded-full shrink-0 ${SEASON_COLORS[idx % SEASON_COLORS.length]}`}
                  />
                  <span className="font-medium">
                    {seasonLabel(s, idx)}
                  </span>
                  {s.session_count > 0 && (
                    <span className="ml-auto text-xs text-gray-400">{s.session_count} sesji</span>
                  )}
                </button>
              ))}
            </div>
            <button
              onClick={() => { setSeasonPickerDate(null); setPendingCinema(false); }}
              className="text-xs text-gray-400 hover:text-gray-600 w-full text-center pt-1"
            >
              Anuluj
            </button>
          </div>
        </div>
      )}

      {/* Edit session modal */}
      {editingSession && (
        <div className="fixed inset-0 z-[60] bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl p-5 max-w-sm w-full space-y-4">
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
                <label className="block text-xs text-gray-500 mb-1">Sezon</label>
                <select
                  value={editSeasonId}
                  onChange={(e) => setEditSeasonId(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-sm"
                >
                  {seasons.map((s, idx) => (
                    <option key={s.id} value={s.id}>
                      {s.title ?? (s.season_number != null ? `Sezon ${s.season_number}` : `Sezon ${idx + 1}`)}
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
            </div>
            <div className="flex gap-2 pt-1">
              <button
                onClick={handleSaveSession}
                disabled={editSaving}
                className="flex-1 bg-blue-600 text-white rounded-lg py-2 text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
              >
                {editSaving ? "Zapisuję..." : "Zapisz"}
              </button>
              <button
                onClick={handleDeleteEditingSession}
                className="px-3 py-2 bg-red-50 border border-red-200 text-red-600 rounded-lg text-sm hover:bg-red-100"
              >
                🗑️
              </button>
              <button
                onClick={() => setEditingSession(null)}
                className="px-3 py-2 bg-gray-100 text-gray-600 rounded-lg text-sm hover:bg-gray-200"
              >
                Anuluj
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit media modal */}
      {isEditingMedia && (
        <div className="fixed inset-0 z-[60] bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl p-5 max-w-md w-full space-y-3 max-h-[90vh] overflow-y-auto">
            <h3 className="text-sm font-semibold text-gray-900">Edytuj medium</h3>
            {/* lubimyczytac.pl quick-fill */}
            <div className="flex gap-2 pb-1 border-b border-gray-100">
              <input
                type="url"
                value={lcEditUrl}
                onChange={(e) => setLcEditUrl(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleLcEditFetch()}
                placeholder="Uzupełnij z lubimyczytac.pl (URL)…"
                className="flex-1 border border-gray-200 rounded-lg px-3 py-1.5 text-xs focus:ring-2 focus:ring-orange-200 focus:outline-none"
              />
              <button
                onClick={handleLcEditFetch}
                disabled={lcEditLoading || !lcEditUrl.trim()}
                className="shrink-0 bg-orange-500 text-white px-3 py-1.5 rounded-lg text-xs hover:bg-orange-600 disabled:opacity-50"
              >
                {lcEditLoading ? "⏳" : "📚 Pobierz"}
              </button>
            </div>
            <div>
              <label className="text-xs font-medium text-gray-600 block mb-1">Tytuł *</label>
              <input
                type="text"
                value={mediaEditForm.title}
                onChange={(e) => setMediaEditForm((f) => ({ ...f, title: e.target.value }))}
                className="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-sm"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-600 block mb-1">Tytuł oryginalny</label>
              <input
                type="text"
                value={mediaEditForm.original_title}
                onChange={(e) => setMediaEditForm((f) => ({ ...f, original_title: e.target.value }))}
                className="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-sm"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-600 block mb-1">Autor</label>
              <input
                type="text"
                value={mediaEditForm.author}
                onChange={(e) => setMediaEditForm((f) => ({ ...f, author: e.target.value }))}
                className="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-sm"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-600 block mb-1">Tagi (oddzielone przecinkami)</label>
              <input
                type="text"
                value={mediaEditForm.tags}
                onChange={(e) => setMediaEditForm((f) => ({ ...f, tags: e.target.value }))}
                placeholder="np. fantasy, klasyka"
                className="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-sm"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-600 block mb-1">Opis</label>
              <textarea
                value={mediaEditForm.description}
                onChange={(e) => setMediaEditForm((f) => ({ ...f, description: e.target.value }))}
                rows={3}
                className="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-sm resize-none"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-600 block mb-1">URL okładki</label>
              <div className="flex gap-2 items-center">
                <input
                  type="text"
                  value={mediaEditForm.cover_url}
                  onChange={(e) => setMediaEditForm((f) => ({ ...f, cover_url: e.target.value }))}
                  placeholder="https://... lub wgraj plik →"
                  className="flex-1 border border-gray-300 rounded-lg px-3 py-1.5 text-sm"
                />
                <label className={`shrink-0 cursor-pointer px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${uploadingCover ? "bg-gray-200 text-gray-400 cursor-not-allowed" : "bg-gray-100 hover:bg-gray-200"}`}>
                  {uploadingCover ? "Wgrywam…" : "Wgraj"}
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    className="hidden"
                    disabled={uploadingCover}
                    onChange={async (e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      setUploadingCover(true);
                      try {
                        const buffer = await file.arrayBuffer();
                        const base64 = btoa(new Uint8Array(buffer).reduce((s, b) => s + String.fromCharCode(b), ""));
                        const res = await fetch("/api/cover/upload", {
                          method: "POST",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({ data: base64, type: file.type }),
                        });
                        const data = await res.json();
                        if (data.path) {
                          setMediaEditForm((f) => ({ ...f, cover_url: data.path }));
                          toast("Okładka wgrana ✓", "success");
                        } else {
                          toast(data.error ?? "Błąd uploadu", "error");
                        }
                      } catch {
                        toast("Błąd połączenia podczas uploadu", "error");
                      } finally {
                        setUploadingCover(false);
                        e.target.value = "";
                      }
                    }}
                  />
                </label>
              </div>
              {mediaEditForm.cover_url && (
                <div className="mt-1.5">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={mediaEditForm.cover_url} alt="podgląd" className="w-8 h-12 object-cover rounded border border-gray-200" />
                </div>
              )}
            </div>
            <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
              <input
                type="checkbox"
                checked={mediaEditForm.discontinued}
                onChange={(e) => setMediaEditForm((f) => ({ ...f, discontinued: e.target.checked }))}
                className="w-4 h-4"
              />
              Porzucone
            </label>
            <div>
              <label className="text-xs font-medium text-gray-600 block mb-1">Typ</label>
              <select
                value={mediaEditForm.media_type}
                onChange={(e) => setMediaEditForm((f) => ({ ...f, media_type: e.target.value }))}
                className="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-sm"
              >
                {Object.entries(MEDIA_TYPE_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
            </div>
            {media && SCREEN_TYPES.includes(media.media_type) && (
              <div>
                <label className="text-xs font-medium text-gray-600 block mb-1">
                  TMDB ID <span className="text-gray-400 font-normal">(opcjonalnie)</span>
                </label>
                <input
                  type="number"
                  value={mediaEditForm.tmdb_id}
                  onChange={(e) => setMediaEditForm((f) => ({ ...f, tmdb_id: e.target.value }))}
                  placeholder="np. 1399"
                  className="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-sm"
                />
              </div>
            )}
            <div className="flex gap-2 pt-1">
              <button
                onClick={handleSaveMedia}
                disabled={mediaEditSaving || uploadingCover}
                className="flex-1 bg-blue-600 text-white rounded-lg py-2 text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
              >
                {mediaEditSaving ? "Zapisuję..." : uploadingCover ? "Wgrywanie…" : "Zapisz"}
              </button>
              <button
                onClick={() => setIsEditingMedia(false)}
                className="px-3 py-2 bg-gray-100 text-gray-600 rounded-lg text-sm hover:bg-gray-200"
              >
                Anuluj
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit season modal */}
      {editingSeason && (
        <div className="fixed inset-0 z-[60] bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl p-5 max-w-sm w-full space-y-3">
            <h3 className="text-sm font-semibold text-gray-900">Edytuj sezon</h3>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-xs font-medium text-gray-600 block mb-1">Numer sezonu</label>
                <input
                  type="number"
                  value={seasonEditForm.season_number}
                  onChange={(e) => setSeasonEditForm((f) => ({ ...f, season_number: e.target.value }))}
                  placeholder="np. 1"
                  className="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-sm"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-600 block mb-1">Tytuł sezonu</label>
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
              <div className="flex gap-2 items-center">
                <input
                  type="text"
                  value={seasonEditForm.cover_url}
                  onChange={(e) => setSeasonEditForm((f) => ({ ...f, cover_url: e.target.value }))}
                  placeholder="https://... lub wgraj →"
                  className="flex-1 border border-gray-300 rounded-lg px-3 py-1.5 text-sm"
                />
                <label className={`shrink-0 cursor-pointer px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${uploadingSeason ? "bg-gray-200 text-gray-400 cursor-not-allowed" : "bg-gray-100 hover:bg-gray-200"}`}>
                  {uploadingSeason ? "Wgrywam…" : "Wgraj"}
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    className="hidden"
                    disabled={uploadingSeason}
                    onChange={async (e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      setUploadingSeason(true);
                      try {
                        const buffer = await file.arrayBuffer();
                        const base64 = btoa(new Uint8Array(buffer).reduce((s, b) => s + String.fromCharCode(b), ""));
                        const res = await fetch("/api/cover/upload", {
                          method: "POST",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({ data: base64, type: file.type }),
                        });
                        const data = await res.json();
                        if (data.path) {
                          setSeasonEditForm((f) => ({ ...f, cover_url: data.path }));
                          toast("Okładka wgrana ✓", "success");
                        } else {
                          toast(data.error ?? "Błąd uploadu", "error");
                        }
                      } catch {
                        toast("Błąd połączenia podczas uploadu", "error");
                      } finally {
                        setUploadingSeason(false);
                        e.target.value = "";
                      }
                    }}
                  />
                </label>
              </div>
              {seasonEditForm.cover_url && (
                <div className="mt-1.5">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={seasonEditForm.cover_url} alt="podgląd" className="w-8 h-12 object-cover rounded border border-gray-200" />
                </div>
              )}
            </div>
            <div className="flex gap-2 pt-1">
              <button
                onClick={handleSaveSeason}
                disabled={seasonEditSaving || uploadingSeason}
                className="flex-1 bg-blue-600 text-white rounded-lg py-2 text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
              >
                {seasonEditSaving ? "Zapisuję..." : uploadingSeason ? "Wgrywanie…" : "Zapisz"}
              </button>
              <button
                onClick={() => setEditingSeason(null)}
                className="px-3 py-2 bg-gray-100 text-gray-600 rounded-lg text-sm hover:bg-gray-200"
              >
                Anuluj
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Sticky header */}
      <div className="sticky top-0 z-10 bg-white border-b border-gray-200 px-4 py-3 flex items-center gap-3">
        <a
          href="/"
          className="flex items-center gap-1 text-sm text-gray-400 hover:text-gray-700 transition-colors shrink-0"
          title="Strona główna"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7m-9 5v6h4v-6m-4 0H9m6 0h-2" />
          </svg>
        </a>
        <button
          onClick={() => onClose?.()}
          className="flex items-center gap-1.5 text-sm text-gray-600 hover:text-gray-900 transition-colors shrink-0"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Wróć
        </button>
        <h1 className="flex-1 text-center font-semibold text-gray-900 truncate text-sm sm:text-base">
          {media.title}
        </h1>
        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium shrink-0 ${color}`}>
          {icon && <Image src={icon} alt="" width={10} height={10} />}
          {label}
        </span>
        <button
          onClick={() => openEditMedia(media)}
          className="shrink-0 p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
          title="Edytuj medium"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
          </svg>
        </button>
        <button
          onClick={() => void handleDeleteMedia()}
          className="shrink-0 p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
          title="Usuń medium"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
          </svg>
        </button>
      </div>

      <div className="max-w-3xl mx-auto px-4 py-6 space-y-8">
        {/* Hero section */}
        <div className="flex gap-5">
          {media.cover_url && (
            <div className="shrink-0">
              <CoverImg
                src={media.cover_url}
                alt={media.title}
                width={120}
                height={180}
                className="rounded-xl object-cover shadow-md max-w-[160px]"
              />
            </div>
          )}
          <div className="flex-1 min-w-0 space-y-2">
            <h2 className="text-xl font-bold text-gray-900 leading-tight">{media.title}</h2>
            {media.original_title && media.original_title !== media.title && (
              <p className="text-sm text-gray-400">{media.original_title}</p>
            )}
            {(directors.length > 0 || authorPersons.length > 0) ? (
              <p className="text-sm text-gray-600 font-medium flex flex-wrap gap-1">
                {[...directors, ...authorPersons].map((p, i) => {
                  const total = directors.length + authorPersons.length;
                  return (
                    <button
                      key={p.personId}
                      onClick={() => onOpenPerson?.(p.personId)}
                      className="hover:text-blue-600 hover:underline transition-colors"
                    >
                      {p.name}{i < total - 1 ? "," : ""}
                    </button>
                  );
                })}
              </p>
            ) : displayAuthor ? (
              <p className="text-sm text-gray-600 font-medium">{displayAuthor}</p>
            ) : null}
            {releaseYear && <p className="text-sm text-gray-500">{releaseYear}</p>}
            {media.series_status && (
              <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${
                media.series_status === "Ended" || media.series_status === "Canceled"
                  ? "bg-gray-100 text-gray-600"
                  : "bg-green-100 text-green-700"
              }`}>
                {media.series_status === "Ended" ? "🔴 Zakończony"
                  : media.series_status === "Canceled" ? "🔴 Anulowany"
                  : media.series_status === "Returning Series" ? "🟢 Trwający"
                  : media.series_status === "In Production" ? "🟡 W produkcji"
                  : media.series_status}
              </span>
            )}
            {voteAverage != null && (
              <p className="text-sm text-yellow-600 font-medium">★ {voteAverage.toFixed(1)}</p>
            )}
            {description && (
              <p className="text-sm text-gray-600 leading-relaxed line-clamp-5">{description}</p>
            )}
            {/* Watch button for YouTube videos */}
            {media.media_type === "yt" && media.source_url && (
              <a
                href={media.source_url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-sm font-medium rounded-lg transition-colors"
              >
                ▶ Oglądaj na YouTube
              </a>
            )}
            {genres.length > 0 && (
              <div className="flex flex-wrap gap-1.5 pt-1">
                {genres.map((g) => (
                  <span key={g} className="px-2 py-0.5 bg-gray-100 text-gray-600 rounded-full text-xs">
                    {g}
                  </span>
                ))}
              </div>
            )}
            {cachedData?.runtime != null && (
              <p className="text-xs text-gray-500">
                ⏱ {Math.floor(cachedData.runtime / 60)}h {cachedData.runtime % 60}m
              </p>
            )}
            {cachedData?.trackList && cachedData.trackList.length > 0 && (
              <div className="mt-3">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
                  Lista utworów ({cachedData.trackList.length})
                </p>
                <ol className="space-y-0.5">
                  {cachedData.trackList.map((t) => (
                    <li key={t.number} className="flex items-center gap-2 text-xs text-gray-700">
                      <span className="w-5 text-right text-gray-400 shrink-0">{t.number}.</span>
                      <span className="flex-1">{t.title}</span>
                      {t.duration_ms != null && (
                        <span className="text-gray-400 shrink-0">
                          {Math.floor(t.duration_ms / 60000)}:{String(Math.floor((t.duration_ms % 60000) / 1000)).padStart(2, "0")}
                        </span>
                      )}
                    </li>
                  ))}
                </ol>
              </div>
            )}
            {media.tagList && media.tagList.length > 0 && (
              <div className="flex flex-wrap gap-1 pt-1">
                {media.tagList.map((t) => (
                  <span
                    key={t.id}
                    className="px-1.5 py-0.5 bg-blue-50 text-blue-700 rounded text-[10px] font-medium"
                  >
                    #{t.name}
                  </span>
                ))}
              </div>
            )}

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
                              <img src={m.cover_url} alt={m.title} className="w-full h-full object-cover" />
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
          </div>
        </div>

        {/* TMDB air dates button — visible for movie / series / anime regardless of seasons */}
        {media && ["movie", "series", "anime"].includes(media.media_type) && (
          <div className="space-y-3">
            <div className="flex justify-end">
              <button
                onClick={() => {
                  if (showAirDates) { setShowAirDates(false); setShowTmdbLink(false); return; }
                  if (media?.tmdb_id) { loadAirDates(); }
                  else { setShowTmdbLink(true); setShowAirDates(true); setTmdbLinkSearch(media?.original_title || media?.title || ""); }
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
            {showTmdbLink && !media?.tmdb_id && (
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
                          <img
                            src={as.seasonPosterPath}
                            alt={as.seasonLabel}
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
        )}

        {/* Podcast episode dates panel */}
        {media && media.media_type === "podcast" && (
          <div className="space-y-3">
            <div className="flex justify-end">
              <button
                onClick={() => setShowPodcastEpisodes((v) => !v)}
                className={`text-xs flex items-center gap-1 px-2 py-1 rounded border transition-colors ${
                  showPodcastEpisodes
                    ? "border-cyan-400 bg-cyan-50 text-cyan-700"
                    : "border-gray-200 text-gray-500 hover:text-gray-700 hover:bg-gray-50"
                }`}
              >
                🎙️ {showPodcastEpisodes ? "Ukryj odcinki" : "Daty odcinków Apple Podcasts"}
              </button>
            </div>

            {showPodcastEpisodes && (
              <div className="border border-gray-200 rounded-lg overflow-hidden">
                <div className="flex items-center gap-2 px-3 py-2 bg-gray-50 border-b border-gray-100">
                  <input
                    type="url"
                    placeholder="https://podcasts.apple.com/…"
                    value={podcastUrl}
                    onChange={(e) => setPodcastUrl(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter" && podcastUrl) fetchPodcastEpisodes(podcastUrl); }}
                    className="flex-1 text-xs border border-gray-200 rounded px-2 py-1 focus:outline-none focus:border-cyan-400"
                  />
                  <button
                    onClick={() => { if (podcastUrl) fetchPodcastEpisodes(podcastUrl); }}
                    disabled={!podcastUrl || podcastEpisodesLoading}
                    className="text-xs px-3 py-1 bg-cyan-600 text-white rounded hover:bg-cyan-700 disabled:opacity-40"
                  >
                    {podcastEpisodesLoading ? "⏳" : "Pobierz"}
                  </button>
                  {podcastEpisodeDates.length > 0 && (() => {
                    const newDates = podcastEpisodeDates.filter((d) => !sessionDaysMap.has(d));
                    return newDates.length > 0 ? (
                      <button
                        onClick={() => importPodcastDates(newDates)}
                        disabled={newDates.some((d) => importingDates.has(d))}
                        className="text-xs px-3 py-1 bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-40"
                      >
                        + Dodaj wszystkie nowe ({newDates.length})
                      </button>
                    ) : null;
                  })()}
                </div>

                {podcastEpisodesError && (
                  <p className="px-3 py-2 text-xs text-red-500">{podcastEpisodesError}</p>
                )}

                {!podcastEpisodesLoading && podcastEpisodeDates.length > 0 && (
                  <div className="p-3 space-y-1">
                    <p className="text-[10px] text-gray-400 mb-2">
                      {podcastEpisodeDates.length} odcinków · {podcastEpisodeDates.filter((d) => !sessionDaysMap.has(d)).length} nowych
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {podcastEpisodeDates.map((date) => {
                        const exists = sessionDaysMap.has(date);
                        const importing = importingDates.has(date);
                        return (
                          <button
                            key={date}
                            onClick={() => !exists && !importing && importPodcastDates([date])}
                            disabled={exists || importing}
                            title={exists ? "Już zalogowane" : `Dodaj ${date} jako sesję`}
                            className={`text-[11px] px-2 py-0.5 rounded-full border transition-colors ${
                              exists
                                ? "bg-green-100 border-green-200 text-green-700 cursor-default"
                                : importing
                                ? "bg-gray-100 border-gray-200 text-gray-400 cursor-wait"
                                : "bg-white border-gray-300 text-gray-700 hover:bg-cyan-50 hover:border-cyan-300 cursor-pointer"
                            }`}
                          >
                            {formatDate(date)}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Seasons section */}
        {seasons.length > 0 && (
          <div>
            <h3 className="text-sm font-semibold text-gray-800 mb-3">Sezony</h3>
            <div className="space-y-2">
              {seasons.map((s, idx) => (
                <div
                  key={s.id}
                  className="flex items-center gap-3 p-3 rounded-lg bg-gray-50 border border-gray-100"
                >
                  {s.cover_url ? (
                    <img
                      src={s.cover_url}
                      alt=""
                      className="w-8 h-12 object-cover rounded shrink-0"
                    />
                  ) : (
                    <span
                      className={`w-3 h-3 rounded-full shrink-0 ${SEASON_COLORS[idx % SEASON_COLORS.length]}`}
                    />
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-800 truncate">
                      {seasonLabel(s, idx)}
                    </p>
                    {(s.first_session_date || s.last_session_date) && (
                      <p className="text-xs text-gray-400 mt-0.5">
                        {s.first_session_date ? formatDate(s.first_session_date) : "?"} –{" "}
                        {s.last_session_date ? formatDate(s.last_session_date) : "?"}
                      </p>
                    )}
                  </div>
                  <span className="text-xs text-gray-500 shrink-0">{s.session_count} sesji</span>
                  {(media.media_type === "series" || media.media_type === "anime" || media.media_type === "cartoon") && (
                    <label className="flex items-center gap-1 cursor-pointer select-none shrink-0">
                      <input
                        type="checkbox"
                        checked={Boolean(s.want_to_watch)}
                        onChange={() => handleToggleWantToWatch(s)}
                        className="w-3.5 h-3.5 accent-blue-500"
                      />
                      <span className="text-xs text-blue-600">👁 Chcę obejrzeć</span>
                    </label>
                  )}
                  <button
                    onClick={() => openEditSeason(s)}
                    title="Edytuj sezon"
                    className="text-xs text-gray-400 hover:text-gray-700 px-1.5 py-0.5 rounded hover:bg-gray-200"
                  >
                    ✏️
                  </button>
                  <button
                    onClick={async () => {
                      const removed = await removePlaceholders(s.id);
                      if (removed > 0) {
                        toast(`Usunięto ${removed} placeholder${removed > 1 ? "y" : ""} ✓`, "success");
                        await loadData();
                        onRefresh?.();
                      } else {
                        toast("Brak placeholderów", "info");
                      }
                    }}
                    title="Usuń sesje-placeholder (YYYY-01-01 → YYYY-12-31)"
                    className="text-xs text-amber-500 hover:text-amber-700 px-1.5 py-0.5 rounded hover:bg-amber-50"
                  >
                    🗑📅
                  </button>
                  <button
                    onClick={() => handleMergeSeason(s.id)}
                    title="Scal sąsiednie sesje w jedną"
                    className="text-xs text-blue-600 hover:text-blue-800 px-1.5 py-0.5 rounded hover:bg-blue-50"
                  >
                    🔀
                  </button>
                  <button
                    onClick={() => handleDeleteSeason(s.id)}
                    title="Usuń sezon"
                    className="text-xs text-red-400 hover:text-red-600 px-1.5 py-0.5 rounded hover:bg-red-50"
                  >
                    🗑️
                  </button>
                </div>
              ))}
            </div>

            {/* Add season */}
            {!showAddSeason ? (
              <button
                onClick={() => {
                  const nextNum = seasons.length > 0 ? Math.max(...seasons.map((s) => s.season_number ?? 0)) + 1 : 1;
                  setAddSeasonForm({ season_number: String(nextNum), title: "" });
                  setShowAddSeason(true);
                }}
                className="mt-2 text-xs text-blue-600 hover:text-blue-800 flex items-center gap-1"
              >
                + Nowy sezon
              </button>
            ) : (
              <div className="mt-3 border border-gray-200 rounded-lg p-3 bg-gray-50 space-y-2">
                <p className="text-xs font-semibold text-gray-700">Nowy sezon</p>
                <div className="flex gap-2">
                  <div className="w-20">
                    <label className="text-xs text-gray-500 block mb-1">Numer</label>
                    <input
                      type="number"
                      value={addSeasonForm.season_number}
                      onChange={(e) => setAddSeasonForm((f) => ({ ...f, season_number: e.target.value }))}
                      className="w-full border border-gray-300 rounded px-2 py-1 text-sm"
                    />
                  </div>
                  <div className="flex-1">
                    <label className="text-xs text-gray-500 block mb-1">Tytuł (opcjonalnie)</label>
                    <input
                      type="text"
                      value={addSeasonForm.title}
                      onChange={(e) => setAddSeasonForm((f) => ({ ...f, title: e.target.value }))}
                      placeholder="np. Część 1"
                      className="w-full border border-gray-300 rounded px-2 py-1 text-sm"
                    />
                  </div>
                </div>
                <div className="flex gap-2 justify-end">
                  <button
                    onClick={() => setShowAddSeason(false)}
                    className="text-xs px-3 py-1.5 rounded border border-gray-300 text-gray-600 hover:bg-gray-100"
                  >
                    Anuluj
                  </button>
                  <button
                    onClick={handleAddSeason}
                    disabled={addSeasonLoading}
                    className="text-xs px-3 py-1.5 rounded bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
                  >
                    {addSeasonLoading ? "Zapisuję..." : "Dodaj sezon"}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Cast section */}
        {actors.length > 0 && (
          <div>
            <h3 className="text-sm font-semibold text-gray-800 mb-3">Obsada</h3>
            <div className="flex gap-3 overflow-x-auto pb-2">
              {actors.map((a) => (
                <button
                  key={a.personId}
                  onClick={() => onOpenPerson?.(a.personId)}
                  className="shrink-0 w-20 text-center group"
                  title={a.name}
                >
                  {a.photoUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={a.photoUrl}
                      alt={a.name}
                      className="w-14 h-14 rounded-full object-cover mx-auto mb-1 border border-gray-200 group-hover:border-blue-400 transition-colors"
                    />
                  ) : (
                    <div className="w-14 h-14 rounded-full bg-gray-200 group-hover:bg-blue-100 flex items-center justify-center text-lg text-gray-500 mx-auto mb-1 transition-colors">
                      {a.name[0]}
                    </div>
                  )}
                  <p className="text-[10px] font-medium text-gray-700 group-hover:text-blue-600 leading-tight line-clamp-2 transition-colors">
                    {a.name}
                  </p>
                  {a.characterName && (
                    <p className="text-[9px] text-gray-400 leading-tight line-clamp-2 mt-0.5">
                      {a.characterName}
                    </p>
                  )}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* VOD availability section */}
        {media && ["movie", "series", "anime", "cartoon"].includes(media.media_type) && (
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-gray-800">Dostępność VOD</h3>
              <button
                onClick={() => checkVod(media)}
                disabled={vodLoading}
                className="text-xs text-gray-500 hover:text-gray-700 flex items-center gap-1 px-2 py-1 rounded border border-gray-200 hover:bg-gray-50 transition-colors disabled:opacity-50"
              >
                {vodLoading ? "⏳ Sprawdzam…" : "🔄 Sprawdź dostępność"}
              </button>
            </div>
            {vodLastChecked && (
              <p className="text-[10px] text-gray-400 mb-2">
                Ostatnio sprawdzono: {new Date(vodLastChecked).toLocaleString("pl-PL")}
              </p>
            )}
            {vodOffers.length === 0 ? (
              <p className="text-xs text-gray-400 italic">
                {vodLastChecked ? "Brak dostępności w abonamencie na polskich platformach VOD." : "Nie sprawdzono jeszcze."}
              </p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {vodOffers.map((o) => {
                  const daysLeft = o.available_to
                    ? Math.ceil((new Date(o.available_to).getTime() - Date.now()) / 86_400_000)
                    : null;
                  const leaving = daysLeft !== null && daysLeft <= 7;
                  return (
                    <a
                      key={o.id}
                      href={o.url ?? "#"}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={`flex items-center gap-2 px-3 py-2 rounded-xl border text-xs transition-colors ${
                        leaving
                          ? "border-orange-300 bg-orange-50 hover:bg-orange-100"
                          : "border-gray-200 bg-white hover:bg-gray-50"
                      }`}
                      title={`${o.provider_name} · ${o.monetization_type}${o.quality ? ` · ${o.quality}` : ""}`}
                    >
                      {o.provider_logo && (
                        <img src={o.provider_logo} alt={o.provider_name} className="w-6 h-6 object-contain rounded" />
                      )}
                      <span className="font-medium text-gray-800">{o.provider_name}</span>
                      <span className="text-gray-400">{o.monetization_type === "FLATRATE" ? "Sub" : o.monetization_type === "FREE" ? "Free" : o.monetization_type === "BUY" ? "Kup" : "Wynajem"}</span>
                      {o.quality && <span className="text-gray-400">{o.quality.replace("_4K", "4K")}</span>}
                      {leaving && daysLeft !== null && (
                        <span className="text-orange-600 font-semibold">⚠ {daysLeft}d</span>
                      )}
                    </a>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Calendar history section */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-gray-800">Historia oglądania</h3>
            <div className="flex gap-2">
              <button
                onClick={() => {
                  if (splitMode) {
                    setSplitMode(false); setSplitRangeStart(null); setSplitRangeEnd(null); setSplitTarget(null);
                  } else {
                    setSplitMode(true);
                  }
                }}
                className={`text-xs flex items-center gap-1 px-2 py-1 rounded border transition-colors ${
                  splitMode
                    ? "border-amber-400 bg-amber-50 text-amber-700"
                    : "border-gray-200 text-gray-500 hover:text-gray-700 hover:bg-gray-50"
                }`}
              >
                ✂️ {splitMode ? "Anuluj podział" : "Podziel na sezony"}
              </button>
              {media && (SCREEN_TYPES.includes(media.media_type) || ITUNES_TYPES.includes(media.media_type)) && (
                <button
                  onClick={triggerSync}
                  disabled={externalSync.status === "loading"}
                  className="text-xs text-gray-500 hover:text-gray-700 flex items-center gap-1 px-2 py-1 rounded border border-gray-200 hover:bg-gray-50 transition-colors disabled:opacity-50"
                >
                  {externalSync.status === "loading" ? "⏳ Ładowanie…" :
                   SCREEN_TYPES.includes(media.media_type) ? "🎬 Zaciągnij z TMDB" :
                   "🎵 Zaciągnij z iTunes"}
                </button>
              )}
              {media && ITUNES_TYPES.includes(media.media_type) && (
                <div className="flex gap-1 items-center">
                  <input
                    type="url"
                    placeholder="lub wklej link z Apple Music…"
                    value={appleMusicUrlInput}
                    onChange={(e) => setAppleMusicUrlInput(e.target.value)}
                    className="text-xs border border-gray-200 rounded px-2 py-1 w-52 focus:outline-none focus:border-pink-400"
                  />
                  <button
                    onClick={() => { if (appleMusicUrlInput) { const u = appleMusicUrlInput; setAppleMusicUrlInput(""); syncFromItunes(undefined, u); } }}
                    disabled={!appleMusicUrlInput || externalSync.status === "loading"}
                    className="text-xs px-2 py-1 bg-pink-50 hover:bg-pink-100 text-pink-700 rounded border border-pink-200 disabled:opacity-40"
                  >
                    🎵
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* External sync candidates panel */}
          {externalSync.status === "tmdb_candidates" && (
            <div className="mb-4 border border-blue-200 rounded-lg p-3 bg-blue-50 space-y-2">
              <p className="text-xs font-medium text-blue-800">Wybierz tytuł z TMDB:</p>
              <div className="flex flex-wrap gap-2">
                {externalSync.candidates.map((c) => (
                  <button
                    key={c.tmdb_id}
                    onClick={() => syncFromTmdb(c.tmdb_id)}
                    className="flex items-center gap-2 px-3 py-1.5 bg-white border border-blue-200 rounded-lg text-xs hover:bg-blue-100 transition-colors"
                  >
                    {c.poster_path && (
                      <img src={`https://image.tmdb.org/t/p/w45${c.poster_path}`} alt="" className="w-5 h-7 object-cover rounded" />
                    )}
                    <span className="font-medium">{c.name}</span>
                    {c.first_air_date && <span className="text-gray-400">{c.first_air_date.slice(0, 4)}</span>}
                  </button>
                ))}
              </div>
              <button onClick={() => setExternalSync({ status: "idle" })} className="text-xs text-gray-400 hover:text-gray-600">Anuluj</button>
            </div>
          )}
          {externalSync.status === "itunes_candidates" && (
            <div className="mb-4 border border-pink-200 rounded-lg p-3 bg-pink-50 space-y-2">
              <p className="text-xs font-medium text-pink-800">Wybierz z iTunes:</p>
              <div className="flex flex-wrap gap-2">
                {externalSync.candidates.map((c) => (
                  <button
                    key={c.itunes_id}
                    onClick={() => syncFromItunes(c.itunes_id)}
                    className="flex items-center gap-2 px-3 py-1.5 bg-white border border-pink-200 rounded-lg text-xs hover:bg-pink-100 transition-colors"
                  >
                    {c.cover_url && (
                      <img src={c.cover_url.replace("600x600bb", "45x45bb")} alt="" className="w-7 h-7 object-cover rounded" />
                    )}
                    <span className="font-medium">{c.title}</span>
                    {c.artist && <span className="text-gray-500">{c.artist}</span>}
                    {c.year && <span className="text-gray-400">{c.year}</span>}
                  </button>
                ))}
              </div>
              <button onClick={() => setExternalSync({ status: "idle" })} className="text-xs text-gray-400 hover:text-gray-600">Anuluj</button>
            </div>
          )}
          {externalSync.status === "error" && (
            <div className="mb-4 bg-red-50 border border-red-200 rounded-lg px-3 py-2 space-y-1.5">
              <p className="text-xs text-red-600">⚠️ {externalSync.message}</p>
            </div>
          )}
          {splitMode && (
            <div className="mb-3 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
              {!splitRangeStart
                ? "Kliknij dzień startowy zakresu"
                : splitTarget
                ? "Zakres wybrany — przypisz poniżej"
                : "Kliknij dzień końcowy zakresu (hover podświetla)"}
            </div>
          )}
          {/* Split assign dialog */}
          {splitTarget && (
            <div className="mb-4 border border-amber-300 rounded-lg p-4 bg-amber-50 space-y-3">
              <p className="text-sm font-medium text-amber-800">
                Przypisz {splitTarget.sessionIds.length} sesji ({splitTarget.dateRange}) do sezonu:
              </p>
              <div className="flex gap-4">
                <label className="flex items-center gap-1 text-sm text-gray-700 cursor-pointer">
                  <input type="radio" name="splitChoice" value="new" checked={splitSeasonChoice === "new"} onChange={() => setSplitSeasonChoice("new")} />
                  Nowy sezon
                </label>
                <label className="flex items-center gap-1 text-sm text-gray-700 cursor-pointer">
                  <input type="radio" name="splitChoice" value="existing" checked={splitSeasonChoice === "existing"} onChange={() => setSplitSeasonChoice("existing")} />
                  Istniejący sezon
                </label>
              </div>
              {splitSeasonChoice === "new" && (
                <div className="flex gap-2">
                  <input
                    type="number" placeholder="Nr sezonu" value={splitNewSeasonNumber}
                    onChange={(e) => setSplitNewSeasonNumber(e.target.value)}
                    className="w-28 text-sm border border-gray-300 rounded px-2 py-1"
                  />
                  <input
                    type="text" placeholder="Tytuł (opcjonalny)" value={splitNewSeasonTitle}
                    onChange={(e) => setSplitNewSeasonTitle(e.target.value)}
                    className="flex-1 text-sm border border-gray-300 rounded px-2 py-1"
                  />
                </div>
              )}
              {splitSeasonChoice === "existing" && (
                <select
                  value={splitExistingSeasonId} onChange={(e) => setSplitExistingSeasonId(e.target.value)}
                  className="w-full text-sm border border-gray-300 rounded px-2 py-1"
                >
                  <option value="">— wybierz sezon —</option>
                  {seasons.map((s, idx) => (
                    <option key={s.id} value={s.id}>
                      {s.title ?? (s.season_number != null ? `Sezon ${s.season_number}` : `Sezon ${idx + 1}`)}
                    </option>
                  ))}
                </select>
              )}
              <div className="flex gap-2">
                <button
                  onClick={handleSplitAssign} disabled={splitSaving}
                  className="text-sm bg-amber-600 text-white px-4 py-1.5 rounded hover:bg-amber-700 disabled:opacity-50"
                >
                  {splitSaving ? "Zapisuję..." : "Przypisz"}
                </button>
                <button
                  onClick={() => { setSplitTarget(null); setSplitRangeStart(null); setSplitRangeEnd(null); }}
                  className="text-sm border border-gray-300 px-4 py-1.5 rounded hover:bg-gray-50"
                >
                  Anuluj
                </button>
              </div>
            </div>
          )}
          {sessions.length === 0 || isOnlyPlaceholders ? (
            <div className="space-y-4">
              {/* Year navigation */}
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setYearViewYear((y) => y - 1)}
                  className="w-7 h-7 flex items-center justify-center rounded-full hover:bg-gray-100 text-gray-600 font-bold"
                >
                  ‹
                </button>
                <span className="text-sm font-semibold text-gray-800 min-w-[3rem] text-center">{yearViewYear}</span>
                <button
                  onClick={() => setYearViewYear((y) => y + 1)}
                  className="w-7 h-7 flex items-center justify-center rounded-full hover:bg-gray-100 text-gray-600 font-bold"
                >
                  ›
                </button>
                {yearSelectedDates.size > 0 && (
                  <label className="flex items-center gap-1.5 cursor-pointer select-none ml-2">
                    <input
                      type="checkbox"
                      checked={yearBatchCinema}
                      onChange={(e) => setYearBatchCinema(e.target.checked)}
                      className="w-4 h-4 accent-yellow-500"
                    />
                    <span className="text-xs text-gray-700">🎟️ kino</span>
                  </label>
                )}
                {yearSelectedDates.size > 0 && (
                  <button
                    onClick={handleYearBatchCreate}
                    disabled={yearBatchSaving}
                    className="ml-2 text-xs bg-blue-600 text-white px-3 py-1.5 rounded-lg hover:bg-blue-700 disabled:opacity-50"
                  >
                    {yearBatchSaving ? "Zapisuję..." : `Utwórz ${yearSelectedDates.size} sesj${yearSelectedDates.size === 1 ? "ę" : "e"}`}
                  </button>
                )}
                {yearSelectedDates.size > 0 && (
                  <button
                    onClick={() => setYearSelectedDates(new Set())}
                    className="text-xs text-gray-400 hover:text-gray-600"
                  >
                    Wyczyść
                  </button>
                )}
              </div>
              <YearCalendar
                year={yearViewYear}
                sessionDaysByItem={sessionDaysMap}
                selectedDates={yearSelectedDates}
                onDayToggle={(date) =>
                  setYearSelectedDates((prev) => {
                    const next = new Set(prev);
                    if (next.has(date)) next.delete(date); else next.add(date);
                    return next;
                  })
                }
              />
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex flex-wrap gap-6">
                {sortedMonths.map((key) => {
                  const [y, m] = key.split("-").map(Number);
                  const monthDays = grouped.get(key) ?? new Map<string, string>();
                  return (
                    <MiniCalendar
                      key={key}
                      year={y}
                      month={m}
                      sessionDaysByItem={monthDays}
                      onDayClick={handleDayClick}
                      onDayHover={handleSplitDayHover}
                    />
                  );
                })}
              </div>
              <div className="flex gap-2">
                {!sortedMonths.includes(currentYearMonth) && (
                  <button
                    onClick={() => addMonth(currentYearMonth)}
                    className="text-xs text-blue-600 hover:text-blue-800 px-3 py-1.5 border border-blue-200 rounded-lg hover:bg-blue-50"
                  >
                    + Dodaj {currentYearMonth}
                  </button>
                )}
                {!sortedMonths.includes(nextAfterLastSession) && (
                  <button
                    onClick={() => addMonth(nextAfterLastSession)}
                    className="text-xs text-blue-600 hover:text-blue-800 px-3 py-1.5 border border-blue-200 rounded-lg hover:bg-blue-50"
                  >
                    + Dodaj {nextAfterLastSession}
                  </button>
                )}
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
