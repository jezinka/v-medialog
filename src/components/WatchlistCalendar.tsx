"use client";

import { useCallback, useEffect, useState } from "react";
import MediaCoverThumb from "./MediaCoverThumb";

interface WatchlistEntry {
  media_id: number;
  season_id: number;
  season_number: number | null;
  title: string;
  media_type: string;
  cover_url: string | null;
  last_session_date: string | null;
  category: "future" | "past" | "no_date";
}

interface WishlistItem {
  id: number;
  title: string;
  author: string | null;
  media_type: string;
  notes: string | null;
  added_at: string;
  cover_url: string | null;
}

interface VodOffer {
  id: number;
  provider_name: string;
  provider_logo: string | null;
  url: string | null;
}

interface Props {
  items: WishlistItem[];
  loading: boolean;
  vodMap: Record<number, VodOffer[]>;
  onStart: (item: WishlistItem) => void;
  onEdit: (item: WishlistItem) => void;
  onDelete: (id: number) => void;
}

const groups = [
  { title: "Seriale", types: ["series", "anime", "cartoon"] },
  { title: "Filmy", types: ["movie"] },
  { title: "Książki i komiksy", types: ["book", "comic"] },
];

export default function WatchlistCalendar({ items, loading, vodMap, onStart, onEdit, onDelete }: Props) {
  const [entries, setEntries] = useState<WatchlistEntry[]>([]);
  const [loadingEntries, setLoadingEntries] = useState(true);

  const fetchData = useCallback(async () => {
    setLoadingEntries(true);
    try {
      const res = await fetch("/api/watchlist-calendar");
      const data = await res.json();
      setEntries(Array.isArray(data) ? data : []);
    } catch {
      setEntries([]);
    } finally {
      setLoadingEntries(false);
    }
  }, []);

  useEffect(() => { void fetchData(); }, [fetchData]);

  if (loading || loadingEntries) {
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
        const wishlistItems = items.filter((item) => types.includes(item.media_type));

        return (
          <section key={title} className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 min-w-0">
            <h2 className="text-base font-semibold text-gray-800 mb-3">{title}</h2>
            {seasons.length === 0 && wishlistItems.length === 0 ? (
              <p className="text-sm text-gray-400 py-4">Brak pozycji.</p>
            ) : (
              <div className="space-y-2">
                {seasons.map((entry) => (
                  <a
                    key={`season-${entry.season_id}`}
                    href={`/media/${entry.media_id}`}
                    className="flex gap-3 rounded-lg border border-gray-100 p-2 hover:bg-gray-50 transition-colors"
                  >
                    <MediaCoverThumb coverUrl={entry.cover_url} title={entry.title} mediaType={entry.media_type} />
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">{entry.title}</p>
                      <p className="text-xs text-gray-500">
                        {entry.season_number != null ? `Sezon ${entry.season_number}` : "Sezon"}
                        {entry.last_session_date ? ` · ${entry.last_session_date}` : " · bez daty premiery"}
                      </p>
                    </div>
                  </a>
                ))}
                {wishlistItems.map((item) => (
                  <div key={`wishlist-${item.id}`} className="flex gap-3 rounded-lg border border-gray-100 p-2">
                    <MediaCoverThumb coverUrl={item.cover_url} title={item.title} mediaType={item.media_type} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">{item.title}</p>
                      {(item.author || item.notes) && (
                        <p className="text-xs text-gray-500 truncate">{item.author ?? item.notes}</p>
                      )}
                      {vodMap[item.id]?.length > 0 && (
                        <p className="text-xs text-green-700 truncate">{vodMap[item.id].map((offer) => offer.provider_name).join(", ")}</p>
                      )}
                    </div>
                    <div className="flex gap-1 self-start">
                      <button onClick={() => onStart(item)} className="text-xs text-green-700 hover:text-green-900" title="Zaczynam">
                        ▶
                      </button>
                      <button onClick={() => onEdit(item)} className="text-xs text-purple-600 hover:text-purple-800" title="Edytuj">
                        ✎
                      </button>
                      <button onClick={() => onDelete(item.id)} className="text-xs text-red-500 hover:text-red-700" title="Usuń">
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
