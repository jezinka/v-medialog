"use client";
import { useState } from "react";
import Modal from "../Modal";
import CoverUrlField from "../CoverUrlField";
import { toast } from "../Toast";
import { BOOK_TYPES, SCREEN_TYPES, MEDIA_TYPE_LABELS } from "@/lib/utils";
import type { MediaData } from "./types";

export default function EditMediaModal({ media, onClose, onSaved }: {
  media: MediaData;
  onClose: () => void;
  onSaved: () => Promise<void>;
}) {
  const [mediaEditForm, setMediaEditForm] = useState({
    title: media.title,
    original_title: media.original_title ?? "",
    author: media.author ?? "",
    description: media.description ?? "",
    tags: media.tags ?? "",
    cover_url: media.cover_url ?? "",
    discontinued: !!(media.discontinued),
    tmdb_id: media.tmdb_id != null ? String(media.tmdb_id) : "",
    ol_key: media.ol_key ?? "",
    media_type: media.media_type,
  });
  const [mediaEditSaving, setMediaEditSaving] = useState(false);
  const [uploadingCover, setUploadingCover] = useState(false);
  const [lcEditUrl, setLcEditUrl] = useState("");
  const [lcEditLoading, setLcEditLoading] = useState(false);

  const handleLcEditFetch = async () => {
    if (!lcEditUrl.trim()) return;
    setLcEditLoading(true);
    try {
      const res = await fetch("/api/scrape/lubimyczytac", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: lcEditUrl.trim() }),
      });
      const data = await res.json();
      if (!res.ok) { toast(data.error ?? "Błąd scrapowania", "error"); return; }
      setMediaEditForm((f) => ({
        ...f,
        title: data.title || f.title,
        original_title: data.original_title || f.original_title,
        author: data.author || f.author,
        cover_url: data.cover_url || f.cover_url,
        description: data.description || f.description,
      }));
      toast("Dane pobrane ✓", "success");
    } catch {
      toast("Błąd połączenia", "error");
    } finally {
      setLcEditLoading(false);
    }
  };

  const handleSave = async () => {
    setMediaEditSaving(true);
    try {
      const res = await fetch(`/api/media/${media.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: mediaEditForm.title,
          original_title: mediaEditForm.original_title || null,
          author: mediaEditForm.author || null,
          media_type: mediaEditForm.media_type,
          cover_url: mediaEditForm.cover_url || null,
          description: mediaEditForm.description || null,
          tags: mediaEditForm.tags || null,
          discontinued: mediaEditForm.discontinued,
          tmdb_id: mediaEditForm.tmdb_id ? parseInt(mediaEditForm.tmdb_id) : null,
          ol_key: mediaEditForm.ol_key || null,
        }),
      });
      if (!res.ok) throw new Error();
      toast("Zapisano medium ✓", "success");
      onClose();
      await onSaved();
    } catch {
      toast("Błąd zapisu", "error");
    } finally {
      setMediaEditSaving(false);
    }
  };

  return (
    <Modal onClose={onClose} label="Edytuj medium" className="rounded-xl shadow-xl p-5 max-w-md w-full space-y-3 max-h-[90vh] overflow-y-auto">
        <h3 className="text-sm font-semibold text-gray-900">Edytuj medium</h3>
        {/* lubimyczytac.pl quick-fill */}
        {BOOK_TYPES.includes(media.media_type) && (
          <div className="flex gap-2 pb-1 border-b border-gray-100">
            <input
              type="url"
              value={lcEditUrl}
              onChange={(e) => setLcEditUrl(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleLcEditFetch()}
              placeholder="Uzupełnij z lubimyczytac.pl (URL)…"
              className="input flex-1 px-3 py-1.5 text-xs"
            />
            <button
              onClick={handleLcEditFetch}
              disabled={lcEditLoading || !lcEditUrl.trim()}
              className="shrink-0 bg-orange-500 text-white px-3 py-1.5 rounded-lg text-xs hover:bg-orange-600 disabled:opacity-50"
            >
              {lcEditLoading ? "⏳" : "📚 Pobierz"}
            </button>
          </div>
        )}
        <div>
          <label className="text-xs font-medium text-gray-600 block mb-1">Tytuł *</label>
          <input
            type="text"
            value={mediaEditForm.title}
            onChange={(e) => setMediaEditForm((f) => ({ ...f, title: e.target.value }))}
            className="input w-full px-3 py-1.5 text-sm"
          />
        </div>
        <div>
          <label className="text-xs font-medium text-gray-600 block mb-1">Tytuł oryginalny</label>
          <input
            type="text"
            value={mediaEditForm.original_title}
            onChange={(e) => setMediaEditForm((f) => ({ ...f, original_title: e.target.value }))}
            className="input w-full px-3 py-1.5 text-sm"
          />
        </div>
        <div>
          <label className="text-xs font-medium text-gray-600 block mb-1">Autor</label>
          <input
            type="text"
            value={mediaEditForm.author}
            onChange={(e) => setMediaEditForm((f) => ({ ...f, author: e.target.value }))}
            className="input w-full px-3 py-1.5 text-sm"
          />
        </div>
        <div>
          <label className="text-xs font-medium text-gray-600 block mb-1">Tagi (oddzielone przecinkami)</label>
          <input
            type="text"
            value={mediaEditForm.tags}
            onChange={(e) => setMediaEditForm((f) => ({ ...f, tags: e.target.value }))}
            placeholder="np. fantasy, klasyka"
            className="input w-full px-3 py-1.5 text-sm"
          />
        </div>
        <div>
          <label className="text-xs font-medium text-gray-600 block mb-1">Opis</label>
          <textarea
            value={mediaEditForm.description}
            onChange={(e) => setMediaEditForm((f) => ({ ...f, description: e.target.value }))}
            rows={3}
            className="input w-full px-3 py-1.5 text-sm resize-none"
          />
        </div>
        <div>
          <label className="text-xs font-medium text-gray-600 block mb-1">URL okładki</label>
          <CoverUrlField
            value={mediaEditForm.cover_url}
            onChange={(cover_url) => setMediaEditForm((f) => ({ ...f, cover_url }))}
            placeholder="https://... lub wgraj plik →"
            uploading={uploadingCover}
            onUploadingChange={setUploadingCover}
          />
        </div>
        <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
          <input
            type="checkbox"
            checked={mediaEditForm.discontinued}
            onChange={(e) => setMediaEditForm((f) => ({ ...f, discontinued: e.target.checked }))}
            className="w-4 h-4"
          />
          Porzucone
        </label>
        <div>
          <label className="text-xs font-medium text-gray-600 block mb-1">Typ</label>
          <select
            value={mediaEditForm.media_type}
            onChange={(e) => setMediaEditForm((f) => ({ ...f, media_type: e.target.value }))}
            className="input w-full px-3 py-1.5 text-sm"
          >
            {Object.entries(MEDIA_TYPE_LABELS).map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
        </div>
        {SCREEN_TYPES.includes(media.media_type) && (
          <div>
            <label className="text-xs font-medium text-gray-600 block mb-1">
              TMDB ID <span className="text-gray-400 font-normal">(opcjonalnie)</span>
            </label>
            <input
              type="number"
              value={mediaEditForm.tmdb_id}
              onChange={(e) => setMediaEditForm((f) => ({ ...f, tmdb_id: e.target.value }))}
              placeholder="np. 1399"
              className="input w-full px-3 py-1.5 text-sm"
            />
          </div>
        )}
        <div className="flex gap-2 pt-1">
          <button
            onClick={handleSave}
            disabled={mediaEditSaving || uploadingCover}
            className="btn-primary flex-1 py-2 text-sm"
          >
            {mediaEditSaving ? "Zapisuję..." : uploadingCover ? "Wgrywanie…" : "Zapisz"}
          </button>
          <button
            onClick={onClose}
            className="px-3 py-2 bg-gray-100 text-gray-600 rounded-lg text-sm hover:bg-gray-200"
          >
            Anuluj
          </button>
        </div>
    </Modal>
  );
}
