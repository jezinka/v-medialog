export const MEDIA_TYPES = ["book", "comic", "movie", "series", "anime", "cartoon", "play", "game", "podcast", "record"] as const;
export type MediaType = typeof MEDIA_TYPES[number];

export const MEDIA_TYPE_LABELS: Record<string, string> = {
  book: "Książka",
  comic: "Komiks",
  movie: "Film",
  series: "Serial",
  anime: "Anime",
  cartoon: "Film animowany",
  play: "Sztuka teatralna",
  game: "Gra",
  podcast: "Podcast",
  record: "Płyta",
};

export const MEDIA_TYPE_COLORS: Record<string, string> = {
  book: "bg-blue-100 text-blue-800",
  comic: "bg-violet-100 text-violet-800",
  movie: "bg-rose-100 text-rose-800",
  series: "bg-orange-100 text-orange-800",
  anime: "bg-pink-100 text-pink-800",
  cartoon: "bg-yellow-100 text-yellow-800",
  play: "bg-teal-100 text-teal-800",
  game: "bg-green-100 text-green-800",
  podcast: "bg-cyan-100 text-cyan-800",
  record: "bg-lime-100 text-lime-800",
};

export const MEDIA_TYPE_EMOJI: Record<string, string> = {
  book: "📚",
  comic: "📖",
  movie: "🎬",
  series: "📺",
  anime: "🎌",
  cartoon: "🎨",
  play: "🎭",
  game: "🎮",
  podcast: "🎙️",
  record: "🎵",
};

export const MEDIA_TYPE_ICONS: Record<string, string> = {
  book: "/icons/icons8-books-96.png",
  comic: "/icons/icons8-literature-96.png",
  movie: "/icons/icons8-movie-96.png",
  series: "/icons/icons8-tv-show-96.png",
  anime: "/icons/icons8-tv-96.png",
  cartoon: "/icons/icons8-comedy-96.png",
  play: "/icons/icons8-comedy-96.png",
  game: "/icons/icons8-nintendo-switch-logo-100.png",
  podcast: "/icons/icons8-cassette-96.png",
  record: "/icons/icons8-music-record-96.png",
};

export const MEDIA_TYPE_HEX: Record<string, string> = {
  book: "#9333ea",
  comic: "#6366f1",
  movie: "#f43f5e",
  series: "#f97316",
  anime: "#ec4899",
  cartoon: "#eab308",
  play: "#14b8a6",
  game: "#16a34a",
  podcast: "#06b6d4",
  record: "#84cc16",
};

export const BOOK_TYPES = ["book", "comic"];
export const SCREEN_TYPES = ["movie", "series", "anime", "cartoon"];
export const ITUNES_TYPES = ["record", "podcast"];
export const CALENDAR_TYPES = ["book", "comic", "movie", "series", "anime", "cartoon"];

export const MONTH_NAMES = [
  "Styczeń", "Luty", "Marzec", "Kwiecień", "Maj", "Czerwiec",
  "Lipiec", "Sierpień", "Wrzesień", "Październik", "Listopad", "Grudzień"
];

export const DAY_LABELS = ["Pn", "Wt", "Śr", "Cz", "Pt", "Sb", "Nd"];

export function isYearPlaceholder(start: string, end: string | null): boolean {
  if (!end) return false;
  return daysBetween(start, end) >= 365;
}

export function daysBetween(start: string, end: string | null): number {
  if (!end) return 1;
  const s = new Date(start);
  const e = new Date(end);
  return Math.ceil((e.getTime() - s.getTime()) / (1000 * 60 * 60 * 24)) + 1;
}

export function isDateInRange(date: string, startDate: string, endDate: string | null): boolean {
  if (!endDate) return date === startDate;
  return date >= startDate && date <= endDate;
}

export function formatDate(dateStr: string): string {
  if (!dateStr) return "";
  const [y, m, d] = dateStr.split("-");
  return `${d}.${m}.${y}`;
}

export function formatDateTime(dateStr: string | null | undefined): string {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yyyy = d.getFullYear();
  const hh = String(d.getHours()).padStart(2, "0");
  const min = String(d.getMinutes()).padStart(2, "0");
  const ss = String(d.getSeconds()).padStart(2, "0");
  return `${dd}.${mm}.${yyyy} ${hh}:${min}:${ss}`;
}
