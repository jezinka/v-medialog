"use client";
import { useState, useRef, useEffect } from "react";
import Image from "next/image";
import { MEDIA_TYPES, MEDIA_TYPE_LABELS, BOOK_TYPES } from "@/lib/utils";
import { toast } from "./Toast";

interface SearchResult {
  title: string;
  original_title?: string | null;
  author: string | null;
  coverUrl: string | null;
  year: string | null;
  sourceId: string;
  pages?: number | null;
  subjects?: string[] | null;
  overview?: string | null;
}

interface MediaFormData {
  title: string;
  original_title: string;
  author: string;
  media_type: string;
  start_date: string;
  end_date: string;
  volume_episode: string;
  tags: string;
  description: string;
  discontinued: boolean;
  cinema: boolean;
  cover_url: string;
  additional_sessions: string; // JSON: [{start_date, end_date}]
  tmdb_id: string;
  ol_key: string;
  source_url: string;
}

interface PlaceholderItem {
  id: number;
  title: string;
  author: string | null;
  mediaType: string;
  startDate: string;
  endDate: string | null;
  coverUrl?: string | null;
  originalTitle?: string | null;
  tags?: string | null;
  discontinued: boolean;
}

interface Props {
  initialData?: Partial<MediaFormData> & { id?: number };
  onSuccess: () => void;
  onCancel?: () => void;
  mode?: "add" | "edit";
  placeholderItems?: PlaceholderItem[];
}

const emptyForm: MediaFormData = {
  title: "",
  original_title: "",
  author: "",
  media_type: "book",
  start_date: "",
  end_date: "",
  volume_episode: "",
  tags: "",
  description: "",
  discontinued: false,
  cinema: false,
  cover_url: "",
  additional_sessions: "",
  tmdb_id: "",
  ol_key: "",
  source_url: "",
};

export default function MediaForm({ initialData, onSuccess, onCancel, mode = "add", placeholderItems }: Props) {
  const [form, setForm] = useState<MediaFormData>({ ...emptyForm, ...initialData });
  const [loading, setLoading] = useState(false);
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [searching, setSearching] = useState(false);
  const [selectedResult, setSelectedResult] = useState<SearchResult | null>(null);
  // When a placeholder item is selected, we switch to PUT mode for that item's id
  const [selectedPlaceholderId, setSelectedPlaceholderId] = useState<number | null>(null);
  // Additional watch sessions (breaks)
  const [extraSessions, setExtraSessions] = useState<Array<{ start_date: string; end_date: string }>>(() => {
    try {
      return initialData?.additional_sessions ? JSON.parse(initialData.additional_sessions as string) : [];
    } catch { return []; }
  });
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const handleOriginalTitleChange = (value: string) => {
    setForm((f) => ({ ...f, original_title: value }));
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (value.trim().length < 2) {
      setShowDropdown(false);
      return;
    }
    debounceRef.current = setTimeout(async () => {
      setSearching(true);
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(value)}&type=${form.media_type}`);
        const data = await res.json();
        setSearchResults(data);
        setShowDropdown(true);
      } catch {
        // ignore search errors
      } finally {
        setSearching(false);
      }
    }, 400);
  };

  const handleSelectResult = (result: SearchResult) => {
    setForm((f) => ({
      ...f,
      title: f.title.trim() ? f.title : result.title,
      original_title: result.original_title ?? result.title,
      author: result.author ?? f.author,
      cover_url: result.coverUrl ?? f.cover_url,
    }));
    setSelectedResult(result);
    setShowDropdown(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      // If a placeholder item was selected, update it (PUT) instead of creating new
      const isPlaceholderUpdate = mode === "add" && selectedPlaceholderId !== null;
      const url =
        isPlaceholderUpdate ? `/api/media/${selectedPlaceholderId}` :
        mode === "edit" && initialData?.id ? `/api/media/${initialData.id}` :
        "/api/media";
      const method = (mode === "edit" || isPlaceholderUpdate) ? "PUT" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          tmdb_id: form.tmdb_id ? parseInt(form.tmdb_id) : null,
          ol_key: form.ol_key || null,
          source_url: form.source_url || null,
          additional_sessions: extraSessions.length > 0 ? JSON.stringify(extraSessions) : null,
        }),
      });
      if (!res.ok) throw new Error(await res.text());
      toast(mode === "edit" || isPlaceholderUpdate ? "Zaktualizowano!" : "Dodano!", "success");
      onSuccess();
      if (mode === "add" && !isPlaceholderUpdate) setForm(emptyForm);
    } catch (err) {
      toast("Błąd: " + (err as Error).message, "error");
    } finally {
      setLoading(false);
    }
  };

  const set = (field: keyof MediaFormData, value: string | boolean) =>
    setForm((f) => ({ ...f, [field]: value }));

  return (
    <div
      className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
      onClick={onCancel}
    >
      <div
        className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-100">
          <h2 className="text-lg font-semibold text-gray-900">
            {mode === "edit" ? "Edytuj wpis" : "Dodaj wpis"}
          </h2>
          {onCancel && (
            <button
              type="button"
              onClick={onCancel}
              className="p-1.5 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100 transition-colors"
            >
              <Image src="/icons/icons8-cancel-96.png" alt="zamknij" width={20} height={20} />
            </button>
          )}
        </div>

        {/* Form content */}
        <div className="p-4">
          <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Title */}
            <div className="relative">
              <label className="block text-sm font-medium text-gray-700 mb-1">Tytuł *</label>
              <div className="flex gap-2">
                {form.cover_url && (
                  <div className="flex flex-col gap-1">
                    <div className="relative w-10 h-14 shrink-0 rounded overflow-hidden border border-gray-200">
                      <Image src={form.cover_url} alt="okładka" fill className="object-cover" sizes="40px" />
                    </div>
                    {selectedResult && (selectedResult.year || selectedResult.pages) && (
                      <div className="text-xs text-gray-500 w-10 text-center leading-tight">
                        {selectedResult.year && <span>📅 {selectedResult.year}</span>}
                        {selectedResult.pages && <span className="block">{selectedResult.pages} s.</span>}
                      </div>
                    )}
                  </div>
                )}
                <input
                  type="text"
                  required
                  value={form.title}
                  onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-gray-400 focus:border-transparent"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Autor</label>
              <input
                type="text"
                value={form.author}
                onChange={(e) => set("author", e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-gray-400 focus:border-transparent"
              />
            </div>

            {/* Original title with search autocomplete */}
            <div ref={dropdownRef} className="relative">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Tytuł oryginalny <span className="text-gray-400 font-normal text-xs">(wyszukiwanie API)</span>
              </label>
              <input
                type="text"
                value={form.original_title}
                onChange={(e) => handleOriginalTitleChange(e.target.value)}
                onFocus={() => { if (searchResults.length > 0) setShowDropdown(true); }}
                placeholder="wpisz aby wyszukać okładkę i dane…"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-gray-400 focus:border-transparent"
              />
              {showDropdown && (
                <div className="absolute z-50 left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-72 overflow-y-auto">
                  {searching && (
                    <div className="p-3 text-sm text-gray-500 text-center">Szukam...</div>
                  )}
                  {!searching && searchResults.map((r, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => handleSelectResult(r)}
                      className="w-full flex items-center gap-3 p-2 hover:bg-gray-50 text-left transition-colors"
                    >
                      {r.coverUrl ? (
                        <div className="relative w-8 h-12 shrink-0 rounded overflow-hidden border border-gray-100">
                          <Image src={r.coverUrl} alt={r.title} fill className="object-cover" sizes="32px" />
                        </div>
                      ) : (
                        <div className="w-8 h-12 shrink-0 bg-gray-100 rounded flex items-center justify-center text-lg">📄</div>
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium text-gray-900 truncate">{r.title}</div>
                        {r.original_title && r.original_title !== r.title && (
                          <div className="text-xs text-gray-400 italic truncate">{r.original_title}</div>
                        )}
                        {r.author && <div className="text-xs text-gray-500 truncate">{r.author}</div>}
                        {r.year && <div className="text-xs text-gray-400">{r.year}</div>}
                      </div>
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={() => setShowDropdown(false)}
                    className="w-full p-2 text-sm text-gray-600 hover:bg-gray-50 text-left border-t border-gray-100 transition-colors"
                  >
                    ✏️ Zamknij
                  </button>
                </div>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Typ *</label>
              <select
                required
                value={form.media_type}
                onChange={(e) => set("media_type", e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-gray-400 focus:border-transparent"
              >
                {MEDIA_TYPES.map((t) => (
                  <option key={t} value={t}>{MEDIA_TYPE_LABELS[t]}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Tom / Odcinek</label>
              <input
                type="text"
                value={form.volume_episode}
                onChange={(e) => set("volume_episode", e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-gray-400 focus:border-transparent"
              />
            </div>

            {/* Placeholder picker — shown only when opening from calendar and there are year-placeholder items */}
            {mode === "add" && placeholderItems && placeholderItems.length > 0 && (
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-amber-700 mb-1">
                  ⚡ Uzupełnij z wpisu rocznego ({placeholderItems.length} dostępnych)
                </label>
                <select
                  value={selectedPlaceholderId ?? ""}
                  onChange={(e) => {
                    const id = e.target.value ? Number(e.target.value) : null;
                    setSelectedPlaceholderId(id);
                    if (id !== null) {
                      const item = placeholderItems.find((p) => p.id === id);
                      if (item) {
                        setForm((f) => ({
                          ...f,
                          title: item.title,
                          original_title: item.originalTitle ?? item.title,
                          author: item.author ?? "",
                          media_type: item.mediaType,
                          cover_url: item.coverUrl ?? "",
                          tags: item.tags ?? "",
                        }));
                      }
                    } else {
                      // Reset to just the calendar dates when deselected
                      setForm((f) => ({
                        ...emptyForm,
                        start_date: f.start_date,
                        end_date: f.end_date,
                        media_type: f.media_type,
                      }));
                    }
                  }}
                  className="w-full border border-amber-300 bg-amber-50 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-amber-400 focus:border-transparent"
                >
                  <option value="">— nowy wpis —</option>
                  {placeholderItems.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.title}{p.author ? ` – ${p.author}` : ""} ({p.startDate.slice(0, 4)})
                    </option>
                  ))}
                </select>
                {selectedPlaceholderId && (
                  <p className="mt-1 text-xs text-amber-600">
                    Zapisanie zaktualizuje istniejący wpis z nowymi datami.
                  </p>
                )}
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Data początkowa *</label>
              <input
                type="date"
                required
                value={form.start_date}
                onChange={(e) => set("start_date", e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-gray-400 focus:border-transparent"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Data końcowa</label>
              <input
                type="date"
                value={form.end_date}
                onChange={(e) => set("end_date", e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-gray-400 focus:border-transparent"
              />
            </div>

            {/* Additional watch sessions (breaks) */}
            <div className="md:col-span-2">
              <div className="flex items-center justify-between mb-2">
                <label className="text-sm font-medium text-gray-700">Przerwy / kolejne sesje oglądania</label>
                <button
                  type="button"
                  onClick={() => setExtraSessions((s) => [...s, { start_date: "", end_date: "" }])}
                  className="text-xs text-gray-500 hover:text-gray-800 border border-gray-300 rounded-lg px-2 py-1 hover:bg-gray-50 transition-colors flex items-center gap-1"
                >
                  <Image src="/icons/icons8-plus-100.png" alt="dodaj" width={12} height={12} />
                  Dodaj sesję
                </button>
              </div>
              {extraSessions.length > 0 && (
                <div className="space-y-2">
                  {extraSessions.map((session, idx) => (
                    <div key={idx} className="flex items-center gap-2 bg-gray-50 rounded-lg p-2 border border-gray-200">
                      <span className="text-xs text-gray-400 shrink-0">#{idx + 2}</span>
                      <input
                        type="date"
                        value={session.start_date}
                        onChange={(e) => setExtraSessions((s) => s.map((x, i) => i === idx ? { ...x, start_date: e.target.value } : x))}
                        className="flex-1 border border-gray-300 rounded-lg px-2 py-1.5 text-sm focus:ring-2 focus:ring-gray-400 focus:border-transparent"
                      />
                      <span className="text-xs text-gray-400">–</span>
                      <input
                        type="date"
                        value={session.end_date}
                        onChange={(e) => setExtraSessions((s) => s.map((x, i) => i === idx ? { ...x, end_date: e.target.value } : x))}
                        className="flex-1 border border-gray-300 rounded-lg px-2 py-1.5 text-sm focus:ring-2 focus:ring-gray-400 focus:border-transparent"
                      />
                      <button
                        type="button"
                        onClick={() => setExtraSessions((s) => s.filter((_, i) => i !== idx))}
                        className="p-1 text-gray-400 hover:text-red-500 rounded"
                        title="Usuń sesję"
                      >
                        <Image src="/icons/icons8-cancel-96.png" alt="usuń" width={16} height={16} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Tagi (oddzielone przecinkami)</label>
              <input
                type="text"
                value={form.tags}
                onChange={(e) => set("tags", e.target.value)}
                placeholder="np. fantasy, klasyka"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-gray-400 focus:border-transparent"
              />
            </div>

            <div className="flex items-center gap-2 mt-6">
              <input
                type="checkbox"
                id="discontinued"
                checked={form.discontinued}
                onChange={(e) => set("discontinued", e.target.checked)}
                className="rounded text-gray-600 focus:ring-gray-400"
              />
              <label htmlFor="discontinued" className="text-sm font-medium text-gray-700">Porzucone</label>
            </div>

            {form.media_type === "movie" && (
              <div className="flex items-center gap-2 mt-2">
                <input
                  type="checkbox"
                  id="cinema"
                  checked={form.cinema}
                  onChange={(e) => set("cinema", e.target.checked)}
                  className="rounded text-gray-600 focus:ring-gray-400"
                />
                <label htmlFor="cinema" className="text-sm font-medium text-gray-700">🎟️ Oglądane w kinie</label>
              </div>
            )}

            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Opis</label>
              <textarea
                value={form.description}
                onChange={(e) => set("description", e.target.value)}
                rows={3}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-gray-400 focus:border-transparent"
              />
            </div>

            {/* External IDs */}
            {["series", "anime", "movie", "cartoon"].includes(form.media_type) && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  TMDB ID <span className="text-gray-400 font-normal text-xs">(opcjonalnie)</span>
                </label>
                <input
                  type="number"
                  value={form.tmdb_id}
                  onChange={(e) => set("tmdb_id", e.target.value)}
                  placeholder="np. 1399"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-gray-400 focus:border-transparent"
                />
              </div>
            )}
            {BOOK_TYPES.includes(form.media_type) && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Open Library Key <span className="text-gray-400 font-normal text-xs">(opcjonalnie)</span>
                </label>
                <input
                  type="text"
                  value={form.ol_key}
                  onChange={(e) => set("ol_key", e.target.value)}
                  placeholder="np. /works/OL45804W"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-gray-400 focus:border-transparent"
                />
              </div>
            )}

            <div className="md:col-span-2 flex gap-2">
              <button
                type="submit"
                disabled={loading}
                className="bg-gray-900 hover:bg-gray-700 text-white px-6 py-2 rounded-lg text-sm font-medium disabled:opacity-50 transition-colors flex items-center gap-2"
              >
                <Image src="/icons/icons8-checkmark-96.png" alt="" width={16} height={16} className="brightness-0 invert" />
                {loading ? "Zapisywanie..." : mode === "edit" ? "Zaktualizuj" : "Dodaj"}
              </button>
              {onCancel && (
                <button
                  type="button"
                  onClick={onCancel}
                  className="bg-gray-100 hover:bg-gray-200 text-gray-700 px-6 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2"
                >
                  <Image src="/icons/icons8-cancel-96.png" alt="" width={16} height={16} />
                  Anuluj
                </button>
              )}
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
