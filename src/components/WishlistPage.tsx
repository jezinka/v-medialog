"use client";

import { useState } from "react";
import { CALENDAR_TYPES, MEDIA_TYPE_LABELS } from "@/lib/utils";
import { toast } from "./Toast";
import WatchlistCalendar from "./WatchlistCalendar";
import { useMediaSearch } from "@/lib/hooks/useMediaSearch";
import MediaCoverThumb from "./MediaCoverThumb";

export default function WishlistPage() {
  const [refreshKey, setRefreshKey] = useState(0);
  const [checkingAllVod, setCheckingAllVod] = useState(false);
  const { mediaSearch, filteredMedia, handleSearchChange, dropdownRef, clearResults } = useMediaSearch();
  const refresh = () => setRefreshKey((key) => key + 1);
  const candidates = filteredMedia.filter((media) => CALENDAR_TYPES.includes(media.media_type));

  const checkAllVod = async () => {
    setCheckingAllVod(true);
    try {
      await fetch("/api/vod/refresh-all", { method: "POST" });
      toast("Sprawdzono dostępność VOD ✓", "success");
      refresh();
    } catch {
      toast("Błąd sprawdzania VOD", "error");
    } finally {
      setCheckingAllVod(false);
    }
  };

  const handleAddFromMedia = async (media: { id: number }) => {
    clearResults();
    try {
      const res = await fetch(`/api/media/${media.id}/want-to-watch`, { method: "POST" });
      if (!res.ok) throw new Error(await res.text());
      toast("Dodano do listy!", "success");
      refresh();
    } catch (error) {
      toast("Błąd: " + (error as Error).message, "error");
    }
  };

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
          {candidates.length > 0 && (
            <div className="absolute top-full left-0 right-0 bg-white border border-gray-200 rounded-xl shadow-lg mt-1 max-h-64 overflow-y-auto z-50">
              {candidates.map((media) => (
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

      <WatchlistCalendar refreshKey={refreshKey} />
    </div>
  );
}
