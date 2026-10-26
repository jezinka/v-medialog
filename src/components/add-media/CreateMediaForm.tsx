"use client";
import { useState, type Dispatch, type SetStateAction } from "react";
import { MEDIA_TYPES, MEDIA_TYPE_LABELS, BOOK_TYPES, CALENDAR_TYPES } from "@/lib/utils";
import { toast } from "../Toast";

export const EMPTY_MEDIA_FORM = {
  title: "",
  original_title: "",
  author: "",
  media_type: "book",
  universe_id: "",
  cover_url: "",
  description: "",
  tmdb_id: "",
};
export type MediaForm = typeof EMPTY_MEDIA_FORM;

/** Creates a media item (with its author / director and optionally on the wishlist) from the form. */
export default function CreateMediaForm({ form, setForm, showLcLink, onBack, onCreated }: {
  form: MediaForm;
  setForm: Dispatch<SetStateAction<MediaForm>>;
  /** Offers going back to the lubimyczytac.pl fill, unless the form already came from it */
  showLcLink: boolean;
  onBack: () => void;
  onCreated: (mediaId: number) => void;
}) {
  const [createLoading, setCreateLoading] = useState(false);
  const [addToWishlist, setAddToWishlist] = useState(false);

  const handleCreate = async () => {
    if (!form.title.trim()) { toast("Tytuł jest wymagany", "error"); return; }
    setCreateLoading(true);
    try {
      const res = await fetch("/api/media", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: form.title,
          original_title: form.original_title || null,
          author: form.author || null,
          media_type: form.media_type,
          universe_id: form.universe_id ? parseInt(form.universe_id) : null,
          cover_url: form.cover_url || null,
          description: form.description || null,
          tmdb_id: form.tmdb_id || null,
        }),
      });
      if (!res.ok) throw new Error(await res.text());
      const created = await res.json() as { id: number; title: string; author: string | null; media_type: string; cover_url: string | null; tmdb_id: string | null };
      // Create a linked person record for the author/director
      if (form.author.trim()) {
        const role = BOOK_TYPES.includes(form.media_type) ? "author" : "director";
        await fetch(`/api/media/${created.id}/external`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            persons: [{ name: form.author.trim(), role, display_order: 0 }],
          }),
        });
      }
      if (addToWishlist && CALENDAR_TYPES.includes(created.media_type)) {
        const wishRes = await fetch(`/api/media/${created.id}/want-to-watch`, { method: "POST" });
        if (!wishRes.ok) throw new Error(await wishRes.text());
        toast("Dodano do listy życzeń!", "success");
      } else {
        toast("Utworzono medium!", "success");
      }
      onCreated(created.id);
    } catch (err) {
      toast("Błąd: " + (err as Error).message, "error");
    } finally {
      setCreateLoading(false);
    }
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <p className="text-xs font-medium text-gray-700">Nowe medium</p>
        {/* LC quick-fill also accessible from create form */}
        {showLcLink && BOOK_TYPES.includes(form.media_type) && (
          <button
            type="button"
            onClick={onBack}
            className="text-[11px] text-orange-500 hover:text-orange-700"
          >
            📚 Pobierz z lubimyczytac
          </button>
        )}
      </div>
      {/* Cover preview */}
      {form.cover_url && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={form.cover_url} alt="" className="h-20 w-auto rounded border border-gray-200 object-contain" />
      )}
      <input
        type="text"
        value={form.title}
        onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
        placeholder="Tytuł *"
        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-200 focus:outline-none"
        autoFocus
      />
      <input
        type="text"
        value={form.original_title}
        onChange={(e) => setForm((f) => ({ ...f, original_title: e.target.value }))}
        placeholder="Tytuł oryginalny"
        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-200 focus:outline-none"
      />
      <input
        type="text"
        value={form.author}
        onChange={(e) => setForm((f) => ({ ...f, author: e.target.value }))}
        placeholder="Autor"
        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-200 focus:outline-none"
      />
      <select
        value={form.media_type}
        onChange={(e) => setForm((f) => ({ ...f, media_type: e.target.value }))}
        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-200 focus:outline-none"
      >
        {MEDIA_TYPES.map((t) => (
          <option key={t} value={t}>{MEDIA_TYPE_LABELS[t] ?? t}</option>
        ))}
      </select>
      <input
        type="url"
        value={form.cover_url}
        onChange={(e) => setForm((f) => ({ ...f, cover_url: e.target.value }))}
        placeholder="URL okładki / miniatury"
        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-200 focus:outline-none"
      />
      <textarea
        value={form.description}
        onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
        placeholder="Opis"
        rows={3}
        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-200 focus:outline-none resize-none"
      />
      <input
        type="number"
        value={form.universe_id}
        onChange={(e) => setForm((f) => ({ ...f, universe_id: e.target.value }))}
        placeholder="ID Uniwersum (opcjonalnie)"
        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-200 focus:outline-none"
      />
      {CALENDAR_TYPES.includes(form.media_type) && (
        <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer select-none pt-1">
          <input
            type="checkbox"
            checked={addToWishlist}
            onChange={(e) => setAddToWishlist(e.target.checked)}
            className="w-4 h-4 accent-purple-600"
          />
          {BOOK_TYPES.includes(form.media_type) ? "📖 Chcę przeczytać" : "👁 Chcę obejrzeć"}
        </label>
      )}
      <div className="flex gap-2 pt-1">
        <button
          type="button"
          onClick={onBack}
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
  );
}
