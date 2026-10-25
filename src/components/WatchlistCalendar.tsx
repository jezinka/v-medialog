"use client";

import { useCallback, useEffect, useState } from "react";
import type { WatchlistEntry } from "@/app/api/watchlist-calendar/route";
import MediaCoverThumb from "./MediaCoverThumb";
import { toast } from "./Toast";

interface VodOffer {
  id: number;
  provider_name: string;
  provider_logo: string | null;
  url: string | null;
}

interface Props {
  /** Bump to refetch after an item was added elsewhere on the page */
  refreshKey: number;
}

const groups = [
  { title: "Seriale", types: ["series", "anime"] },
  { title: "Filmy", types: ["movie", "cartoon"] },
  { title: "Książki i komiksy", types: ["book", "comic"] },
];

const SCREEN_TYPES = ["movie", "series", "anime", "cartoon"];

export default function WatchlistCalendar({ refreshKey }: Props) {
  const [entries, setEntries] = useState<WatchlistEntry[]>([]);
  const [vodMap, setVodMap] = useState<Record<number, VodOffer[]>>({});
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/watchlist-calendar");
      const data = await res.json();
      const list: WatchlistEntry[] = Array.isArray(data) ? data : [];
      setEntries(list);
      const mediaIds = [...new Set(list.filter((entry) => SCREEN_TYPES.includes(entry.media_type)).map((entry) => entry.media_id))];
      const results = await Promise.allSettled(
        mediaIds.map((id) => fetch(`/api/vod/offers?itemType=media&itemId=${id}`).then((response) => response.json()))
      );
      const map: Record<number, VodOffer[]> = {};
      mediaIds.forEach((id, index) => {
        const result = results[index];
        if (result.status === "fulfilled") map[id] = (result.value as { offers: VodOffer[] }).offers ?? [];
      });
      setVodMap(map);
    } catch {
      setEntries([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void fetchData(); }, [fetchData, refreshKey]);

  const handleStart = async (entry: WatchlistEntry) => {
    try {
      const res = await fetch(`/api/seasons/${entry.season_id}/start`, { method: "POST" });
      if (!res.ok) throw new Error(await res.text());
      toast("Przeniesiono do dziennika ✓", "success");
      void fetchData();
    } catch (error) {
      toast("Błąd: " + (error as Error).message, "error");
    }
  };

  const handleRemove = async (entry: WatchlistEntry) => {
    if (!confirm("Usunąć z listy?")) return;
    try {
      const res = await fetch(`/api/seasons/${entry.season_id}/want-to-watch`, { method: "DELETE" });
      if (!res.ok) throw new Error(await res.text());
      toast("Usunięto!", "info");
      void fetchData();
    } catch (error) {
      toast("Błąd: " + (error as Error).message, "error");
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-400" />
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {groups.map(({ title, types }) => {
        const seasons = entries.filter((entry) => types.includes(entry.media_type));

        return (
          <section key={title} className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 min-w-0">
            <h2 className="text-base font-semibold text-gray-800 mb-3">{title}</h2>
            {seasons.length === 0 ? (
              <p className="text-sm text-gray-400 py-4">Brak pozycji.</p>
            ) : (
              <div className="space-y-2">
                {seasons.map((entry) => (
                  <div key={entry.season_id} className="flex gap-3 rounded-lg border border-gray-100 p-2 hover:bg-gray-50 transition-colors">
                    <a href={`/media/${entry.media_id}`} className="flex flex-1 gap-3 min-w-0">
                      <MediaCoverThumb coverUrl={entry.cover_url} title={entry.title} mediaType={entry.media_type} />
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-gray-900 truncate">{entry.title}</p>
                        {entry.author && <p className="text-xs text-gray-500 truncate">{entry.author}</p>}
                        {types.includes("series") && (
                          <p className="text-xs text-gray-500">
                            {entry.season_number != null ? `Sezon ${entry.season_number}` : "Sezon"}
                            {entry.last_session_date ? ` · ${entry.last_session_date}` : " · bez daty premiery"}
                          </p>
                        )}
                        {vodMap[entry.media_id]?.length > 0 && (
                          <p className="text-xs text-green-700 truncate">{vodMap[entry.media_id].map((offer) => offer.provider_name).join(", ")}</p>
                        )}
                      </div>
                    </a>
                    <div className="flex gap-1 self-start">
                      <button onClick={() => handleStart(entry)} className="text-xs text-green-700 hover:text-green-900" title="Zaczynam">
                        ▶
                      </button>
                      <button onClick={() => handleRemove(entry)} className="text-xs text-red-500 hover:text-red-700" title="Usuń z listy">
                        ×
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        );
      })}
    </div>
  );
}
