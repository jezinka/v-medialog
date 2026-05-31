"use client";

import { useEffect, useState, useCallback, useMemo, useRef } from "react";
import CoverImg from "./CoverImg";
import { MEDIA_TYPE_EMOJI, MEDIA_TYPE_LABELS, MEDIA_TYPE_COLORS, formatDate } from "@/lib/utils";
import { toast } from "./Toast";
import type { SuggestionGroup } from "@/app/api/universes/suggestions/route";

const PAGE_SIZE = 50;

interface MediaItem {
  id: number;
  title: string;
  original_title: string | null;
  author: string | null;
  media_type: string;
  cover_url: string | null;
  season_count: number;
  first_session_date: string | null;
  last_session_date: string | null;
  tmdb_id: string | null;
  series_status: string | null;
  tmdb_seasons_count: number | null;
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
}

interface Props {
  onOpenDetail: (mediaId: number) => void;
}

const TYPE_FILTERS = ["all", "series", "anime", "cartoon", "movie", "book", "comic", "play"] as const;
type TypeFilter = (typeof TYPE_FILTERS)[number];

export default function MediaLibraryView({ onOpenDetail }: Props) {
  const [items, setItems] = useState<MediaItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<TypeFilter>("all");
  const [noCoverOnly, setNoCoverOnly] = useState(false);
  const [ongoingOnly, setOngoingOnly] = useState(false);
  const [behindOnly, setBehindOnly] = useState(false);
  const [sortBy, setSortBy] = useState<"title" | "recently_added">("title");
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [seasons, setSeasons] = useState<Record<number, SeasonRow[]>>({});
  const [seasonsLoading, setSeasonsLoading] = useState<Set<number>>(new Set());
  const [selectedMedia, setSelectedMedia] = useState<Set<number>>(new Set());
  const [deleting, setDeleting] = useState(false);

  // Grouping suggestions
  const [suggestions, setSuggestions] = useState<SuggestionGroup[]>([]);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [dismissedSuggestions, setDismissedSuggestions] = useState<Set<string>>(new Set());
  const [applyingSuggestion, setApplyingSuggestion] = useState<string | null>(null);

  // Upcoming seasons job
  const [checkingUpcoming, setCheckingUpcoming] = useState(false);

  // Debounce search
  const searchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [debouncedSearch, setDebouncedSearch] = useState("");
  useEffect(() => {
    if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    searchDebounceRef.current = setTimeout(() => setDebouncedSearch(search), 300);
  }, [search]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), limit: String(PAGE_SIZE) });
      if (debouncedSearch) params.set("search", debouncedSearch);
      if (typeFilter !== "all") params.set("type", typeFilter);
      if (noCoverOnly) params.set("noCover", "1");
      if (ongoingOnly) params.set("ongoing", "1");
      if (behindOnly) params.set("behind", "1");
      if (sortBy === "recently_added") params.set("sortBy", "recently_added");
      const res = await fetch(`/api/media?${params.toString()}`);
      const data = await res.json() as { items: MediaItem[]; total: number; page: number };
      setItems(data.items);
      setTotal(data.total);
    } catch {
      toast("Błąd ładowania mediów", "error");
    } finally {
      setLoading(false);
    }
  }, [page, debouncedSearch, typeFilter, noCoverOnly, ongoingOnly, behindOnly, sortBy]);

  const fetchSuggestions = useCallback(async () => {
    setLoadingSuggestions(true);
    try {
      const res = await fetch("/api/universes/suggestions");
      if (res.ok) setSuggestions(await res.json());
    } catch { /* ignore */ } finally {
      setLoadingSuggestions(false);
    }
  }, []);

  const handleToggleSuggestions = () => {
    if (!showSuggestions) fetchSuggestions();
    setShowSuggestions((v) => !v);
  };

  const dismissSuggestion = (baseName: string) => {
    setDismissedSuggestions((prev) => new Set(prev).add(baseName));
  };

  /** Merge all items in the suggestion into one medium (the one with most seasons becomes target) */
  const handleApplySuggestion = async (suggestion: SuggestionGroup) => {
    setApplyingSuggestion(suggestion.base_name);
    try {
      const sorted = [...suggestion.items].sort((a, b) => b.season_count - a.season_count);
      const target = sorted[0];
      const source_ids = sorted.slice(1).map((i) => i.id);

      const res = await fetch("/api/media/merge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ target_media_id: target.id, source_ids }),
      });
      if (!res.ok) throw new Error(await res.text());
      const { merged } = await res.json() as { merged: number };

      toast(`Scalono ${merged} pozycj${merged === 1 ? "ę" : "i"} w "${target.title}"`, "success");
      void load();
      void fetchSuggestions();
    } catch (err) {
      toast(err instanceof Error ? err.message : "Błąd scalania", "error");
    } finally {
      setApplyingSuggestion(null);
    }
  };

  const handleCheckUpcoming = async () => {
    setCheckingUpcoming(true);
    try {
      const res = await fetch("/api/jobs/check-upcoming-seasons", { method: "POST" });
      const data = await res.json() as { added?: number; error?: string };
      if (!res.ok) { toast(data.error ?? "Błąd", "error"); return; }
      if ((data.added ?? 0) > 0) {
        toast(`Dodano ${data.added} nadchodzących sezon${data.added === 1 ? "" : "ów"} do listy!`, "success");
      } else {
        toast("Brak nowych sezonów do dodania", "info");
      }
    } catch { toast("Błąd sieci", "error"); } finally { setCheckingUpcoming(false); }
  };

  useEffect(() => { void load(); }, [load]);

  // Reset to page 1 when filters change
  useEffect(() => { setPage(1); }, [debouncedSearch, typeFilter, noCoverOnly, ongoingOnly, behindOnly, sortBy]);

  const totalPages = Math.ceil(total / PAGE_SIZE);

  const loadSeasons = useCallback(async (mediaId: number) => {
    if (seasons[mediaId]) return;
    setSeasonsLoading((prev) => new Set([...prev, mediaId]));
    try {
      const res = await fetch(`/api/seasons?media_id=${mediaId}`);
      const data = await res.json() as SeasonRow[];
      setSeasons((prev) => ({ ...prev, [mediaId]: data }));
    } catch {
      toast("Błąd ładowania sezonów", "error");
    } finally {
      setSeasonsLoading((prev) => { const n = new Set(prev); n.delete(mediaId); return n; });
    }
  }, [seasons]);

  const toggleExpand = (id: number) => {
    if (expandedId === id) {
      setExpandedId(null);
    } else {
      setExpandedId(id);
      void loadSeasons(id);
    }
  };

  const toggleSelect = (id: number) => {
    setSelectedMedia((prev) => {
      const n = new Set(prev);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });
  };

  const deleteSeason = async (season: SeasonRow) => {
    if (!confirm(`Usunąć "${season.title ?? `Sezon ${season.season_number}`}"?\nUsunie też wszystkie ${season.session_count} sesji.`)) return;
    try {
      const res = await fetch(`/api/seasons/${season.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Błąd usuwania");
      toast("Sezon usunięty ✓");
      setSeasons((prev) => ({
        ...prev,
        [season.media_id]: (prev[season.media_id] ?? []).filter((s) => s.id !== season.id),
      }));
      setItems((prev) => prev.map((m) => m.id === season.media_id
        ? { ...m, season_count: m.season_count - 1 }
        : m
      ));
    } catch {
      toast("Błąd usuwania sezonu", "error");
    }
  };

  const deleteMedia = async (medium: MediaItem) => {
    if (!confirm(`Usunąć "${medium.title}"?\nUsunie też wszystkie sezony i sesje.`)) return;
    try {
      const res = await fetch(`/api/media/${medium.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Błąd usuwania");
      toast(`"${medium.title}" usunięte ✓`);
      setItems((prev) => prev.filter((m) => m.id !== medium.id));
      setSelectedMedia((prev) => { const n = new Set(prev); n.delete(medium.id); return n; });
      if (expandedId === medium.id) setExpandedId(null);
    } catch {
      toast("Błąd usuwania medium", "error");
    }
  };

  const deleteSelected = async () => {
    if (selectedMedia.size === 0) return;
    const names = items.filter((m) => selectedMedia.has(m.id)).map((m) => `"${m.title}"`).join(", ");
    if (!confirm(`Usunąć ${selectedMedia.size} media: ${names}?\nUsunie też wszystkie sezony i sesje.`)) return;
    setDeleting(true);
    let deleted = 0;
    for (const id of selectedMedia) {
      try {
        const res = await fetch(`/api/media/${id}`, { method: "DELETE" });
        if (res.ok) deleted++;
      } catch { /* continue */ }
    }
    toast(`Usunięto ${deleted} mediów ✓`);
    setSelectedMedia(new Set());
    await load();
    setDeleting(false);
  };

  const seasonLabel = (s: SeasonRow) => {
    if (s.title) return s.title;
    if (s.season_number != null) return `Sezon ${s.season_number}`;
    return `Sezon #${s.id}`;
  };

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-3">
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Szukaj…"
          className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm w-56 focus:ring-2 focus:ring-purple-400 focus:outline-none"
        />
        <div className="flex gap-1 flex-wrap">
          {TYPE_FILTERS.map((t) => (
            <button
              key={t}
              onClick={() => setTypeFilter(t)}
              className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${
                typeFilter === t
                  ? "bg-purple-600 text-white border-purple-600"
                  : "border-gray-300 text-gray-600 hover:border-gray-400"
              }`}
            >
              {t === "all" ? "Wszystkie" : `${MEDIA_TYPE_EMOJI[t] ?? ""} ${MEDIA_TYPE_LABELS[t] ?? t}`}
            </button>
          ))}
          <button
            onClick={() => setNoCoverOnly((v) => !v)}
            className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${
              noCoverOnly
                ? "bg-orange-500 text-white border-orange-500"
                : "border-gray-300 text-gray-600 hover:border-gray-400"
            }`}
          >
            🖼️ Brak okładki
          </button>
          <button
            onClick={() => setOngoingOnly((v) => !v)}
            className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${
              ongoingOnly
                ? "bg-green-600 text-white border-green-600"
                : "border-gray-300 text-gray-600 hover:border-gray-400"
            }`}
          >
            📺 Trwające
          </button>
          <button
            onClick={() => setBehindOnly((v) => !v)}
            className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${
              behindOnly
                ? "bg-yellow-500 text-white border-yellow-500"
                : "border-gray-300 text-gray-600 hover:border-gray-400"
            }`}
          >
            ⏳ Niedokończone
          </button>
        </div>
        <span className="text-sm text-gray-500 ml-auto">{total} mediów</span>
        <div className="flex items-center gap-1 text-xs text-gray-500">
          <span>Sortuj:</span>
          <button
            onClick={() => setSortBy("title")}
            className={`px-2 py-1 rounded-full border transition-colors ${
              sortBy === "title"
                ? "bg-gray-700 text-white border-gray-700"
                : "border-gray-300 text-gray-600 hover:border-gray-400"
            }`}
          >
            A–Z
          </button>
          <button
            onClick={() => setSortBy("recently_added")}
            className={`px-2 py-1 rounded-full border transition-colors ${
              sortBy === "recently_added"
                ? "bg-gray-700 text-white border-gray-700"
                : "border-gray-300 text-gray-600 hover:border-gray-400"
            }`}
          >
            🆕 Ostatnio dodane
          </button>
        </div>
        <button
          onClick={handleToggleSuggestions}
          title="Sugestie scalania"
          className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${
            showSuggestions
              ? "bg-amber-500 text-white border-amber-500"
              : "border-amber-300 text-amber-600 hover:border-amber-400"
          }`}
        >
          💡 Sugestie scalania
        </button>
        <button
          onClick={handleCheckUpcoming}
          disabled={checkingUpcoming}
          title="Sprawdź nowe sezony w TMDB"
          className="text-xs px-2.5 py-1 rounded-full border border-blue-300 text-blue-600 hover:border-blue-400 transition-colors disabled:opacity-50"
        >
          {checkingUpcoming ? "⏳ Sprawdzam…" : "📡 Nowe sezony"}
        </button>
        {selectedMedia.size > 0 && (
          <button
            onClick={deleteSelected}
            disabled={deleting}
            className="text-xs px-3 py-1.5 rounded bg-red-600 text-white hover:bg-red-700 disabled:opacity-50"
          >
            {deleting ? "Usuwanie…" : `🗑️ Usuń zaznaczone (${selectedMedia.size})`}
          </button>
        )}
      </div>

      {/* Suggestions panel */}
      {showSuggestions && (
        <div className="border border-amber-200 bg-amber-50 rounded-xl p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-amber-900">💡 Sugestie scalania</h2>
            <button onClick={() => setShowSuggestions(false)} className="text-xs text-amber-400 hover:text-amber-600">✕</button>
          </div>
          {loadingSuggestions ? (
            <div className="flex justify-center py-4">
              <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-amber-500" />
            </div>
          ) : suggestions.filter((s) => !dismissedSuggestions.has(s.base_name)).length === 0 ? (
            <div className="text-xs text-amber-700 text-center py-3">Brak sugestii — wszystko wygląda OK 🎉</div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {suggestions
                .filter((s) => !dismissedSuggestions.has(s.base_name))
                .map((suggestion) => (
                  <div key={suggestion.base_name} className="bg-white border border-amber-200 rounded-xl p-3 space-y-2">
                    <div className="flex items-start justify-between gap-1">
                      <p className="text-xs font-semibold text-amber-900 capitalize">{suggestion.base_name}</p>
                      <button
                        onClick={() => dismissSuggestion(suggestion.base_name)}
                        className="text-amber-300 hover:text-amber-500 text-xs shrink-0"
                      >
                        ✕
                      </button>
                    </div>
                    <div className="space-y-1">
                      {suggestion.items.map((item) => (
                        <div key={item.id} className="flex items-center gap-1.5 text-xs">
                          <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-medium ${MEDIA_TYPE_COLORS[item.media_type] ?? "bg-gray-100 text-gray-600"}`}>
                            {MEDIA_TYPE_LABELS[item.media_type] ?? item.media_type}
                          </span>
                          <span className="text-gray-700 truncate flex-1">{item.title}</span>
                          <span className="text-[10px] text-gray-400 shrink-0">{item.season_count}s</span>
                        </div>
                      ))}
                    </div>
                    <button
                      onClick={() => handleApplySuggestion(suggestion)}
                      disabled={applyingSuggestion === suggestion.base_name}
                      className="w-full bg-amber-500 hover:bg-amber-600 text-white text-xs font-medium py-1.5 rounded-lg transition-colors disabled:opacity-50"
                    >
                      {applyingSuggestion === suggestion.base_name ? "Scalanie…" : "Scal w jedno medium"}
                    </button>
                  </div>
                ))}
            </div>
          )}
        </div>
      )}

      {/* List */}
      <div className="divide-y divide-gray-100 border border-gray-200 rounded-xl overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-10">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-gray-400" />
          </div>
        ) : items.length === 0 ? (
          <p className="text-sm text-gray-500 p-6 text-center">Brak wyników</p>
        ) : (
          items.map((medium) => {
            const isExpanded = expandedId === medium.id;
            const isSelected = selectedMedia.has(medium.id);
            const mediaSeasons = seasons[medium.id] ?? [];
            const isLoadingSeasons = seasonsLoading.has(medium.id);

            return (
              <div key={medium.id} className={`transition-colors ${isSelected ? "bg-red-50" : "bg-white"}`}>
                {/* Medium row */}
                <div className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50">
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={() => toggleSelect(medium.id)}
                    className="cursor-pointer shrink-0"
                  />

                  {/* Cover */}
                  <div className="w-8 h-10 shrink-0 rounded overflow-hidden bg-gray-100">
                    {medium.cover_url ? (
                      <CoverImg src={medium.cover_url} alt={medium.title} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-gray-400 text-lg">
                        {MEDIA_TYPE_EMOJI[medium.media_type] ?? "📄"}
                      </div>
                    )}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <a
                      href={`/media/${medium.id}`}
                      className="font-medium text-gray-900 hover:text-purple-700 text-left truncate block max-w-xs"
                    >
                      {medium.title}
                    </a>
                    <div className="flex items-center gap-2 text-xs text-gray-500 mt-0.5">
                      <span>{MEDIA_TYPE_EMOJI[medium.media_type]} {MEDIA_TYPE_LABELS[medium.media_type] ?? medium.media_type}</span>
                      {medium.author && <span>· {medium.author}</span>}
                      {medium.last_session_date && (
                        <span>· ostatnio {formatDate(medium.last_session_date)}</span>
                      )}
                      {medium.series_status && (
                        <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${
                          medium.series_status === "Ended" || medium.series_status === "Canceled"
                            ? "bg-gray-100 text-gray-500"
                            : medium.series_status === "Returning Series"
                            ? "bg-green-100 text-green-700"
                            : "bg-blue-100 text-blue-700"
                        }`}>
                          {medium.series_status}
                          {medium.tmdb_seasons_count != null && ` · ${medium.season_count}/${medium.tmdb_seasons_count} sez.`}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Season count + expand */}
                  <button
                    onClick={() => toggleExpand(medium.id)}
                    className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-purple-700 px-2 py-1 rounded hover:bg-purple-50 transition-colors shrink-0"
                  >
                    <span className="font-mono bg-gray-100 rounded px-1.5 py-0.5 text-gray-700">
                      {medium.season_count}
                    </span>
                    sezon{medium.season_count === 1 ? "" : "y/ów"}
                    <span className={`transition-transform ${isExpanded ? "rotate-180" : ""}`}>▾</span>
                  </button>

                  {/* Delete */}
                  <button
                    onClick={() => deleteMedia(medium)}
                    className="text-red-400 hover:text-red-600 text-sm px-1 shrink-0"
                    title="Usuń medium"
                  >
                    🗑️
                  </button>
                </div>

                {/* Expanded seasons */}
                {isExpanded && (
                  <div className="bg-gray-50 border-t border-gray-100 px-4 py-3">
                    {isLoadingSeasons ? (
                      <p className="text-xs text-gray-400 py-2">Ładowanie…</p>
                    ) : mediaSeasons.length === 0 ? (
                      <p className="text-xs text-gray-400 py-2">Brak sezonów</p>
                    ) : (
                      <div className="space-y-1.5">
                        {mediaSeasons.map((s) => (
                          <div key={s.id} className="flex items-center gap-3 bg-white rounded-lg px-3 py-2 border border-gray-100">
                            {/* Mini cover */}
                            <div className="w-6 h-8 shrink-0 rounded overflow-hidden bg-gray-100">
                              {s.cover_url ? (
                                <CoverImg src={s.cover_url} alt={seasonLabel(s)} className="w-full h-full object-cover" />
                              ) : (
                                <div className="w-full h-full bg-gray-200" />
                              )}
                            </div>
                            <div className="flex-1 min-w-0">
                              <span className="text-sm font-medium text-gray-800">{seasonLabel(s)}</span>
                              <div className="text-xs text-gray-400 mt-0.5 flex gap-2">
                                <span>{s.session_count} sesji</span>
                                {s.first_session_date && (
                                  <span>{formatDate(s.first_session_date)}{s.last_session_date && s.last_session_date !== s.first_session_date ? ` – ${formatDate(s.last_session_date)}` : ""}</span>
                                )}
                              </div>
                            </div>
                            <button
                              onClick={() => deleteSeason(s)}
                              className="text-xs text-red-400 hover:text-red-600 px-1"
                              title="Usuń sezon"
                            >
                              🗑️
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-1 pt-2">
          <button
            onClick={() => setPage(1)}
            disabled={page === 1}
            className="px-2 py-1 text-xs rounded border border-gray-200 text-gray-600 hover:bg-gray-50 disabled:opacity-40"
          >
            «
          </button>
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
            className="px-2 py-1 text-xs rounded border border-gray-200 text-gray-600 hover:bg-gray-50 disabled:opacity-40"
          >
            ‹
          </button>
          {Array.from({ length: totalPages }, (_, i) => i + 1)
            .filter((p) => p === 1 || p === totalPages || Math.abs(p - page) <= 2)
            .reduce<(number | "...")[]>((acc, p, idx, arr) => {
              if (idx > 0 && p - (arr[idx - 1] as number) > 1) acc.push("...");
              acc.push(p);
              return acc;
            }, [])
            .map((p, i) =>
              p === "..." ? (
                <span key={`ellipsis-${i}`} className="px-2 text-xs text-gray-400">…</span>
              ) : (
                <button
                  key={p}
                  onClick={() => setPage(p as number)}
                  className={`px-2.5 py-1 text-xs rounded border transition-colors ${
                    page === p
                      ? "bg-purple-600 text-white border-purple-600"
                      : "border-gray-200 text-gray-600 hover:bg-gray-50"
                  }`}
                >
                  {p}
                </button>
              )
            )}
          <button
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
            className="px-2 py-1 text-xs rounded border border-gray-200 text-gray-600 hover:bg-gray-50 disabled:opacity-40"
          >
            ›
          </button>
          <button
            onClick={() => setPage(totalPages)}
            disabled={page === totalPages}
            className="px-2 py-1 text-xs rounded border border-gray-200 text-gray-600 hover:bg-gray-50 disabled:opacity-40"
          >
            »
          </button>
          <span className="text-xs text-gray-400 ml-2">
            {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, total)} z {total}
          </span>
        </div>
      )}
    </div>
  );
}
