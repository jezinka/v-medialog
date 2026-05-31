"use client";
import { useCallback, useEffect, useState } from "react";
import { MEDIA_TYPES, MEDIA_TYPE_LABELS, MEDIA_TYPE_EMOJI } from "@/lib/utils";
import { toast } from "./Toast";
import WatchlistCalendar from "./WatchlistCalendar";
import { useMediaSearch } from "@/lib/hooks/useMediaSearch";
import MediaCoverThumb from "./MediaCoverThumb";

interface WishlistItem {
  id: number;
  title: string;
  author: string | null;
  media_type: string;
  notes: string | null;
  added_at: string;
  cover_url: string | null;
}

interface WishlistFormData {
  title: string;
  author: string;
  media_type: string;
  notes: string;
}

const emptyEditForm: WishlistFormData = {
  title: "",
  author: "",
  media_type: "book",
  notes: "",
};

export default function WishlistPage() {
  const [activeTab, setActiveTab] = useState<"watchlist" | "wishlist">("watchlist");
  const [items, setItems] = useState<WishlistItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [editingItem, setEditingItem] = useState<WishlistItem | null>(null);
  const [editForm, setEditForm] = useState<WishlistFormData>(emptyEditForm);

  // VOD offers map: itemId → offer list
  type VodOffer = { id: number; provider_name: string; provider_logo: string | null; url: string | null };
  const [vodMap, setVodMap] = useState<Record<number, VodOffer[]>>({});
  const [checkingAllVod, setCheckingAllVod] = useState(false);

  // Media search for adding to wishlist
  const { mediaSearch, filteredMedia, handleSearchChange, dropdownRef, clearResults } = useMediaSearch();

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/wishlist");
      const data = await res.json() as WishlistItem[];
      setItems(data);
      // Fetch VOD offers for screen media items
      const screenItems = data.filter((i) => ["movie", "series", "anime", "cartoon"].includes(i.media_type));
      if (screenItems.length > 0) {
        const offerResults = await Promise.allSettled(
          screenItems.map((i) => fetch(`/api/vod/offers?itemType=wishlist&itemId=${i.id}`).then((r) => r.json()))
        );
        const map: Record<number, VodOffer[]> = {};
        screenItems.forEach((item, idx) => {
          const r = offerResults[idx];
          if (r.status === "fulfilled") {
            map[item.id] = (r.value as { offers: VodOffer[] }).offers ?? [];
          }
        });
        setVodMap(map);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  const checkAllVod = async () => {
    setCheckingAllVod(true);
    try {
      await fetch("/api/vod/refresh-all", { method: "POST" });
      toast("Sprawdzono dostępność VOD ✓", "success");
      await fetchData();
    } catch {
      toast("Błąd sprawdzania VOD", "error");
    } finally {
      setCheckingAllVod(false);
    }
  };

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleAddFromMedia = async (media: { id: number; title: string; author: string | null; media_type: string; cover_url: string | null }) => {
    clearResults();
    try {
      const res = await fetch("/api/wishlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: media.title,
          author: media.author,
          media_type: media.media_type,
          cover_url: media.cover_url,
          priority: "normal",
        }),
      });
      if (!res.ok) throw new Error(await res.text());
      toast("Dodano do listy!", "success");
      fetchData();
    } catch (err) {
      toast("Błąd: " + (err as Error).message, "error");
    }
  };

  const handleEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingItem) return;
    setSubmitting(true);
    try {
      const res = await fetch(`/api/wishlist/${editingItem.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editForm),
      });
      if (!res.ok) throw new Error(await res.text());
      toast("Zaktualizowano!", "success");
      setEditingItem(null);
      fetchData();
    } catch (err) {
      toast("Błąd: " + (err as Error).message, "error");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm("Usunąć z listy?")) return;
    try {
      const res = await fetch(`/api/wishlist/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error(await res.text());
      toast("Usunięto!", "info");
      fetchData();
    } catch (err) {
      toast("Błąd: " + (err as Error).message, "error");
    }
  };

  const handleStart = async (item: WishlistItem) => {
    try {
      const res = await fetch(`/api/wishlist/${item.id}/start`, { method: "POST" });
      if (!res.ok) throw new Error(await res.text());
      toast("Przeniesiono do dziennika ✓", "success");
      fetchData();
    } catch (err) {
      toast("Błąd: " + (err as Error).message, "error");
    }
  };

  const openEdit = (item: WishlistItem) => {
    setEditingItem(item);
    setEditForm({
      title: item.title,
      author: item.author ?? "",
      media_type: item.media_type,
      notes: item.notes ?? "",
    });
  };

  const setEditField = (field: keyof WishlistFormData, value: string) =>
    setEditForm((f) => ({ ...f, [field]: value }));

  return (
    <div className="space-y-6">
      {/* Tab buttons */}
      <div className="flex gap-2 border-b border-gray-200 pb-0">
        <button
          onClick={() => setActiveTab("watchlist")}
          className={`px-4 py-2 text-sm font-medium rounded-t-lg transition-colors ${
            activeTab === "watchlist"
              ? "bg-white border border-b-white border-gray-200 -mb-px text-blue-600"
              : "text-gray-500 hover:text-gray-700"
          }`}
        >
          📺 Do obejrzenia
        </button>
        <button
          onClick={() => setActiveTab("wishlist")}
          className={`px-4 py-2 text-sm font-medium rounded-t-lg transition-colors ${
            activeTab === "wishlist"
              ? "bg-white border border-b-white border-gray-200 -mb-px text-purple-600"
              : "text-gray-500 hover:text-gray-700"
          }`}
        >
          📋 Lista życzeń
        </button>
      </div>

      {/* Watchlist calendar tab */}
      {activeTab === "watchlist" && <WatchlistCalendar />}

      {/* Wishlist tab */}
      {activeTab === "wishlist" && (
        <div className="space-y-6">
          {/* Search existing media to add */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
            <p className="text-sm font-medium text-gray-700 mb-2">Dodaj z biblioteki</p>
            <div ref={dropdownRef} className="relative">
              <input
                type="text"
                value={mediaSearch}
                onChange={(e) => handleSearchChange(e.target.value)}
                placeholder="Szukaj po tytule..."
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              />
              {filteredMedia.length > 0 && (
                <div className="absolute top-full left-0 right-0 bg-white border border-gray-200 rounded-xl shadow-lg mt-1 max-h-64 overflow-y-auto z-50">
                  {filteredMedia.map((m) => (
                    <button
                      key={m.id}
                      type="button"
                      onMouseDown={() => handleAddFromMedia(m)}
                      className="w-full flex items-center gap-3 px-3 py-2 hover:bg-gray-50 text-left"
                    >
                      <MediaCoverThumb
                        coverUrl={m.cover_url}
                        title={m.title}
                        mediaType={m.media_type}
                        className="w-8 h-10"
                        sizes="32px"
                      />
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-gray-900 truncate">{m.title}</p>
                        {m.author && <p className="text-xs text-gray-500 truncate">{m.author}</p>}
                      </div>
                      <span className="ml-auto text-xs text-gray-400 shrink-0">{MEDIA_TYPE_LABELS[m.media_type] ?? m.media_type}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

      {/* Edit modal */}
      {editingItem && (
        <div className="fixed inset-0 bg-black/50 z-40 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl border border-gray-200 p-6 w-full max-w-lg">
            <h2 className="text-lg font-semibold text-gray-800 mb-4">Edytuj pozycję</h2>
            <form onSubmit={handleEdit} className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Tytuł *</label>
                <input
                  type="text"
                  required
                  value={editForm.title}
                  onChange={(e) => setEditField("title", e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Typ *</label>
                <select
                  required
                  value={editForm.media_type}
                  onChange={(e) => setEditField("media_type", e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                >
                  {MEDIA_TYPES.map((t) => (
                    <option key={t} value={t}>{MEDIA_TYPE_EMOJI[t]} {MEDIA_TYPE_LABELS[t]}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Autor</label>
                <input
                  type="text"
                  value={editForm.author}
                  onChange={(e) => setEditField("author", e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                />
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">Notatki</label>
                <textarea
                  value={editForm.notes}
                  onChange={(e) => setEditField("notes", e.target.value)}
                  rows={2}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                />
              </div>
              <div className="md:col-span-2 flex gap-2">
                <button
                  type="submit"
                  disabled={submitting}
                  className="bg-purple-600 hover:bg-purple-700 text-white px-6 py-2 rounded-lg text-sm font-medium disabled:opacity-50 transition-colors"
                >
                  {submitting ? "Zapisywanie..." : "Zaktualizuj"}
                </button>
                <button
                  type="button"
                  onClick={() => setEditingItem(null)}
                  className="bg-gray-200 hover:bg-gray-300 text-gray-700 px-6 py-2 rounded-lg text-sm font-medium transition-colors"
                >
                  Anuluj
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* List */}
      {loading ? (
        <div className="flex items-center justify-center py-16">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white"></div>
        </div>
      ) : items.length === 0 ? (
        <div className="bg-white/10 backdrop-blur rounded-xl p-12 text-center">
          <p className="text-white/80 text-lg">Lista pusta — czas coś dodać! 📋</p>
        </div>
      ) : (
        <>
          {/* VOD batch check button */}
          <div className="flex justify-end">
            <button
              onClick={checkAllVod}
              disabled={checkingAllVod}
              className="text-xs text-white/80 hover:text-white flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-white/30 hover:bg-white/10 transition-colors disabled:opacity-50"
            >
              {checkingAllVod ? "⏳ Sprawdzam…" : "🔄 Sprawdź dostępność VOD"}
            </button>
          </div>
        <div className="grid gap-3">
          {items.map((item) => (
            <div
              key={item.id}
              className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 flex items-start gap-3"
            >
              <MediaCoverThumb
                coverUrl={item.cover_url}
                title={item.title}
                mediaType={item.media_type}
                sizes="40px"
              />
              <div className="flex-1 min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-semibold text-gray-900">{item.title}</span>
                  {item.author && (
                    <span className="text-sm text-gray-500">— {item.author}</span>
                  )}
                </div>
                {item.notes && (
                  <p className="text-sm text-gray-500 mt-1">{item.notes}</p>
                )}
                {/* VOD platform badges */}
                {vodMap[item.id] && vodMap[item.id].length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-2">
                    {vodMap[item.id].map((o) => (
                      <a
                        key={o.id}
                        href={o.url ?? "#"}
                        target="_blank"
                        rel="noopener noreferrer"
                        title={o.provider_name}
                        className="flex items-center gap-1 px-2 py-0.5 bg-green-50 border border-green-200 rounded-full text-[10px] text-green-700 hover:bg-green-100 transition-colors"
                      >
                        {o.provider_logo && (
                          <img src={o.provider_logo} alt="" className="w-3.5 h-3.5 object-contain" />
                        )}
                        {o.provider_name}
                      </a>
                    ))}
                  </div>
                )}
              </div>
              <div className="flex items-center gap-1 flex-shrink-0">
                <button
                  onClick={() => handleStart(item)}
                  className="flex items-center gap-1 bg-green-600 hover:bg-green-700 text-white px-3 py-1.5 rounded-lg text-xs font-medium transition-colors"
                  title="Zaczynam teraz!"
                >
                  ▶ Zaczynam!
                </button>
                <button
                  onClick={() => openEdit(item)}
                  className="p-1.5 text-gray-400 hover:text-purple-600 hover:bg-purple-50 rounded-lg transition-colors"
                  title="Edytuj"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                  </svg>
                </button>
                <button
                  onClick={() => handleDelete(item.id)}
                  className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                  title="Usuń"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </button>
              </div>
            </div>
          ))}
        </div>
        </>
      )}
        </div>
      )}
    </div>
  );
}
