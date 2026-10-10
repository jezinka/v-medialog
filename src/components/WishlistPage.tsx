"use client";

import { useCallback, useEffect, useState } from "react";
import { MEDIA_TYPES, MEDIA_TYPE_EMOJI, MEDIA_TYPE_LABELS } from "@/lib/utils";
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

interface VodOffer {
  id: number;
  provider_name: string;
  provider_logo: string | null;
  url: string | null;
}

const emptyEditForm: WishlistFormData = {
  title: "",
  author: "",
  media_type: "book",
  notes: "",
};

export default function WishlistPage() {
  const [items, setItems] = useState<WishlistItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [editingItem, setEditingItem] = useState<WishlistItem | null>(null);
  const [editForm, setEditForm] = useState<WishlistFormData>(emptyEditForm);
  const [vodMap, setVodMap] = useState<Record<number, VodOffer[]>>({});
  const [checkingAllVod, setCheckingAllVod] = useState(false);
  const { mediaSearch, filteredMedia, handleSearchChange, dropdownRef, clearResults } = useMediaSearch();

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/wishlist");
      const data = await res.json() as WishlistItem[];
      setItems(data);
      const screenItems = data.filter((item) => ["movie", "series", "anime", "cartoon"].includes(item.media_type));
      if (screenItems.length > 0) {
        const results = await Promise.allSettled(
          screenItems.map((item) => fetch(`/api/vod/offers?itemType=wishlist&itemId=${item.id}`).then((response) => response.json()))
        );
        const map: Record<number, VodOffer[]> = {};
        screenItems.forEach((item, index) => {
          const result = results[index];
          if (result.status === "fulfilled") map[item.id] = (result.value as { offers: VodOffer[] }).offers ?? [];
        });
        setVodMap(map);
      }
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void fetchData(); }, [fetchData]);

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

  const handleAddFromMedia = async (media: { id: number; title: string; author: string | null; media_type: string; cover_url: string | null }) => {
    clearResults();
    try {
      const res = await fetch("/api/wishlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...media, priority: "normal" }),
      });
      if (!res.ok) throw new Error(await res.text());
      toast("Dodano do listy!", "success");
      void fetchData();
    } catch (error) {
      toast("Błąd: " + (error as Error).message, "error");
    }
  };

  const handleEdit = async (event: React.FormEvent) => {
    event.preventDefault();
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
      void fetchData();
    } catch (error) {
      toast("Błąd: " + (error as Error).message, "error");
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
      void fetchData();
    } catch (error) {
      toast("Błąd: " + (error as Error).message, "error");
    }
  };

  const handleStart = async (item: WishlistItem) => {
    try {
      const res = await fetch(`/api/wishlist/${item.id}/start`, { method: "POST" });
      if (!res.ok) throw new Error(await res.text());
      toast("Przeniesiono do dziennika ✓", "success");
      void fetchData();
    } catch (error) {
      toast("Błąd: " + (error as Error).message, "error");
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
    setEditForm((form) => ({ ...form, [field]: value }));

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
        <div className="flex items-center justify-between gap-3 mb-2">
          <p className="text-sm font-medium text-gray-700">Dodaj z biblioteki</p>
          <button
            onClick={checkAllVod}
            disabled={checkingAllVod}
            className="text-xs text-gray-600 hover:text-gray-900 disabled:opacity-50"
          >
            {checkingAllVod ? "Sprawdzam…" : "Sprawdź VOD"}
          </button>
        </div>
        <div ref={dropdownRef} className="relative">
          <input
            type="text"
            value={mediaSearch}
            onChange={(event) => handleSearchChange(event.target.value)}
            placeholder="Szukaj po tytule..."
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-purple-500 focus:border-transparent"
          />
          {filteredMedia.length > 0 && (
            <div className="absolute top-full left-0 right-0 bg-white border border-gray-200 rounded-xl shadow-lg mt-1 max-h-64 overflow-y-auto z-50">
              {filteredMedia.map((media) => (
                <button
                  key={media.id}
                  type="button"
                  onMouseDown={() => handleAddFromMedia(media)}
                  className="w-full flex items-center gap-3 px-3 py-2 hover:bg-gray-50 text-left"
                >
                  <MediaCoverThumb coverUrl={media.cover_url} title={media.title} mediaType={media.media_type} className="w-8 h-10" sizes="32px" />
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">{media.title}</p>
                    {media.author && <p className="text-xs text-gray-500 truncate">{media.author}</p>}
                  </div>
                  <span className="ml-auto text-xs text-gray-400 shrink-0">{MEDIA_TYPE_LABELS[media.media_type] ?? media.media_type}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      <WatchlistCalendar
        items={items}
        loading={loading}
        vodMap={vodMap}
        onStart={handleStart}
        onEdit={openEdit}
        onDelete={handleDelete}
      />

      {editingItem && (
        <div className="fixed inset-0 bg-black/50 z-40 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl border border-gray-200 p-6 w-full max-w-lg">
            <h2 className="text-lg font-semibold text-gray-800 mb-4">Edytuj pozycję</h2>
            <form onSubmit={handleEdit} className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Tytuł *</label>
                <input required value={editForm.title} onChange={(event) => setEditField("title", event.target.value)} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Typ *</label>
                <select required value={editForm.media_type} onChange={(event) => setEditField("media_type", event.target.value)} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm">
                  {MEDIA_TYPES.map((type) => <option key={type} value={type}>{MEDIA_TYPE_EMOJI[type]} {MEDIA_TYPE_LABELS[type]}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Autor</label>
                <input value={editForm.author} onChange={(event) => setEditField("author", event.target.value)} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">Notatki</label>
                <textarea value={editForm.notes} onChange={(event) => setEditField("notes", event.target.value)} rows={2} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
              </div>
              <div className="md:col-span-2 flex gap-2">
                <button type="submit" disabled={submitting} className="bg-purple-600 hover:bg-purple-700 text-white px-6 py-2 rounded-lg text-sm font-medium disabled:opacity-50">
                  {submitting ? "Zapisywanie..." : "Zaktualizuj"}
                </button>
                <button type="button" onClick={() => setEditingItem(null)} className="bg-gray-200 hover:bg-gray-300 text-gray-700 px-6 py-2 rounded-lg text-sm font-medium">
                  Anuluj
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
