"use client";
import { useMemo, useState } from "react";
import { BOOK_TYPES, MONTH_NAMES } from "@/lib/utils";

const MOVIE_TYPES = ["movie"];
const SERIES_TYPES = ["series", "anime", "cartoon"];

interface MediaItem {
  id: number;
  seasonId?: number | null;
  title: string;
  author: string | null;
  mediaType: string;
  startDate: string;
  endDate: string | null;
  volumeEpisode: string | null;
  discontinued: boolean | null;
  cinema?: boolean | number | null;
  tagList?: { id: number; name: string }[];
}

interface Props {
  items: MediaItem[];
  year: number;
}

function mediaOverlapsMonth(item: MediaItem, year: number, month: number): boolean {
  const monthStart = `${year}-${String(month + 1).padStart(2, "0")}-01`;
  const lastDay = new Date(year, month + 1, 0).getDate();
  const monthEnd = `${year}-${String(month + 1).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;
  const end = item.endDate || item.startDate;
  return item.startDate <= monthEnd && end >= monthStart;
}

function groupBySeason(items: MediaItem[]): MediaItem[] {
  const map = new Map<string, MediaItem[]>();
  for (const item of items) {
    const key = item.seasonId != null
      ? `s${item.seasonId}`
      : `${item.title}__${item.mediaType}__${item.volumeEpisode ?? ""}`;
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(item);
  }
  return Array.from(map.values()).map((group) => {
    const first = group[0];
    const startDate = group.reduce((min, i) => i.startDate < min ? i.startDate : min, first.startDate);
    const allHaveEnd = group.every((i) => i.endDate != null);
    const endDate = allHaveEnd
      ? group.reduce((max, i) => i.endDate! > max ? i.endDate! : max, first.endDate!)
      : null;
    return { ...first, startDate, endDate };
  });
}

export default function Statistics({ items, year }: Props) {
  const [selectedMonth, setSelectedMonth] = useState<number | null>(null);

  const filtered = useMemo(() => {
    if (selectedMonth === null) return items;
    return items.filter((item) => mediaOverlapsMonth(item, year, selectedMonth));
  }, [items, year, selectedMonth]);

  const grouped = useMemo(() => groupBySeason(filtered), [filtered]);

  const books = grouped.filter((i) => BOOK_TYPES.includes(i.mediaType));
  const movies = grouped.filter((i) => MOVIE_TYPES.includes(i.mediaType));
  const series = grouped.filter((i) => SERIES_TYPES.includes(i.mediaType));
  const plays = grouped.filter((i) => i.mediaType === "play");
  const games = grouped.filter((i) => i.mediaType === "game");
  const podcasts = grouped.filter((i) => i.mediaType === "podcast");
  const records = grouped.filter((i) => i.mediaType === "record");
  const cinemaMovies = movies.filter((i) => i.cinema);

  return (
    <div className="bg-white rounded-2xl shadow border border-gray-100 p-4">
      <div className="flex flex-wrap items-center gap-2 mb-4">
        <h3 className="text-lg font-semibold text-gray-900 mr-2">Statystyki</h3>
        <button
          onClick={() => setSelectedMonth(null)}
          className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${selectedMonth === null ? "bg-gray-900 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}
        >
          Cały rok
        </button>
        {MONTH_NAMES.map((name, idx) => (
          <button
            key={idx}
            onClick={() => setSelectedMonth(idx === selectedMonth ? null : idx)}
            className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${selectedMonth === idx ? "bg-gray-900 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}
          >
            {name.slice(0, 3)}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
        <div className="bg-gray-50 rounded-xl p-3 text-center">
          <div className="text-2xl font-bold text-gray-900">{books.length}</div>
          <div className="text-xs text-gray-500">Książek / Komiksów</div>
        </div>
        <div className="bg-gray-50 rounded-xl p-3 text-center">
          <div className="text-2xl font-bold text-gray-900">{movies.length}</div>
          <div className="text-xs text-gray-500">Filmów</div>
        </div>
        <div className="bg-gray-50 rounded-xl p-3 text-center">
          <div className="text-2xl font-bold text-gray-900">{series.length}</div>
          <div className="text-xs text-gray-500">Seriali</div>
        </div>
        {cinemaMovies.length > 0 && (
          <div className="bg-gray-50 rounded-xl p-3 text-center">
            <div className="text-2xl font-bold text-gray-900">{cinemaMovies.length}</div>
            <div className="text-xs text-gray-500">🎟️ W kinie</div>
          </div>
        )}
        {plays.length > 0 && (
          <div className="bg-gray-50 rounded-xl p-3 text-center">
            <div className="text-2xl font-bold text-gray-900">{plays.length}</div>
            <div className="text-xs text-gray-500">🎭 Sztuk teatralnych</div>
          </div>
        )}
        {games.length > 0 && (
          <div className="bg-gray-50 rounded-xl p-3 text-center">
            <div className="text-2xl font-bold text-gray-900">{games.length}</div>
            <div className="text-xs text-gray-500">🎮 Gier</div>
          </div>
        )}
        {podcasts.length > 0 && (
          <div className="bg-gray-50 rounded-xl p-3 text-center">
            <div className="text-2xl font-bold text-gray-900">{podcasts.length}</div>
            <div className="text-xs text-gray-500">🎙️ Podcastów</div>
          </div>
        )}
        {records.length > 0 && (
          <div className="bg-gray-50 rounded-xl p-3 text-center">
            <div className="text-2xl font-bold text-gray-900">{records.length}</div>
            <div className="text-xs text-gray-500">🎵 Płyt</div>
          </div>
        )}
      </div>

      <div className="grid md:grid-cols-3 gap-4">
        {books.length > 0 && (
          <div>
            <h4 className="text-sm font-semibold text-gray-700 mb-2">📚 Przeczytane</h4>
            <div className="space-y-1">
              {books.map((item) => (
                <div
                  key={item.seasonId ?? `${item.title}__${item.id}`}
                  className={`text-xs text-gray-600 ${item.discontinued ? "line-through opacity-60" : ""}`}
                >
                  {item.title}{item.author ? ` — ${item.author}` : ""}
                </div>
              ))}
            </div>
          </div>
        )}
        {movies.length > 0 && (
          <div>
            <h4 className="text-sm font-semibold text-gray-700 mb-2">🎬 Filmy</h4>
            <div className="space-y-1">
              {movies.map((item) => (
                <div
                  key={item.seasonId ?? `${item.title}__${item.id}`}
                  className={`text-xs text-gray-600 ${item.discontinued ? "line-through opacity-60" : ""}`}
                >
                  {item.title}
                </div>
              ))}
            </div>
          </div>
        )}
        {series.length > 0 && (
          <div>
            <h4 className="text-sm font-semibold text-gray-700 mb-2">📺 Seriale</h4>
            <div className="space-y-1">
              {series.map((item) => (
                <div
                  key={item.seasonId ?? `${item.title}__${item.volumeEpisode}__${item.id}`}
                  className={`text-xs text-gray-600 ${item.discontinued ? "line-through opacity-60" : ""}`}
                >
                  {item.title}{item.volumeEpisode ? ` (sezon ${item.volumeEpisode})` : ""}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
