"use client";
import { useMemo, useState } from "react";
import { BOOK_TYPES, SCREEN_TYPES, MONTH_NAMES, daysBetween } from "@/lib/utils";

interface MediaItem {
  id: number;
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

export default function Statistics({ items, year }: Props) {
  const [selectedMonth, setSelectedMonth] = useState<number | null>(null);

  const filtered = useMemo(() => {
    if (selectedMonth === null) return items;
    return items.filter((item) => mediaOverlapsMonth(item, year, selectedMonth));
  }, [items, year, selectedMonth]);

  const books = filtered.filter((i) => BOOK_TYPES.includes(i.mediaType));
  const screens = filtered.filter((i) => SCREEN_TYPES.includes(i.mediaType));
  const plays = filtered.filter((i) => i.mediaType === "play");
  const games = filtered.filter((i) => i.mediaType === "game");
  const podcasts = filtered.filter((i) => i.mediaType === "podcast");
  const records = filtered.filter((i) => i.mediaType === "record");
  const cinemaMovies = filtered.filter((i) => i.mediaType === "movie" && i.cinema);

  const bookDays = books.reduce((sum, i) => sum + daysBetween(i.startDate, i.endDate), 0);
  const screenDays = screens.reduce((sum, i) => sum + daysBetween(i.startDate, i.endDate), 0);

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
          <div className="text-2xl font-bold text-gray-900">{bookDays}</div>
          <div className="text-xs text-gray-500">Dni czytania</div>
        </div>
        <div className="bg-gray-50 rounded-xl p-3 text-center">
          <div className="text-2xl font-bold text-gray-900">{screens.length}</div>
          <div className="text-xs text-gray-500">Filmów / Seriali</div>
        </div>
        <div className="bg-gray-50 rounded-xl p-3 text-center">
          <div className="text-2xl font-bold text-gray-900">{screenDays}</div>
          <div className="text-xs text-gray-500">Dni oglądania</div>
        </div>
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
        {cinemaMovies.length > 0 && (
          <div className="bg-gray-50 rounded-xl p-3 text-center">
            <div className="text-2xl font-bold text-gray-900">{cinemaMovies.length}</div>
            <div className="text-xs text-gray-500">🎟️ Filmów w kinie</div>
          </div>
        )}
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        {books.length > 0 && (
          <div>
            <h4 className="text-sm font-semibold text-gray-700 mb-2">📚 Przeczytane</h4>
            <div className="space-y-1">
              {books.map((item) => (
                <div key={item.id} className="text-xs text-gray-600 flex justify-between gap-2">
                  <span className={`flex-1 truncate ${item.discontinued ? "line-through opacity-60" : ""}`}>
                    {item.title}{item.volumeEpisode ? ` (${item.volumeEpisode})` : ""}
                  </span>
                  <span className="text-gray-400 whitespace-nowrap">
                    {item.endDate ? `${daysBetween(item.startDate, item.endDate)} dni` : "W trakcie"}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
        {screens.length > 0 && (
          <div>
            <h4 className="text-sm font-semibold text-gray-700 mb-2">🎬 Obejrzane</h4>
            <div className="space-y-1">
              {screens.map((item) => (
                <div key={item.id} className="text-xs text-gray-600 flex justify-between gap-2">
                  <span className={`flex-1 truncate ${item.discontinued ? "line-through opacity-60" : ""}`}>
                    {item.title}{item.volumeEpisode ? ` (${item.volumeEpisode})` : ""}
                  </span>
                  <span className="text-gray-400 whitespace-nowrap">
                    {item.endDate ? `${daysBetween(item.startDate, item.endDate)} dni` : "W trakcie"}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
        {plays.length > 0 && (
          <div>
            <h4 className="text-sm font-semibold text-gray-700 mb-2">🎭 Sztuki teatralne</h4>
            <div className="space-y-1">
              {plays.map((item) => (
                <div key={item.id} className="text-xs text-gray-600 flex justify-between gap-2">
                  <span className={`flex-1 truncate ${item.discontinued ? "line-through opacity-60" : ""}`}>{item.title}</span>
                </div>
              ))}
            </div>
          </div>
        )}
        {games.length > 0 && (
          <div>
            <h4 className="text-sm font-semibold text-gray-700 mb-2">🎮 Gry</h4>
            <div className="space-y-1">
              {games.map((item) => (
                <div key={item.id} className="text-xs text-gray-600 flex justify-between gap-2">
                  <span className={`flex-1 truncate ${item.discontinued ? "line-through opacity-60" : ""}`}>{item.title}</span>
                </div>
              ))}
            </div>
          </div>
        )}
        {podcasts.length > 0 && (
          <div>
            <h4 className="text-sm font-semibold text-gray-700 mb-2">🎙️ Podcasty</h4>
            <div className="space-y-1">
              {podcasts.map((item) => (
                <div key={item.id} className="text-xs text-gray-600 flex justify-between gap-2">
                  <span className={`flex-1 truncate ${item.discontinued ? "line-through opacity-60" : ""}`}>{item.title}</span>
                </div>
              ))}
            </div>
          </div>
        )}
        {records.length > 0 && (
          <div>
            <h4 className="text-sm font-semibold text-gray-700 mb-2">🎵 Płyty</h4>
            <div className="space-y-1">
              {records.map((item) => (
                <div key={item.id} className="text-xs text-gray-600 flex justify-between gap-2">
                  <span className={`flex-1 truncate ${item.discontinued ? "line-through opacity-60" : ""}`}>
                    {item.title}{item.author ? ` — ${item.author}` : ""}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
