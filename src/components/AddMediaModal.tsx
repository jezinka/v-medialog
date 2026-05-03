"use client";
import { useState, useRef, useEffect } from "react";
import CoverImg from "./CoverImg";
import { MEDIA_TYPES, MEDIA_TYPE_LABELS, MEDIA_TYPE_COLORS, BOOK_TYPES } from "@/lib/utils";
import { toast } from "./Toast";

interface ApiMediaItem {
  id: number;
  title: string;
  original_title: string | null;
  author: string | null;
  media_type: string;
  cover_url: string | null;
  tmdb_id: string | null;
}

interface Props {
  onClose: () => void;
  onSelect: (mediaId: number, startDate?: string, endDate?: string) => void;
  initialStartDate?: string;
  initialEndDate?: string;
}

export default function AddMediaModal({ onClose, onSelect, initialStartDate, initialEndDate }: Props) {
  const [allMedia, setAllMedia] = useState<ApiMediaItem[]>([]);
  const [mediaSearch, setMediaSearch] = useState("");
  const [filteredMedia, setFilteredMedia] = useState<ApiMediaItem[]>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [createForm, setCreateForm] = useState({
    title: "",
    original_title: "",
    author: "",
    media_type: "book",
    universe_id: "",
    cover_url: "",
    description: "",
    tmdb_id: "",
  });
  const [createLoading, setCreateLoading] = useState(false);
  const [addToWishlist, setAddToWishlist] = useState(false);
  const [lcUrl, setLcUrl] = useState("");
  const [lcLoading, setLcLoading] = useState(false);
  const [tmdbUrl, setTmdbUrl] = useState("");
  const [tmdbLoading, setTmdbLoading] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    fetch("/api/media?all=true")
      .then((r) => r.json())
      .then((data: ApiMediaItem[]) => setAllMedia(data))
      .catch(() => {});
  }, []);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setFilteredMedia([]);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const handleSearchChange = (val: string) => {
    setMediaSearch(val);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      if (val.trim().length >= 2) {
        const q = val.toLowerCase();
        setFilteredMedia(
          allMedia
            .filter(
              (m) =>
                m.title.toLowerCase().includes(q) ||
                (m.original_title?.toLowerCase().includes(q) ?? false)
            )
            .slice(0, 8)
        );
      } else {
        setFilteredMedia([]);
      }
    }, 300);
  };

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
      setCreateForm((f) => ({
        ...f,
        title: data.title || f.title,
        original_title: data.original_title || f.original_title,
        author: data.author || f.author,
        cover_url: data.cover_url || f.cover_url,
        description: data.description || f.description,
        media_type: "book",
      }));
      setShowCreate(true);
      toast("Dane pobrane ✓", "success");
    } catch {
      toast("Błąd połączenia", "error");
    } finally {
      setLcLoading(false);
    }
  };

  const handleTmdbFetch = async () => {
    if (!tmdbUrl.trim()) return;
    // Parse TMDB URL: themoviedb.org/movie/12345 or themoviedb.org/tv/12345
    const match = tmdbUrl.match(/themoviedb\.org\/(movie|tv)\/(\d+)/);
    if (!match) { toast("Nieprawidłowy link TMDB (oczekiwano .../movie/ID lub .../tv/ID)", "error"); return; }
    const [, tmdbType, tmdbId] = match;
    const type = tmdbType === "movie" ? "movie" : "series";
    setTmdbLoading(true);
    try {
      const res = await fetch(`/api/tmdb/info?tmdb_id=${tmdbId}&type=${type}`);
      const data = await res.json();
      if (!res.ok) { toast(data.error ?? "Błąd TMDB", "error"); return; }
      setCreateForm((f) => ({
        ...f,
        title: data.title || f.title,
        original_title: data.original_title || f.original_title,
        author: data.director || f.author,
        cover_url: data.poster_url || f.cover_url,
        description: data.overview || f.description,
        media_type: type,
        tmdb_id: tmdbId,
      }));
      setShowCreate(true);
      toast("Dane pobrane ✓", "success");
    } catch {
      toast("Błąd połączenia z TMDB", "error");
    } finally {
      setTmdbLoading(false);
    }
  };

  const handleCreate = async () => {
    if (!createForm.title.trim()) { toast("Tytuł jest wymagany", "error"); return; }
    setCreateLoading(true);
    try {
      const res = await fetch("/api/media", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: createForm.title,
          original_title: createForm.original_title || null,
          author: createForm.author || null,
          media_type: createForm.media_type,
          universe_id: createForm.universe_id ? parseInt(createForm.universe_id) : null,
          cover_url: createForm.cover_url || null,
          description: createForm.description || null,
          tmdb_id: createForm.tmdb_id || null,
        }),
      });
      if (!res.ok) throw new Error(await res.text());
      const created: ApiMediaItem = await res.json();
      // Create a linked person record for the author/director
      if (createForm.author.trim()) {
        const role = BOOK_TYPES.includes(createForm.media_type) ? "author" : "director";
        await fetch(`/api/media/${created.id}/external`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            tmdb_id: null, ol_key: null, description: null, genres: [],
            vote_average: null, runtime: null, release_year: null,
            persons: [{ name: createForm.author.trim(), role, display_order: 0 }],
          }),
        });
      }
      if (addToWishlist) {
        await fetch("/api/wishlist", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: created.title,
            author: created.author,
            media_type: created.media_type,
            cover_url: created.cover_url,
            priority: "normal",
            tmdb_id: created.tmdb_id
          }),
        });
        toast("Dodano do listy życzeń!", "success");
      } else {
        toast("Utworzono medium!", "success");
      }
      onSelect(created.id, initialStartDate, initialEndDate);
    } catch (err) {
      toast("Błąd: " + (err as Error).message, "error");
    } finally {
      setCreateLoading(false);
    }
  };

  return (
    <>
      <div className="fixed inset-0 bg-black/50 z-50" onClick={onClose} />
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none">
        <div
          className="bg-white rounded-2xl shadow-2xl w-full max-w-md pointer-events-auto"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
            <div>
              <h2 className="font-semibold text-gray-900">
                {initialStartDate ? "Dodaj sesję" : "Przejdź do medium"}
              </h2>
              {initialStartDate && (
                <p className="text-xs text-gray-400 mt-0.5">
                  {initialStartDate}{initialEndDate && initialEndDate !== initialStartDate ? ` – ${initialEndDate}` : ""}
                </p>
              )}
            </div>
            <button
              onClick={onClose}
              className="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <div className="p-5 space-y-4">
            {!showCreate ? (
              <>
                <div ref={dropdownRef} className="relative">
                  <input
                    type="text"
                    value={mediaSearch}
                    onChange={(e) => handleSearchChange(e.target.value)}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-200 focus:outline-none"
                    placeholder="Szukaj po tytule..."
                    autoFocus
                  />
                  {filteredMedia.length > 0 && (
                    <div className="absolute top-full left-0 right-0 bg-white border border-gray-200 rounded-xl shadow-lg mt-1 max-h-64 overflow-y-auto z-50">
                      {filteredMedia.map((m) => (
                        <button
                          key={m.id}
                          type="button"
                          onClick={() => onSelect(m.id, initialStartDate, initialEndDate)}
                          className="w-full flex items-center gap-3 px-3 py-2 hover:bg-blue-50 text-left transition-colors"
                        >
                          {m.cover_url && (
                            <div className="relative w-8 h-12 shrink-0 rounded overflow-hidden">
                              <CoverImg src={m.cover_url} alt={m.title} fill className="object-cover" sizes="32px" />
                            </div>
                          )}
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-medium text-gray-900 truncate">{m.title}</p>
                            <span className={`text-xs px-1.5 py-0.5 rounded-full ${MEDIA_TYPE_COLORS[m.media_type] ?? "bg-gray-100 text-gray-600"}`}>
                              {MEDIA_TYPE_LABELS[m.media_type] ?? m.media_type}
                            </span>
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setCreateForm((f) => ({ ...f, title: mediaSearch.trim() }));
                    setShowCreate(true);
                  }}
                  className="text-xs text-blue-600 hover:text-blue-800"
                >
                  + Utwórz nowe medium
                </button>
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
                  <p className="text-[11px] text-gray-400 mb-1.5">Uzupełnij z TMDB</p>
                  <div className="flex gap-2">
                    <input
                      type="url"
                      value={tmdbUrl}
                      onChange={(e) => setTmdbUrl(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && handleTmdbFetch()}
                      placeholder="https://www.themoviedb.org/movie/... lub /tv/..."
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
            ) : (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-medium text-gray-700">Nowe medium</p>
                  {/* LC quick-fill also accessible from create form */}
                  {!lcUrl && (
                    <button
                      type="button"
                      onClick={() => setShowCreate(false)}
                      className="text-[11px] text-orange-500 hover:text-orange-700"
                    >
                      📚 Pobierz z lubimyczytac
                    </button>
                  )}
                </div>
                {/* Cover preview */}
                {createForm.cover_url && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={createForm.cover_url} alt="" className="h-20 w-auto rounded border border-gray-200 object-contain" />
                )}
                <input
                  type="text"
                  value={createForm.title}
                  onChange={(e) => setCreateForm((f) => ({ ...f, title: e.target.value }))}
                  placeholder="Tytuł *"
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-200 focus:outline-none"
                  autoFocus
                />
                <input
                  type="text"
                  value={createForm.original_title}
                  onChange={(e) => setCreateForm((f) => ({ ...f, original_title: e.target.value }))}
                  placeholder="Tytuł oryginalny"
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-200 focus:outline-none"
                />
                <input
                  type="text"
                  value={createForm.author}
                  onChange={(e) => setCreateForm((f) => ({ ...f, author: e.target.value }))}
                  placeholder="Autor"
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-200 focus:outline-none"
                />
                <select
                  value={createForm.media_type}
                  onChange={(e) => setCreateForm((f) => ({ ...f, media_type: e.target.value }))}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-200 focus:outline-none"
                >
                  {MEDIA_TYPES.map((t) => (
                    <option key={t} value={t}>{MEDIA_TYPE_LABELS[t] ?? t}</option>
                  ))}
                </select>
                <input
                  type="url"
                  value={createForm.cover_url}
                  onChange={(e) => setCreateForm((f) => ({ ...f, cover_url: e.target.value }))}
                  placeholder="URL okładki"
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-200 focus:outline-none"
                />
                <input
                  type="number"
                  value={createForm.universe_id}
                  onChange={(e) => setCreateForm((f) => ({ ...f, universe_id: e.target.value }))}
                  placeholder="ID Uniwersum (opcjonalnie)"
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-200 focus:outline-none"
                />
                <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer select-none pt-1">
                  <input
                    type="checkbox"
                    checked={addToWishlist}
                    onChange={(e) => setAddToWishlist(e.target.checked)}
                    className="w-4 h-4 accent-purple-600"
                  />
                  {BOOK_TYPES.includes(createForm.media_type) ? "📖 Chcę przeczytać" : "👁 Chcę obejrzeć"}
                </label>
                <div className="flex gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => setShowCreate(false)}
                    className="flex-1 border border-gray-200 text-gray-600 py-2 rounded-xl text-sm hover:bg-gray-100 transition-colors"
                  >
                    Anuluj
                  </button>
                  <button
                    type="button"
                    onClick={handleCreate}
                    disabled={createLoading}
                    className="flex-1 bg-gray-900 text-white py-2 rounded-xl text-sm hover:bg-gray-700 transition-colors disabled:opacity-50"
                  >
                    {createLoading ? "Tworzenie..." : "Utwórz medium"}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
