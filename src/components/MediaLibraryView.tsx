"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { toast } from "./Toast";
import type { SuggestionGroup } from "@/app/api/universes/suggestions/route";
import LibraryToolbar from "./library/LibraryToolbar";
import SuggestionsPanel from "./library/SuggestionsPanel";
import MediaRow from "./library/MediaRow";
import Pagination from "./library/Pagination";
import type { MediaItem, SeasonRow, SortBy, TypeFilter } from "./library/types";

const PAGE_SIZE = 50;

export default function MediaLibraryView() {
  const [items, setItems] = useState<MediaItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<TypeFilter>("all");
  const [noCoverOnly, setNoCoverOnly] = useState(false);
  const [ongoingOnly, setOngoingOnly] = useState(false);
  const [behindOnly, setBehindOnly] = useState(false);
  const [hideDiscontinued, setHideDiscontinued] = useState(false);
  const [withChildOnly, setWithChildOnly] = useState(false);
  const [cinemaOnly, setCinemaOnly] = useState(false);
  const [sortBy, setSortBy] = useState<SortBy>("title");
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
      if (hideDiscontinued) params.set("hide_discontinued", "1");
      if (withChildOnly) params.set("with_child", "1");
      if (cinemaOnly) params.set("cinema", "1");
      if (sortBy === "recently_added") params.set("sortBy", "recently_added");
      if (sortBy === "last_session") params.set("sortBy", "last_session");
      const res = await fetch(`/api/media?${params.toString()}`);
      const data = await res.json() as { items: MediaItem[]; total: number; page: number };
      setItems(data.items.map((item) => ({
        ...item,
        has_child_session: Boolean(Number(item.has_child_session ?? 0)),
        has_cinema_session: Boolean(Number(item.has_cinema_session ?? 0)),
      })));
      setTotal(data.total);
    } catch {
      toast("Błąd ładowania mediów", "error");
    } finally {
      setLoading(false);
    }
  }, [page, debouncedSearch, typeFilter, noCoverOnly, ongoingOnly, behindOnly, hideDiscontinued, withChildOnly, cinemaOnly, sortBy]);

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
      const data = await res.json() as { added?: number; error?: string; items?: Array<{ title: string; season: number }> };
      if (!res.ok) { toast(data.error ?? "Błąd", "error"); return; }
      if ((data.added ?? 0) > 0) {
        const titles = (data.items ?? []).map((i) => `${i.title} S${i.season}`);
        const summary = titles.length > 0 ? `: ${titles.slice(0, 5).join(", ")}${titles.length > 5 ? ` +${titles.length - 5}` : ""}` : "";
        toast(`Dodano ${data.added} nadchodzących sezon${data.added === 1 ? "" : "ów"} do listy „Do obejrzenia”${summary}!`, "success");
      } else {
        toast("Brak nowych sezonów do dodania", "info");
      }
    } catch { toast("Błąd sieci", "error"); } finally { setCheckingUpcoming(false); }
  };

  useEffect(() => { void load(); }, [load]);

  // Reset to page 1 when filters change
  useEffect(() => { setPage(1); }, [debouncedSearch, typeFilter, noCoverOnly, ongoingOnly, behindOnly, hideDiscontinued, withChildOnly, cinemaOnly, sortBy]);

  const loadSeasons = useCallback(async (mediaId: number) => {
    if (seasons[mediaId]) return;
    setSeasonsLoading((prev) => new Set([...prev, mediaId]));
    try {
      const res = await fetch(`/api/seasons?media_id=${mediaId}`);
      const data = await res.json() as SeasonRow[];
      setSeasons((prev) => ({
        ...prev,
        [mediaId]: data.map((season) => ({
          ...season,
          has_child_session: Boolean(Number(season.has_child_session ?? 0)),
          has_cinema_session: Boolean(Number(season.has_cinema_session ?? 0)),
        })),
      }));
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
      if (n.has(id)) n.delete(id); else n.add(id);
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

  return (
    <div className="space-y-4">
      <LibraryToolbar
        search={search} setSearch={setSearch}
        typeFilter={typeFilter} setTypeFilter={setTypeFilter}
        noCoverOnly={noCoverOnly} setNoCoverOnly={setNoCoverOnly}
        ongoingOnly={ongoingOnly} setOngoingOnly={setOngoingOnly}
        behindOnly={behindOnly} setBehindOnly={setBehindOnly}
        hideDiscontinued={hideDiscontinued} setHideDiscontinued={setHideDiscontinued}
        withChildOnly={withChildOnly} setWithChildOnly={setWithChildOnly}
        cinemaOnly={cinemaOnly} setCinemaOnly={setCinemaOnly}
        sortBy={sortBy} setSortBy={setSortBy}
        total={total}
        showSuggestions={showSuggestions} handleToggleSuggestions={handleToggleSuggestions}
        checkingUpcoming={checkingUpcoming} handleCheckUpcoming={handleCheckUpcoming}
        selectedCount={selectedMedia.size} deleting={deleting} deleteSelected={deleteSelected}
      />

      {showSuggestions && (
        <SuggestionsPanel
          suggestions={suggestions}
          loadingSuggestions={loadingSuggestions}
          dismissedSuggestions={dismissedSuggestions}
          applyingSuggestion={applyingSuggestion}
          onClose={() => setShowSuggestions(false)}
          dismissSuggestion={dismissSuggestion}
          handleApplySuggestion={handleApplySuggestion}
        />
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
          items.map((medium) => (
            <MediaRow
              key={medium.id}
              medium={medium}
              isExpanded={expandedId === medium.id}
              isSelected={selectedMedia.has(medium.id)}
              mediaSeasons={seasons[medium.id] ?? []}
              isLoadingSeasons={seasonsLoading.has(medium.id)}
              toggleSelect={toggleSelect}
              toggleExpand={toggleExpand}
              deleteMedia={deleteMedia}
              deleteSeason={deleteSeason}
            />
          ))
        )}
      </div>

      <Pagination page={page} total={total} pageSize={PAGE_SIZE} setPage={setPage} />
    </div>
  );
}
