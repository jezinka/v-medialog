"use client";
import { useEffect, useState, useCallback, useMemo } from "react";
import Image from "next/image";
import Link from "next/link";
import CoverImg from "./CoverImg";
import { MEDIA_TYPE_ICONS, MEDIA_TYPE_COLORS, MEDIA_TYPE_LABELS, formatDate, BOOK_TYPES, SCREEN_TYPES, CALENDAR_TYPES, hasSeasonNumbers, MONTH_NAMES } from "@/lib/utils";
import { partNo, seasonLabel } from "@/lib/part-number";
import { SEASON_COLORS, buildSessionDaysMap, groupByYearMonth } from "@/lib/calendar-days";
import MonthGrid from "./MonthGrid";
import SeasonPickerModal from "./item-detail/SeasonPickerModal";
import EditSessionModal from "./item-detail/EditSessionModal";
import EditMediaModal from "./item-detail/EditMediaModal";
import EditSeasonModal from "./item-detail/EditSeasonModal";
import CastSection from "./item-detail/CastSection";
import VodSection from "./item-detail/VodSection";
import UniversePanel from "./item-detail/UniversePanel";
import PodcastEpisodesPanel from "./item-detail/PodcastEpisodesPanel";
import AirDatesPanel from "./item-detail/AirDatesPanel";
import { SyncButtons, SyncCandidates } from "./item-detail/ExternalSync";
import { useExternalData } from "./item-detail/useExternalData";
import type { MediaData, SessionApiRow, SeasonRow } from "./item-detail/types";
import { toast } from "./Toast";

interface Props {
  mediaId: number;
  onClose?: () => void;
  onRefresh?: () => void;
  onOpenPerson?: (personId: number) => void;
  onOpenDetail?: (mediaId: number) => void;
}

export default function ItemDetailPage({ mediaId, onClose, onRefresh, onOpenPerson, onOpenDetail }: Props) {
  const [media, setMedia] = useState<MediaData | null>(null);
  const [sessions, setSessions] = useState<SessionApiRow[]>([]);
  const [seasons, setSeasons] = useState<SeasonRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [seasonPickerDate, setSeasonPickerDate] = useState<string | null>(null);
  const [addingSession, setAddingSession] = useState(false);
  const [extraMonths, setExtraMonths] = useState<Set<string>>(new Set());
  const [yearViewYear, setYearViewYear] = useState(() => new Date().getFullYear());
  const [yearSelectedDates, setYearSelectedDates] = useState<Set<string>>(new Set());
  const [yearBatchSaving, setYearBatchSaving] = useState(false);
  const [yearBatchCinema, setYearBatchCinema] = useState(false);
  const [yearBatchWithChild, setYearBatchWithChild] = useState(false);

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

  const [editingSession, setEditingSession] = useState<SessionApiRow | null>(null);
  const [isEditingMedia, setIsEditingMedia] = useState(false);

  const [editingSeason, setEditingSeason] = useState<SeasonRow | null>(null);
  // ── Add season state ────────────────────────────────────────────────────────
  const [showAddSeason, setShowAddSeason] = useState(false);
  const [selectedPartId, setSelectedPartId] = useState<number | null>(null);
  const [addSeasonForm, setAddSeasonForm] = useState({ season_number: "", title: "" });
  const [addSeasonLoading, setAddSeasonLoading] = useState(false);

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

  // After an edit: refresh this page and whatever list opened it
  const reload = useCallback(async () => {
    await loadData();
    onRefresh?.();
  }, [loadData, onRefresh]);

  const onCoverChange = useCallback((path: string) => {
    setMedia((prev) => prev ? { ...prev, cover_url: path } : prev);
    onRefresh?.();
  }, [onRefresh]);
  const sync = useExternalData(mediaId, media, onCoverChange);
  const cachedData = sync.cachedData;

  useEffect(() => {
    const init = async () => {
      await loadData();
      // Pass media via ref to avoid stale closure
    };
    init();
  }, [loadData]);

  const addSession = useCallback(
    async (date: string, seasonId: number, flags = { cinema: false, withChild: false }) => {
      setAddingSession(true);
      try {
        const res = await fetch("/api/sessions", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            season_id: seasonId,
            start_date: date,
            end_date: date,
            cinema: flags.cinema,
            with_child: flags.withChild,
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
      }
    },
    [loadData, onRefresh]
  );

  const sessionDaysMap = useMemo(
    () => buildSessionDaysMap(sessions, seasons),
    [sessions, seasons]
  );

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
        const noSeasonNumber = !hasSeasonNumbers(media?.media_type ?? "");
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
      const dates = Array.from(yearSelectedDates).sort();
      let added = 0;
      for (const date of dates) {
        const res = await fetch("/api/sessions", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            season_id: seasonId,
            start_date: date,
            end_date: date,
            cinema: yearBatchCinema,
            with_child: yearBatchWithChild,
          }),
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
  }, [yearSelectedDates, seasons, mediaId, loadData, onRefresh, yearBatchCinema, yearBatchWithChild, media?.media_type]);

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
        if (session) setEditingSession(session);
        return;
      }
      if (seasons.length === 0) {
        // Auto-create default season then add session
        try {
          const noSeasonNumber = !hasSeasonNumbers(media?.media_type ?? "");
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
    [splitMode, splitRangeStart, splitTarget, sessions, sessionDaysMap, dateToSessionMap, seasons, addSession, mediaId, media?.media_type]
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

  const grouped = useMemo(() => groupByYearMonth(displayDaysMap), [displayDaysMap]);
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
  const isBook = media ? BOOK_TYPES.includes(media.media_type) : false;
  const hasSpecials = media ? SCREEN_TYPES.includes(media.media_type) : false; // TMDB season 0
  const partLabel = isBook ? "Część" : "Sezon";
  const partsLabel = isBook ? "Części" : "Sezony";
  const newPartLabel = isBook ? "Nowa część" : "Nowy sezon";
  const historyLabel = isBook ? "Historia czytania" : "Historia oglądania";

  const removePlaceholders = async (seasonId: number): Promise<number> => {
    try {
      const res = await fetch(`/api/seasons/${seasonId}/placeholders`, { method: "DELETE" });
      const data = await res.json() as { removed?: number };
      return data.removed ?? 0;
    } catch { return 0; }
  };

  // Per-part controls shared by the single-book row and the parts cover grid
  const seasonControls = (s: SeasonRow) => (
    <>
      <span className="text-xs text-gray-500 shrink-0">{s.session_count} sesji</span>
      {CALENDAR_TYPES.includes(media?.media_type ?? "") && (
        <label className="flex items-center gap-1 cursor-pointer select-none shrink-0">
          <input
            type="checkbox"
            checked={Boolean(s.want_to_watch)}
            onChange={() => handleToggleWantToWatch(s)}
            className="w-3.5 h-3.5 accent-blue-500"
          />
          <span className="text-xs text-blue-600">{isBook ? "📖 Chcę przeczytać" : "👁 Chcę obejrzeć"}</span>
        </label>
      )}
      <button
        onClick={() => setEditingSeason(s)}
        title={`Edytuj ${partLabel.toLowerCase()}`}
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
        title={`Usuń ${partLabel.toLowerCase()}`}
        className="text-xs text-red-400 hover:text-red-600 px-1.5 py-0.5 rounded hover:bg-red-50"
      >
        🗑️
      </button>
    </>
  );


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
        <SeasonPickerModal
          date={seasonPickerDate}
          seasons={seasons}
          mediaType={media.media_type}
          isBook={isBook}
          partLabel={partLabel}
          hasSpecials={hasSpecials}
          adding={addingSession}
          onPick={(seasonId, flags) => addSession(seasonPickerDate, seasonId, flags)}
          onClose={() => setSeasonPickerDate(null)}
        />
      )}

      {/* Edit session modal */}
      {editingSession && (
        <EditSessionModal
          session={editingSession}
          seasons={seasons}
          mediaType={media.media_type}
          partLabel={partLabel}
          hasSpecials={hasSpecials}
          onClose={() => setEditingSession(null)}
          onSaved={reload}
        />
      )}

      {/* Edit media modal */}
      {isEditingMedia && (
        <EditMediaModal media={media} onClose={() => setIsEditingMedia(false)} onSaved={reload} />
      )}

      {/* Edit season modal */}
      {editingSeason && (
        <EditSeasonModal season={editingSeason} partLabel={partLabel} onClose={() => setEditingSeason(null)} onSaved={reload} />
      )}

      {/* Sticky header */}
      <div className="sticky top-0 z-10 bg-white border-b border-gray-200 px-4 py-3 flex items-center gap-3">
        <Link
          href="/"
          className="flex items-center gap-1 text-sm text-gray-400 hover:text-gray-700 transition-colors shrink-0"
          title="Strona główna"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7m-9 5v6h4v-6m-4 0H9m6 0h-2" />
          </svg>
        </Link>
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
          onClick={() => setIsEditingMedia(true)}
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

            <UniversePanel media={media} onOpenDetail={onOpenDetail} onChanged={loadData} />
          </div>
        </div>

        {/* Episodic types only (a movie's tmdb_id is not a TV id) */}
        {["series", "anime"].includes(media.media_type) && (
          <AirDatesPanel media={media} seasons={seasons} sessionDaysMap={sessionDaysMap} onChanged={reload} />
        )}

        {media.media_type === "podcast" && (
          <PodcastEpisodesPanel mediaId={media.id} seasons={seasons} sessionDaysMap={sessionDaysMap} onImported={reload} />
        )}

        {/* Seasons section */}
        {seasons.length > 0 && (
          <div>
            {media && !hasSeasonNumbers(media.media_type) && seasons.length === 1 && !seasons[0].cover_url ? (
              // A single movie/book needs no parts list; re-watches are just more sessions in the calendar
              <div className="flex flex-wrap items-center justify-end gap-3">
                {seasonControls(seasons[0])}
              </div>
            ) : (
              <>
                <h3 className="text-sm font-semibold text-gray-800 mb-3">{partsLabel}</h3>
                {/* Parts as a compact cover grid; click one for its dates and actions */}
                <div className="grid grid-cols-6 sm:grid-cols-8 md:grid-cols-10 gap-2">
                  {seasons.map((s, idx) => (
                    <button
                      key={s.id}
                      onClick={() => setSelectedPartId((id) => (id === s.id ? null : s.id))}
                      title={`${seasonLabel(s, partNo(seasons, idx, hasSpecials), partLabel)} · ${s.session_count} sesji`}
                      aria-label={`${seasonLabel(s, partNo(seasons, idx, hasSpecials), partLabel)} · ${s.session_count} sesji${
                        s.want_to_watch ? (isBook ? " · chcę przeczytać" : " · chcę obejrzeć") : ""
                      }${s.session_count === 0 ? (isBook ? " · nieprzeczytana" : " · nieobejrzany") : ""}`}
                      aria-pressed={selectedPartId === s.id}
                      className={`group text-left rounded-md transition-shadow ${
                        selectedPartId === s.id ? "ring-2 ring-blue-500 ring-offset-1" : "hover:ring-2 hover:ring-gray-300"
                      }`}
                    >
                      <div className="relative aspect-[2/3] rounded-md overflow-hidden bg-gray-100">
                        {s.cover_url ? (
                          <Image unoptimized src={s.cover_url} alt="" fill className="object-cover" />
                        ) : (
                          <div className={`absolute inset-0 flex items-center justify-center text-white text-sm font-semibold ${SEASON_COLORS[idx % SEASON_COLORS.length]}`} aria-hidden="true">
                            {partNo(seasons, idx, hasSpecials)}
                          </div>
                        )}
                        {s.want_to_watch ? (
                          <span className="absolute top-0.5 right-0.5 text-[10px] leading-none bg-white/90 rounded px-0.5" title={isBook ? "Chcę przeczytać" : "Chcę obejrzeć"}>{isBook ? "📖" : "👁"}</span>
                        ) : null}
                        {s.session_count === 0 && (
                          <div className="absolute inset-0 bg-white/50" title={isBook ? "Nieprzeczytana" : "Nieobejrzany"} />
                        )}
                      </div>
                      <p className="text-[11px] text-gray-600 text-center mt-0.5 truncate">{partNo(seasons, idx, hasSpecials)}</p>
                    </button>
                  ))}
                </div>
                {(() => {
                  const sel = seasons.find((s) => s.id === selectedPartId);
                  if (!sel) return null;
                  const idx = seasons.indexOf(sel);
                  return (
                    <div className="mt-3 flex flex-wrap items-center gap-3 p-3 rounded-lg bg-gray-50 border border-gray-100">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-800 truncate">{seasonLabel(sel, partNo(seasons, idx, hasSpecials), partLabel)}</p>
                        {(sel.first_session_date || sel.last_session_date) && (
                          <p className="text-xs text-gray-400 mt-0.5">
                            {sel.first_session_date ? formatDate(sel.first_session_date) : "?"} –{" "}
                            {sel.last_session_date ? formatDate(sel.last_session_date) : "?"}
                          </p>
                        )}
                      </div>
                      {seasonControls(sel)}
                    </div>
                  );
                })()}
              </>
            )}

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
                + {newPartLabel}
              </button>
            ) : (
              <div className="mt-3 border border-gray-200 rounded-lg p-3 bg-gray-50 space-y-2">
                <p className="text-xs font-semibold text-gray-700">{newPartLabel}</p>
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
                    {addSeasonLoading ? "Zapisuję..." : `Dodaj ${partLabel.toLowerCase()}`}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        <CastSection actors={actors} onOpenPerson={onOpenPerson} />

        {["movie", "series", "anime", "cartoon"].includes(media.media_type) && <VodSection media={media} />}

        {/* Calendar history section */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-gray-800">{historyLabel}</h3>
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
                ✂️ {splitMode ? "Anuluj podział" : `Podziel na ${partsLabel.toLowerCase()}`}
              </button>
              <SyncButtons media={media} sync={sync} />
            </div>
          </div>

          {/* External sync candidates panel */}
          <SyncCandidates sync={sync} />
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
                Przypisz {splitTarget.sessionIds.length} sesji ({splitTarget.dateRange}) do {partLabel.toLowerCase()}:
              </p>
              <div className="flex gap-4">
                <label className="flex items-center gap-1 text-sm text-gray-700 cursor-pointer">
                  <input type="radio" name="splitChoice" value="new" checked={splitSeasonChoice === "new"} onChange={() => setSplitSeasonChoice("new")} />
                  Nowa {partLabel.toLowerCase()}
                </label>
                <label className="flex items-center gap-1 text-sm text-gray-700 cursor-pointer">
                  <input type="radio" name="splitChoice" value="existing" checked={splitSeasonChoice === "existing"} onChange={() => setSplitSeasonChoice("existing")} />
                  Istniejąca {partLabel.toLowerCase()}
                </label>
              </div>
              {splitSeasonChoice === "new" && (
                <div className="flex gap-2">
                  <input
                    type="number" placeholder={`Nr ${partLabel.toLowerCase()}`} value={splitNewSeasonNumber}
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
                  <option value="">— wybierz {partLabel.toLowerCase()} —</option>
                  {seasons.map((s, idx) => (
                    <option key={s.id} value={s.id}>
                      {s.title ?? (partNo(seasons, idx, hasSpecials) === "Sp." ? "Speciale" : `${partLabel} ${partNo(seasons, idx, hasSpecials)}`)}
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
                {yearSelectedDates.size > 0 && media && SCREEN_TYPES.includes(media.media_type) && (
                  <label className="flex items-center gap-1.5 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={yearBatchWithChild}
                      onChange={(e) => setYearBatchWithChild(e.target.checked)}
                      className="w-4 h-4 accent-emerald-500"
                    />
                    <span className="text-xs text-gray-700">👶 z dzieckiem</span>
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
              <div className="grid grid-cols-3 gap-x-6 gap-y-6">
                {MONTH_NAMES.map((name, i) => (
                  <MonthGrid
                    key={name}
                    year={yearViewYear}
                    month={i + 1}
                    label={name}
                    days={sessionDaysMap}
                    selected={yearSelectedDates}
                    onDayClick={(date) =>
                      setYearSelectedDates((prev) => {
                        const next = new Set(prev);
                        if (next.has(date)) next.delete(date); else next.add(date);
                        return next;
                      })
                    }
                  />
                ))}
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex flex-wrap gap-6">
                {sortedMonths.map((key) => {
                  const [y, m] = key.split("-").map(Number);
                  const monthDays = grouped.get(key) ?? new Map<string, string>();
                  return (
                    <MonthGrid
                      key={key}
                      year={y}
                      month={m}
                      label={`${MONTH_NAMES[m - 1]} ${y}`}
                      days={monthDays}
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
