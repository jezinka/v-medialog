"use client";
import { useEffect, useState, useCallback } from "react";
import CoverImg from "./CoverImg";

interface GalleryItem {
  season_id: number;
  media_id: number;
  media_title: string;
  media_type: string;
  volume_episode: string | null;
  season_title: string | null;
  season_number: number | null;
  cover_url: string | null;
  season_cover_url: string | null;
  first_session_date: string;
  last_session_date: string;
  session_count: number;
}

interface Props {
  onItemClick: (mediaId: number) => void;
  year?: number;
}

function seasonLabel(item: GalleryItem): string {
  if (item.season_title) return item.season_title;
  if (item.season_number != null) return `Sezon ${item.season_number}`;
  return "";
}

function displayTitle(item: GalleryItem): string {
  const vol = item.volume_episode ? ` (${item.volume_episode})` : "";
  const s = seasonLabel(item);
  return s ? `${item.media_title}${vol} – ${s}` : `${item.media_title}${vol}`;
}

export default function CoverGallery({ onItemClick, year }: Props) {
  const [items, setItems] = useState<GalleryItem[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const url = year ? `/api/gallery?year=${year}` : "/api/gallery";
      const res = await fetch(url);
      const data = await res.json();
      setItems(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [year]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-400" />
      </div>
    );
  }

  const withCovers = items.filter((i) => i.cover_url || i.season_cover_url);

  // Group by year of first_session_date
  const yearMap = new Map<number, GalleryItem[]>();
  for (const item of withCovers) {
    const y = Number(item.first_session_date.slice(0, 4));
    if (!yearMap.has(y)) yearMap.set(y, []);
    yearMap.get(y)!.push(item);
  }

  const years = Array.from(yearMap.keys()).sort((a, b) => b - a);

  if (years.length === 0) {
    return (
      <div className="py-8 text-center text-gray-400 text-sm">
        {items.length === 0
          ? "Brak sesji w tym roku"
          : "Brak okładek — zsynchronizuj dane z TMDB/OpenLibrary"}
      </div>
    );
  }

  const renderGrid = (groupItems: GalleryItem[]) => (
    <div className="grid grid-cols-3 sm:grid-cols-5 md:grid-cols-7 lg:grid-cols-10 xl:grid-cols-12 gap-2">
      {groupItems.map((item) => (
        <a
          key={item.season_id}
          href={`/media/${item.media_id}`}
          className="group relative aspect-[2/3] rounded-lg overflow-hidden border border-gray-200 shadow-sm hover:shadow-md hover:scale-105 transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-gray-400"
          title={displayTitle(item)}
        >
          <CoverImg
            src={item.cover_url!}
            alt={displayTitle(item)}
            fill
            className="object-cover"
            sizes="(max-width: 640px) 33vw, (max-width: 768px) 20vw, (max-width: 1024px) 14vw, 10vw"
          />
          {/* Season badge when it has its own cover */}
          {item.season_cover_url && item.season_number != null && (
            <div className="absolute top-1 right-1 bg-black/60 text-white text-[9px] font-bold px-1 py-0.5 rounded">
              S{item.season_number}
            </div>
          )}
          <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors" />
          <div className="absolute bottom-0 left-0 right-0 px-1.5 py-1 bg-gradient-to-t from-black/70 to-transparent opacity-0 group-hover:opacity-100 transition-opacity">
            <p className="text-white text-[10px] leading-tight line-clamp-2 font-medium">
              {item.media_title}{item.volume_episode ? ` (${item.volume_episode})` : ""}
            </p>
            {seasonLabel(item) && (
              <p className="text-white/70 text-[9px] leading-tight mt-0.5">{seasonLabel(item)}</p>
            )}
          </div>
        </a>
      ))}
    </div>
  );

  return (
    <div className="space-y-10">
      {year ? (
        renderGrid(withCovers)
      ) : (
        years.map((y) => {
          const yearItems = yearMap.get(y)!;
          return (
            <section key={y}>
              <h2 className="text-xl font-bold text-gray-800 mb-4 sticky top-[57px] bg-gray-50 py-2 z-10">
                {y}
                <span className="ml-2 text-sm font-normal text-gray-400">{yearItems.length} pozycji</span>
              </h2>
              {renderGrid(yearItems)}
            </section>
          );
        })
      )}
    </div>
  );
}
