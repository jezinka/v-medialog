"use client";
import { useEffect, useState, useMemo } from "react";
import Image from "next/image";
import CoverImg from "./CoverImg";
import { MEDIA_TYPE_COLORS, MEDIA_TYPE_LABELS, MEDIA_TYPE_ICONS, formatDate } from "@/lib/utils";
import { toast } from "./Toast";

interface SeriesItem {
  id: number;
  title: string;
  originalTitle: string | null;
  author: string | null;
  mediaType: string;
  startDate: string;
  endDate: string | null;
  volumeEpisode: string | null;
  tags: string | null;
  notes: string | null;
  discontinued: boolean | null;
  coverUrl: string | null;
  cinema: boolean | number | null;
  additionalSessions?: string | null;
  tagList?: { id: number; name: string }[];
  parentId?: number | null;
}

interface SeriesGroup {
  key: string;
  title: string;
  originalTitle: string | null;
  coverUrl: string | null;
  mediaType: string;
  seasons: SeriesItem[];
}

interface TmdbCandidate {
  tmdb_id: number;
  name: string;
  first_air_date: string;
  poster_path: string | null;
}

type RefreshStatus =
  | { status: "idle" }
  | { status: "loading"; current?: number; total?: number }
  | { status: "candidates"; candidates: TmdbCandidate[] }
  | { status: "done"; count: number }
  | { status: "error"; message: string };

function getEffectiveEndDate(item: SeriesItem): string | null {
  try {
    const sessions = item.additionalSessions
      ? (JSON.parse(item.additionalSessions) as Array<{ start_date: string; end_date: string }>)
      : [];
    if (sessions.length > 0) {
      const lastSession = sessions[sessions.length - 1];
      return lastSession.end_date || lastSession.start_date;
    }
  } catch {}
  return item.endDate;
}

function sessionCount(item: SeriesItem): number {
  try {
    const s = item.additionalSessions ? JSON.parse(item.additionalSessions) : [];
    return 1 + (Array.isArray(s) ? s.length : 0);
  } catch {
    return 1;
  }
}

interface SeriesViewProps {
  onItemClick?: (item: SeriesItem) => void;
}

export default function SeriesView({ onItemClick }: SeriesViewProps = {}) {
  const [allItems, setAllItems] = useState<SeriesItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshStates, setRefreshStates] = useState<Record<string, RefreshStatus>>({});
  const [groupingStates, setGroupingStates] = useState<Record<string, "idle" | "loading" | "done" | "error">>({});
  const [search, setSearch] = useState("");

  const loadData = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/media?all=true");
      const data = await res.json();
      setAllItems(
        (data as SeriesItem[]).filter(
          (i) => i.mediaType === "series" || i.mediaType === "anime"
        )
      );
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadData(); }, []);

  const groupSeasons = async (group: SeriesGroup) => {
    setGroupingStates((prev) => ({ ...prev, [group.key]: "loading" }));
    try {
      const res = await fetch("/api/media/group", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ item_ids: group.seasons.map((s) => s.id) }),
      });
      if (!res.ok) throw new Error();
      setGroupingStates((prev) => ({ ...prev, [group.key]: "done" }));
      toast("Zgrupowano sezony ✓", "success");
      await loadData();
    } catch {
      setGroupingStates((prev) => ({ ...prev, [group.key]: "error" }));
      toast("Błąd grupowania", "error");
    }
  };

  const groups = useMemo<SeriesGroup[]>(() => {
    const q = search.trim().toLowerCase();
    const filtered = q
      ? allItems.filter(
          (i) =>
            i.title.toLowerCase().includes(q) ||
            (i.originalTitle ?? "").toLowerCase().includes(q)
        )
      : allItems;

    // Collect IDs that are used as parentId by other items — these are container records
    const parentContainerIds = new Set<number>(
      allItems.filter((i) => i.parentId != null).map((i) => i.parentId!)
    );

    // Exclude container records from the seasons list
    const visibleItems = filtered.filter((i) => !parentContainerIds.has(i.id));

    const map = new Map<string, SeriesItem[]>();
    for (const item of visibleItems) {
      const key = (item.originalTitle?.trim() || item.title.trim());
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(item);
    }

    return [...map.entries()]
      .map(([key, seasons]) => {
        const sorted = [...seasons].sort(
          (a, b) =>
            parseInt(a.volumeEpisode || "0") - parseInt(b.volumeEpisode || "0") ||
            a.startDate.localeCompare(b.startDate)
        );
        return {
          key,
          title: sorted[0].title,
          originalTitle: sorted[0].originalTitle,
          coverUrl: sorted.find((s) => s.coverUrl)?.coverUrl ?? null,
          mediaType: sorted[0].mediaType,
          seasons: sorted,
        };
      })
      .sort((a, b) => a.title.localeCompare(b.title, "pl"));
  }, [allItems, search]);

  const refreshAllSeasons = async (group: SeriesGroup, tmdbId?: number) => {
    setRefreshStates((prev) => ({
      ...prev,
      [group.key]: { status: "loading", current: 0, total: group.seasons.length },
    }));

    try {
      // Step 1: find tmdb_id (unless already known)
      let resolvedId = tmdbId;
      if (!resolvedId) {
        const params = new URLSearchParams({ title: group.title, season: "1" });
        if (group.originalTitle) params.set("original_title", group.originalTitle);
        const res = await fetch(`/api/tmdb/season?${params}`);
        const data = await res.json();

        if (data.candidates) {
          setRefreshStates((prev) => ({
            ...prev,
            [group.key]: { status: "candidates", candidates: data.candidates },
          }));
          return;
        }
        if (!res.ok) {
          setRefreshStates((prev) => ({
            ...prev,
            [group.key]: { status: "error", message: data.error ?? "Błąd TMDB" },
          }));
          return;
        }
        resolvedId = data.tmdb_id;
      }

      // Step 2: fetch and apply each season
      let successCount = 0;
      for (let i = 0; i < group.seasons.length; i++) {
        const season = group.seasons[i];
        setRefreshStates((prev) => ({
          ...prev,
          [group.key]: { status: "loading", current: i + 1, total: group.seasons.length },
        }));

        // Use volumeEpisode if it's a valid positive integer; otherwise fall back to
        // 1-based index so that two seasons without a number get S1 and S2 respectively
        const rawSeason = parseInt(season.volumeEpisode || "");
        const seasonNum = rawSeason > 0 ? rawSeason : i + 1;
        const sParams = new URLSearchParams({
          title: group.title,
          season: String(seasonNum),
          tmdb_id: String(resolvedId),
        });
        try {
          const sRes = await fetch(`/api/tmdb/season?${sParams}`);
          const sData = await sRes.json();
          if (!sRes.ok || !sData.start_date) continue;

          const episodeDates: string[] = sData.episode_dates ?? [];
          const mainDate = episodeDates[0] ?? sData.start_date;
          let additionalSessions: string | null = null;
          if (episodeDates.length > 1) {
            additionalSessions = JSON.stringify(
              episodeDates.slice(1).map((d) => ({ start_date: d, end_date: d }))
            );
          }

          await fetch(`/api/media/${season.id}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              title: season.title,
              original_title: season.originalTitle ?? "",
              author: season.author ?? "",
              media_type: season.mediaType,
              start_date: mainDate,
              end_date: mainDate,
              volume_episode: season.volumeEpisode ?? "",
              tags:
                season.tagList?.map((t) => t.name).join(", ") ??
                season.tags ?? "",
              notes: season.notes ?? "",
              discontinued: season.discontinued ?? false,
              cover_url: season.coverUrl ?? "",
              cinema: season.cinema ?? false,
              additional_sessions: additionalSessions,
            }),
          });
          successCount++;
        } catch {
          // skip failed season, continue
        }
      }

      setRefreshStates((prev) => ({
        ...prev,
        [group.key]: { status: "done", count: successCount },
      }));
      toast(`Odświeżono ${successCount} / ${group.seasons.length} sezonów`, "success");
      await loadData();
    } catch {
      setRefreshStates((prev) => ({
        ...prev,
        [group.key]: { status: "error", message: "Błąd sieci" },
      }));
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-400" />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Search */}
      <div className="bg-white rounded-2xl shadow border border-gray-100 p-4">
        <input
          type="text"
          placeholder="Szukaj serialu..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full border border-gray-200 rounded-lg px-4 py-2 text-sm text-gray-800 placeholder-gray-400 focus:ring-2 focus:ring-gray-300 focus:outline-none"
        />
        <p className="text-xs text-gray-400 mt-2">
          {groups.length} {groups.length === 1 ? "serial" : "seriale/i/ów"} · {allItems.length} wpisów
        </p>
      </div>

      {/* Series grid */}
      <div className="space-y-4">
        {groups.map((group) => {
          const rs = refreshStates[group.key] ?? { status: "idle" };
          const gs = groupingStates[group.key] ?? "idle";
          const hasParentId = group.seasons.some((s) => s.parentId != null);
          const typeIcon = MEDIA_TYPE_ICONS[group.mediaType];
          const typeColor = MEDIA_TYPE_COLORS[group.mediaType] || "bg-gray-100 text-gray-700";

          return (
            <div
              key={group.key}
              className="bg-white rounded-2xl shadow border border-gray-100 overflow-hidden"
            >
              {/* Series header */}
              <div className="flex items-start gap-4 p-4 border-b border-gray-50">
                {/* Cover */}
                <div className="shrink-0">
                  {group.coverUrl ? (
                    <div className="relative w-14 h-20 rounded-lg overflow-hidden border border-gray-200 shadow-sm">
                      <CoverImg
                        src={group.coverUrl}
                        alt={group.title}
                        fill
                        className="object-cover"
                        sizes="56px"
                      />
                    </div>
                  ) : (
                    <div
                      className={`w-14 h-20 rounded-lg flex items-center justify-center ${typeColor}`}
                    >
                      {typeIcon ? (
                        <Image src={typeIcon} alt="" width={28} height={28} className="object-contain" />
                      ) : (
                        <span className="text-2xl">📺</span>
                      )}
                    </div>
                  )}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${typeColor}`}
                        >
                          {typeIcon && (
                            <Image
                              src={typeIcon}
                              alt=""
                              width={10}
                              height={10}
                              className="object-contain"
                            />
                          )}
                          {MEDIA_TYPE_LABELS[group.mediaType] || group.mediaType}
                        </span>
                        <h3 className="font-semibold text-gray-900">{group.title}</h3>
                        <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">
                          {group.seasons.length}{" "}
                          {group.seasons.length === 1 ? "sezon" : "sezonów"}
                        </span>
                      </div>
                      {group.originalTitle && group.originalTitle !== group.title && (
                        <p className="text-xs text-gray-400 italic mt-0.5">
                          {group.originalTitle}
                        </p>
                      )}
                    </div>

                    {/* Action buttons */}
                    <div className="flex items-center gap-2 shrink-0">
                      {/* Group seasons button */}
                      {!hasParentId && group.seasons.length > 1 && (
                        <button
                          onClick={() => gs !== "loading" && groupSeasons(group)}
                          disabled={gs === "loading"}
                          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors disabled:opacity-50"
                          title="Zgrupuj sezony w bazie danych"
                          style={
                            gs === "done"
                              ? { borderColor: "#86efac", color: "#16a34a", background: "#f0fdf4" }
                              : gs === "error"
                              ? { borderColor: "#fca5a5", color: "#dc2626", background: "#fef2f2" }
                              : { borderColor: "#c7d2fe", color: "#4338ca", background: "#eef2ff" }
                          }
                        >
                          {gs === "loading" ? "Grupowanie..." : gs === "done" ? "✅ Zgrupowano" : gs === "error" ? "⚠️ Błąd" : "🔗 Grupuj sezony"}
                        </button>
                      )}

                      {/* Refresh button */}
                      <button
                        onClick={() =>
                          rs.status !== "loading" && refreshAllSeasons(group)
                        }
                        disabled={rs.status === "loading"}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors disabled:opacity-50"
                        title="Pobierz daty odcinków z TMDB dla wszystkich sezonów"
                        style={
                          rs.status === "done"
                            ? { borderColor: "#86efac", color: "#16a34a", background: "#f0fdf4" }
                            : rs.status === "error"
                            ? { borderColor: "#fca5a5", color: "#dc2626", background: "#fef2f2" }
                            : { borderColor: "#d1d5db", color: "#4b5563", background: "white" }
                        }
                      >
                        {rs.status === "loading" ? (
                          <>
                            <span className="animate-spin text-xs">⏳</span>
                            {rs.current != null && rs.total != null
                              ? `${rs.current}/${rs.total}`
                              : "Pobieranie..."}
                          </>
                        ) : rs.status === "done" ? (
                          <>✅ Zaktualizowano</>
                        ) : rs.status === "error" ? (
                          <>⚠️ Błąd</>
                        ) : (
                          <>
                            <Image
                              src="/icons/icons8-tv-show-96.png"
                              alt=""
                              width={14}
                              height={14}
                              className="object-contain"
                            />
                            Odśwież z TMDB
                          </>
                        )}
                      </button>
                    </div>
                  </div>

                  {/* TMDB candidates picker */}
                  {rs.status === "candidates" && (
                    <div className="mt-2 space-y-1">
                      <p className="text-xs text-gray-500 font-medium">Wybierz serial z TMDB:</p>
                      {rs.candidates.map((c) => (
                        <button
                          key={c.tmdb_id}
                          onClick={() => refreshAllSeasons(group, c.tmdb_id)}
                          className="flex items-center gap-2 text-left text-xs bg-white hover:bg-blue-50 border border-gray-200 rounded px-2 py-1.5 w-full transition-colors"
                        >
                          {c.poster_path && (
                            <img
                              src={c.poster_path}
                              alt=""
                              className="w-5 h-7 object-cover rounded shrink-0"
                            />
                          )}
                          <span className="truncate">
                            {c.name}{" "}
                            <span className="text-gray-400">
                              {c.first_air_date?.slice(0, 4)}
                            </span>
                          </span>
                        </button>
                      ))}
                      <button
                        onClick={() =>
                          setRefreshStates((p) => ({
                            ...p,
                            [group.key]: { status: "idle" },
                          }))
                        }
                        className="text-xs text-gray-400 hover:text-gray-600"
                      >
                        ✕ Anuluj
                      </button>
                    </div>
                  )}

                  {rs.status === "error" && (
                    <p className="text-xs text-red-500 mt-1">{rs.message}</p>
                  )}
                </div>
              </div>

              {/* Seasons list */}
              <div className="divide-y divide-gray-50">
                {group.seasons.map((season) => {
                  const sc = sessionCount(season);
                  return (
                    <div
                      key={season.id}
                      className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50 transition-colors"
                    >
                      {/* Season thumbnail */}
                      {season.coverUrl ? (
                        <div
                          className={`relative w-8 h-11 rounded overflow-hidden border border-gray-100 shrink-0${onItemClick ? " cursor-pointer" : ""}`}
                          onClick={() => onItemClick?.(season)}
                        >
                          <CoverImg
                            src={season.coverUrl}
                            alt=""
                            fill
                            className="object-cover"
                            sizes="32px"
                          />
                        </div>
                      ) : (
                        <div className="w-8 h-11 rounded bg-gray-100 shrink-0" />
                      )}

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          {season.volumeEpisode && (
                            <span
                              className={`text-xs font-semibold text-gray-700 bg-gray-100 px-1.5 py-0.5 rounded${onItemClick ? " cursor-pointer hover:text-blue-600" : ""}`}
                              onClick={() => onItemClick?.(season)}
                            >
                              S{season.volumeEpisode}
                            </span>
                          )}
                          {season.discontinued && (
                            <span className="text-xs text-red-400 font-medium">Porzucone</span>
                          )}
                        </div>
                        <div className="text-xs text-gray-500 mt-0.5">
                          {formatDate(season.startDate)}
                          {(() => {
                            const eff = getEffectiveEndDate(season);
                            return eff && eff !== season.startDate ? ` – ${formatDate(eff)}` : "";
                          })()}
                        </div>
                      </div>

                      <div className="text-xs text-gray-400 shrink-0 text-right">
                        <span className={sc > 1 ? "text-blue-500 font-medium" : ""}>
                          {sc} {sc === 1 ? "odcinek" : sc < 5 ? "odcinki" : "odcinków"}
                        </span>
                        {season.notes && (
                          <div className="text-gray-300 truncate max-w-[120px]">
                            {season.notes}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}

        {groups.length === 0 && (
          <div className="bg-white rounded-2xl shadow border border-gray-100 p-12 text-center">
            <Image
              src="/icons/icons8-nothing-found-96.png"
              alt=""
              width={48}
              height={48}
              className="mx-auto mb-3 opacity-30"
            />
            <p className="text-gray-400 text-sm">Brak seriali</p>
          </div>
        )}
      </div>
    </div>
  );
}
