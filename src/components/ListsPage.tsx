"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import Image from "next/image";
import { MEDIA_TYPES, MEDIA_TYPE_LABELS } from "@/lib/utils";
import { toast } from "./Toast";

interface ReadingList {
  id: number;
  name: string;
  description: string | null;
  item_count: number;
  completed_count: number;
}

interface ListItem {
  id: number;
  list_id: number;
  title: string;
  author: string | null;
  media_type: string;
  cover_url: string | null;
  media_id: number | null;
  completed: number;
  season_number: number | null;
  season_start_date: string | null;
  auto_added: number | null;
  notes: string | null;
}

interface SearchResult {
  title: string;
  author: string | null;
  coverUrl: string | null;
  year: string | null;
  sourceId: string;
}

const MEDIA_TYPE_EMOJI: Record<string, string> = {
  book: "📖", comic: "📰", movie: "🎬", series: "📺", anime: "🎌", cartoon: "🎨",
};

function SearchAutocomplete({
  mediaType,
  onSelect,
  onManual,
}: {
  mediaType: string;
  onSelect: (r: SearchResult) => void;
  onManual: (title: string) => void;
}) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [show, setShow] = useState(false);
  const [searching, setSearching] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setShow(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const handleChange = (val: string) => {
    setQuery(val);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (val.trim().length < 2) { setShow(false); return; }
    debounceRef.current = setTimeout(async () => {
      setSearching(true);
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(val)}&type=${mediaType}`);
        setResults(await res.json());
        setShow(true);
      } catch { /* ignore */ } finally { setSearching(false); }
    }, 400);
  };

  return (
    <div ref={containerRef} className="relative">
      <input
        type="text"
        value={query}
        onChange={(e) => handleChange(e.target.value)}
        placeholder="Szukaj tytułu..."
        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-purple-500 focus:border-transparent"
      />
      {show && (
        <div className="absolute z-50 left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-64 overflow-y-auto">
          {searching && <div className="p-3 text-sm text-gray-500 text-center">Szukam...</div>}
          {!searching && results.map((r, i) => (
            <button
              key={i}
              type="button"
              onClick={() => { onSelect(r); setQuery(""); setShow(false); }}
              className="w-full flex items-center gap-3 p-2 hover:bg-purple-50 text-left"
            >
              {r.coverUrl ? (
                <div className="relative w-8 h-12 shrink-0 rounded overflow-hidden border border-gray-100">
                  <Image src={r.coverUrl} alt={r.title} fill className="object-cover" sizes="32px" />
                </div>
              ) : (
                <div className="w-8 h-12 shrink-0 bg-gray-100 rounded flex items-center justify-center text-lg">
                  {MEDIA_TYPE_EMOJI[mediaType] ?? "📄"}
                </div>
              )}
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium truncate">{r.title}</div>
                {r.author && <div className="text-xs text-gray-500 truncate">{r.author}</div>}
              </div>
            </button>
          ))}
          <button
            type="button"
            onClick={() => { onManual(query); setQuery(""); setShow(false); }}
            className="w-full p-2 text-sm text-purple-600 hover:bg-purple-50 text-left border-t border-gray-100"
          >
            ✏️ Wpisz własny tytuł: {query}
          </button>
        </div>
      )}
    </div>
  );
}

export default function ListsPage() {
  const [lists, setLists] = useState<ReadingList[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedList, setSelectedList] = useState<ReadingList | null>(null);
  const [listItems, setListItems] = useState<ListItem[]>([]);
  const [loadingItems, setLoadingItems] = useState(false);
  const [showNewList, setShowNewList] = useState(false);
  const [newListName, setNewListName] = useState("");
  const [newListDesc, setNewListDesc] = useState("");
  const [showAddItem, setShowAddItem] = useState(false);
  const [addItemType, setAddItemType] = useState("book");
  const [addItemAuthor, setAddItemAuthor] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [checkingUpcoming, setCheckingUpcoming] = useState(false);

  const fetchLists = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/lists");
      setLists(await res.json());
    } catch (err) { console.error(err); } finally { setLoading(false); }
  }, []);

  const fetchItems = useCallback(async (listId: number) => {
    setLoadingItems(true);
    try {
      const res = await fetch(`/api/lists/${listId}/items`);
      setListItems(await res.json());
    } catch (err) { console.error(err); } finally { setLoadingItems(false); }
  }, []);

  useEffect(() => { fetchLists(); }, [fetchLists]);

  const handleSelectList = (list: ReadingList) => {
    setSelectedList(list);
    fetchItems(list.id);
    setShowAddItem(false);
  };

  const handleCreateList = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newListName.trim()) return;
    setSubmitting(true);
    try {
      const res = await fetch("/api/lists", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newListName, description: newListDesc }),
      });
      if (!res.ok) throw new Error(await res.text());
      toast("Utworzono listę!", "success");
      setNewListName(""); setNewListDesc(""); setShowNewList(false);
      fetchLists();
    } catch (err) { toast("Błąd: " + (err as Error).message, "error"); } finally { setSubmitting(false); }
  };

  const handleDeleteList = async (id: number) => {
    if (!confirm("Usunąć listę?")) return;
    try {
      await fetch(`/api/lists/${id}`, { method: "DELETE" });
      toast("Usunięto!", "success");
      if (selectedList?.id === id) setSelectedList(null);
      fetchLists();
    } catch { toast("Błąd", "error"); }
  };

  const handleCheckUpcoming = async () => {
    setCheckingUpcoming(true);
    try {
      const res = await fetch("/api/jobs/check-upcoming-seasons", { method: "POST" });
      const data = await res.json();
      if (!res.ok) { toast(data.error ?? "Błąd", "error"); return; }
      if (data.added > 0) {
        toast(`Dodano ${data.added} nadchodzących sezon${data.added === 1 ? "" : "ów"}!`, "success");
        fetchLists();
        // If the "Nowe sezony" list is selected, refresh items
        if (selectedList?.id === data.list_id) fetchItems(data.list_id);
      } else {
        toast("Brak nowych sezonów do dodania", "info");
      }
    } catch { toast("Błąd sieci", "error"); } finally { setCheckingUpcoming(false); }
  };

  const handleAddItem = async (title: string, author: string, coverUrl: string | null) => {
    if (!selectedList) return;
    setSubmitting(true);
    try {
      const res = await fetch(`/api/lists/${selectedList.id}/items`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, author: author || null, media_type: addItemType, cover_url: coverUrl }),
      });
      if (!res.ok) throw new Error(await res.text());
      toast("Dodano!", "success");
      setShowAddItem(false); setAddItemAuthor("");
      fetchItems(selectedList.id); fetchLists();
    } catch (err) { toast("Błąd: " + (err as Error).message, "error"); } finally { setSubmitting(false); }
  };

  const handleDeleteItem = async (itemId: number) => {
    if (!selectedList) return;
    try {
      await fetch(`/api/lists/${selectedList.id}/items/${itemId}`, { method: "DELETE" });
      toast("Usunięto!", "success");
      fetchItems(selectedList.id); fetchLists();
    } catch { toast("Błąd", "error"); }
  };

  const handleStartItem = async (item: ListItem) => {
    if (!selectedList) return;
    try {
      const res = await fetch(`/api/lists/${selectedList.id}/items/${item.id}/start`, { method: "POST" });
      if (!res.ok) throw new Error(await res.text());
      toast("Przeniesiono do dziennika!", "success");
      fetchItems(selectedList.id); fetchLists();
    } catch (err) { toast("Błąd: " + (err as Error).message, "error"); }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-end gap-2">
        <button
          onClick={handleCheckUpcoming}
          disabled={checkingUpcoming}
          className="bg-orange-500 hover:bg-orange-600 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2 shadow-sm disabled:opacity-50"
        >
          {checkingUpcoming ? "⏳ Sprawdzam…" : "📡 Sprawdź nowe sezony"}
        </button>
        <button
          onClick={() => setShowNewList((v) => !v)}
          className="bg-white text-purple-700 hover:bg-purple-50 px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2 shadow-sm"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Nowa lista
        </button>
      </div>

      {showNewList && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
          <h3 className="font-semibold text-gray-800 mb-3">Nowa lista</h3>
          <form onSubmit={handleCreateList} className="flex flex-col gap-3">
            <input
              type="text"
              required
              value={newListName}
              onChange={(e) => setNewListName(e.target.value)}
              placeholder="Nazwa listy *"
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-purple-500 focus:border-transparent"
            />
            <input
              type="text"
              value={newListDesc}
              onChange={(e) => setNewListDesc(e.target.value)}
              placeholder="Opis (opcjonalnie)"
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-purple-500 focus:border-transparent"
            />
            <div className="flex gap-2">
              <button type="submit" disabled={submitting} className="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-lg text-sm font-medium disabled:opacity-50">
                {submitting ? "Tworzenie..." : "Utwórz"}
              </button>
              <button type="button" onClick={() => setShowNewList(false)} className="bg-gray-200 hover:bg-gray-300 text-gray-700 px-4 py-2 rounded-lg text-sm font-medium">
                Anuluj
              </button>
            </div>
          </form>
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-16">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white"></div>
        </div>
      ) : lists.length === 0 ? (
        <div className="bg-white/10 backdrop-blur rounded-xl p-12 text-center">
          <p className="text-white/80 text-lg">Brak list — utwórz pierwszą! 📚</p>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {lists.map((list) => {
            const progress = list.item_count > 0 ? (list.completed_count / list.item_count) * 100 : 0;
            const isSelected = selectedList?.id === list.id;
            return (
              <div
                key={list.id}
                className={`bg-white rounded-xl shadow-sm border-2 transition-colors cursor-pointer ${isSelected ? "border-purple-500" : "border-gray-200 hover:border-purple-300"}`}
                onClick={() => handleSelectList(list)}
              >
                <div className="p-4">
                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className="font-semibold text-gray-900">{list.name}</h3>
                      {list.description && <p className="text-xs text-gray-500 mt-0.5">{list.description}</p>}
                    </div>
                    <button
                      onClick={(e) => { e.stopPropagation(); handleDeleteList(list.id); }}
                      className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>
                  <div className="mt-3">
                    <div className="flex justify-between text-xs text-gray-500 mb-1">
                      <span>{list.completed_count} / {list.item_count} ukończone</span>
                      <span>{Math.round(progress)}%</span>
                    </div>
                    <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-purple-500 transition-all"
                        style={{ width: `${progress}%` }}
                      />
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {selectedList && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-gray-800 text-lg">{selectedList.name}</h3>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowAddItem((v) => !v)}
                className="bg-purple-600 hover:bg-purple-700 text-white px-3 py-1.5 rounded-lg text-sm font-medium flex items-center gap-1"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                Dodaj pozycję
              </button>
              <button onClick={() => setSelectedList(null)} className="text-gray-400 hover:text-gray-600 p-1">✕</button>
            </div>
          </div>

          {showAddItem && (
            <div className="mb-4 p-3 bg-gray-50 rounded-lg border border-gray-200">
              <div className="flex gap-2 mb-2">
                <select
                  value={addItemType}
                  onChange={(e) => setAddItemType(e.target.value)}
                  className="border border-gray-300 rounded-lg px-2 py-1.5 text-sm focus:ring-2 focus:ring-purple-500"
                >
                  {MEDIA_TYPES.map((t) => (
                    <option key={t} value={t}>{MEDIA_TYPE_LABELS[t]}</option>
                  ))}
                </select>
                <input
                  type="text"
                  value={addItemAuthor}
                  onChange={(e) => setAddItemAuthor(e.target.value)}
                  placeholder="Autor (opcjonalnie)"
                  className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:ring-2 focus:ring-purple-500 flex-1"
                />
              </div>
              <SearchAutocomplete
                mediaType={addItemType}
                onSelect={(r) => handleAddItem(r.title, r.author ?? addItemAuthor, r.coverUrl)}
                onManual={(title) => handleAddItem(title, addItemAuthor, null)}
              />
            </div>
          )}

          {loadingItems ? (
            <div className="flex justify-center py-8">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-purple-600"></div>
            </div>
          ) : listItems.length === 0 ? (
            <p className="text-center text-gray-400 text-sm py-8">Lista jest pusta</p>
          ) : (
            <div className="divide-y divide-gray-100">
              {listItems.map((item) => (
                <div key={item.id} className="flex items-center gap-3 py-3">
                  {item.cover_url ? (
                    <div className="relative w-10 h-14 shrink-0 rounded overflow-hidden border border-gray-200">
                      <Image src={item.cover_url} alt={item.title} fill className="object-cover" sizes="40px" />
                    </div>
                  ) : (
                    <div className="w-10 h-14 shrink-0 bg-gray-100 rounded flex items-center justify-center text-2xl">
                      {MEDIA_TYPE_EMOJI[item.media_type] ?? "📄"}
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <div className={`font-medium text-sm ${item.completed ? "line-through text-gray-400" : "text-gray-900"}`}>
                      {item.title}
                    </div>
                    {item.author && <div className="text-xs text-gray-500">{item.author}</div>}
                    <div className="flex items-center gap-2 flex-wrap mt-0.5">
                      <span className="text-xs text-gray-400">{MEDIA_TYPE_LABELS[item.media_type] ?? item.media_type}</span>
                      {item.season_number != null && (
                        <span className="text-xs bg-orange-100 text-orange-700 px-1.5 py-0.5 rounded-full font-medium">
                          Sezon {item.season_number}
                        </span>
                      )}
                      {item.season_start_date && (
                        <span className="text-xs text-blue-600 font-medium">
                          📅 {item.season_start_date}
                        </span>
                      )}
                      {item.auto_added ? (
                        <span className="text-xs text-gray-400 italic">auto</span>
                      ) : null}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {item.completed ? (
                      <span className="text-green-600 text-lg">✅</span>
                    ) : (
                      <button
                        onClick={() => handleStartItem(item)}
                        className="bg-green-600 hover:bg-green-700 text-white px-2 py-1 rounded text-xs font-medium flex items-center gap-1"
                      >
                        ▶ Zaczynam!
                      </button>
                    )}
                    <button
                      onClick={() => handleDeleteItem(item.id)}
                      className="p-1 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
