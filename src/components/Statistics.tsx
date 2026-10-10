"use client";

import { useMemo, useState } from "react";
import { BOOK_TYPES, formatDate, MEDIA_TYPE_EMOJI, MONTH_NAMES } from "@/lib/utils";

const MOVIE_TYPES = ["movie", "cartoon"];
const SERIES_TYPES = ["series"];
const ANIME_TYPES = ["anime"];

interface MediaItem {
  id: number;
  mediaId: number;
  seasonId?: number | null;
  title: string;
  author: string | null;
  mediaType: string;
  startDate: string;
  endDate: string | null;
  volumeEpisode: string | null;
  discontinued: boolean | null;
  cinema?: boolean | number | null;
  withChild?: boolean | number | null;
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

function groupByTitle(items: MediaItem[]): MediaItem[] {
  const map = new Map<string, MediaItem[]>();
  for (const item of items) {
    const key = `${item.title}__${item.mediaType}`;
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(item);
  }
  return Array.from(map.values()).map((group) => {
    const first = group[0];
    const startDate = group.reduce((min, item) => item.startDate < min ? item.startDate : min, first.startDate);
    const allHaveEnd = group.every((item) => item.endDate != null);
    const endDate = allHaveEnd
      ? group.reduce((max, item) => item.endDate! > max ? item.endDate! : max, first.endDate!)
      : null;
    return { ...first, startDate, endDate };
  });
}

function StatisticsItem({ item }: { item: MediaItem }) {
  const date = item.endDate && item.endDate !== item.startDate
    ? `${formatDate(item.startDate)}–${formatDate(item.endDate)}`
    : formatDate(item.startDate);
  const details = [
    item.author,
    item.volumeEpisode && !BOOK_TYPES.includes(item.mediaType) ? `Sezon ${item.volumeEpisode}` : null,
    date,
  ].filter(Boolean);

  return (
    <a href={`/media/${item.mediaId}`} className={`block rounded-lg border border-gray-100 bg-gray-50 px-2 py-1.5 hover:bg-gray-100 transition-colors ${item.discontinued ? "opacity-60" : ""}`}>
      <p className={`truncate text-xs font-medium text-gray-800 ${item.discontinued ? "line-through" : ""}`}>
        {MEDIA_TYPE_EMOJI[item.mediaType] ?? "📄"} {item.title}
      </p>
      <p className="truncate text-[11px] text-gray-500">
        {details.join(" · ")}{item.cinema ? " · 🎟️ Kino" : ""}{item.withChild ? " · 👶 Z dzieckiem" : ""}
      </p>
      {item.tagList && item.tagList.length > 0 && (
        <p className="truncate text-[10px] text-gray-400">{item.tagList.map((tag) => `#${tag.name}`).join(" ")}</p>
      )}
    </a>
  );
}

export default function Statistics({ items, year }: Props) {
  const [selectedMonth, setSelectedMonth] = useState<number | null>(null);

  const filtered = useMemo(() => {
    if (selectedMonth === null) return items;
    return items.filter((item) => mediaOverlapsMonth(item, year, selectedMonth));
  }, [items, year, selectedMonth]);

  const grouped = useMemo(() => groupByTitle(filtered), [filtered]);
  const books = grouped.filter((item) => BOOK_TYPES.includes(item.mediaType));
  const movies = grouped.filter((item) => MOVIE_TYPES.includes(item.mediaType));
  const series = grouped.filter((item) => SERIES_TYPES.includes(item.mediaType));
  const anime = grouped.filter((item) => ANIME_TYPES.includes(item.mediaType));
  const plays = grouped.filter((item) => item.mediaType === "play");
  const games = grouped.filter((item) => item.mediaType === "game");
  const podcasts = grouped.filter((item) => item.mediaType === "podcast");
  const records = grouped.filter((item) => item.mediaType === "record");
  const cinemaMovies = movies.filter((item) => item.cinema);
  const sections = [
    ["📚 Przeczytane", books],
    ["🎬 Filmy", movies],
    ["📺 Seriale", series],
    ["🎌 Anime", anime],
    ["🎭 Sztuki teatralne", plays],
    ["🎮 Gry", games],
    ["🎙️ Podcasty", podcasts],
    ["🎵 Płyty", records],
  ] as const;
  const counters = [
    { label: "Książek", count: books.length, always: true },
    { label: "Filmów", count: movies.length, always: true },
    { label: "Seriali", count: series.length, always: true },
    { label: "🎟️ Kino", count: cinemaMovies.length },
    { label: "🎭 Teatr", count: plays.length },
    { label: "🎮 Gier", count: games.length },
    { label: "🎙️ Podcastów", count: podcasts.length },
    { label: "🎵 Płyt", count: records.length },
  ];

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
        {MONTH_NAMES.map((name, index) => (
          <button
            key={name}
            onClick={() => setSelectedMonth(index === selectedMonth ? null : index)}
            className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${selectedMonth === index ? "bg-gray-900 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}
          >
            {name.slice(0, 3)}
          </button>
        ))}
      </div>

      <div className="flex flex-wrap gap-2 mb-4">
        {counters.filter(({ count, always }) => always || count > 0).map(({ label, count }) => (
          <div key={label} className="flex-1 min-w-[70px] bg-gray-50 rounded-xl px-2 py-2 text-center">
            <div className="text-xl font-bold text-gray-900">{count}</div>
            <div className="text-xs text-gray-500">{label}</div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {sections.filter(([, sectionItems]) => sectionItems.length > 0).map(([title, sectionItems]) => (
          <section key={title}>
            <h4 className="text-sm font-semibold text-gray-700 mb-2">{title}</h4>
            <div className="space-y-1.5">
              {sectionItems.map((item) => <StatisticsItem key={`${item.mediaType}-${item.id}`} item={item} />)}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
