"use client";
import { useEffect, useState, useMemo } from "react";
import Image from "next/image";
import { MEDIA_TYPE_LABELS, MEDIA_TYPE_COLORS } from "@/lib/utils";

interface MediaItem {
  id: number;
  title: string;
  author: string | null;
  mediaType: string;
  startDate: string;
  coverUrl: string | null;
}

interface AuthorGroup {
  author: string;
  items: MediaItem[];
}

const MEDIA_TYPE_EMOJI: Record<string, string> = {
  book: "📖", comic: "📰", movie: "🎬", series: "📺", anime: "🎌", cartoon: "🎨",
};

export default function AuthorView() {
  const [allItems, setAllItems] = useState<MediaItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [expandedAuthors, setExpandedAuthors] = useState<Set<string>>(new Set());

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/media?all=true");
        const data = await res.json();
        setAllItems(data);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const groups = useMemo<AuthorGroup[]>(() => {
    const filtered = search.trim()
      ? allItems.filter((i) =>
          (i.author ?? "Bez autora").toLowerCase().includes(search.toLowerCase())
        )
      : allItems;

    const map = new Map<string, MediaItem[]>();
    for (const item of filtered) {
      const key = item.author?.trim() || "Bez autora";
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(item);
    }

    return [...map.entries()]
      .map(([author, items]) => ({ author, items: items.sort((a, b) => b.startDate.localeCompare(a.startDate)) }))
      .sort((a, b) => {
        if (a.author === "Bez autora") return 1;
        if (b.author === "Bez autora") return -1;
        return a.author.localeCompare(b.author, "pl");
      });
  }, [allItems, search]);

  const toggleExpand = (author: string) => {
    setExpandedAuthors((prev) => {
      const next = new Set(prev);
      if (next.has(author)) next.delete(author);
      else next.add(author);
      return next;
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="bg-white/10 backdrop-blur rounded-xl p-4">
        <input
          type="text"
          placeholder="Szukaj autora..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full border border-white/30 bg-white/20 rounded-lg px-4 py-2 text-white placeholder-white/60 focus:ring-2 focus:ring-white/50 focus:outline-none text-sm"
        />
      </div>

      {groups.length === 0 && (
        <div className="bg-white/10 backdrop-blur rounded-xl p-12 text-center">
          <p className="text-white/80">Brak wyników</p>
        </div>
      )}

      <div className="space-y-4">
        {groups.map(({ author, items }) => {
          const expanded = expandedAuthors.has(author);
          const visible = expanded ? items : items.slice(0, 5);
          return (
            <div key={author} className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <h3 className="font-semibold text-gray-900">{author}</h3>
                  <span className="bg-purple-100 text-purple-700 text-xs px-2 py-0.5 rounded-full font-medium">
                    {items.length}
                  </span>
                </div>
              </div>
              <div className="flex flex-wrap gap-3">
                {visible.map((item) => (
                  <div key={item.id} className="flex flex-col items-center gap-1 w-16" title={item.title}>
                    {item.coverUrl ? (
                      <div className="relative w-12 h-16 rounded overflow-hidden border border-gray-200 shrink-0">
                        <Image src={item.coverUrl} alt={item.title} fill className="object-cover" sizes="48px" />
                      </div>
                    ) : (
                      <div className={`w-12 h-16 rounded flex items-center justify-center text-xl text-white ${MEDIA_TYPE_COLORS[item.mediaType] || "bg-gray-400"}`}>
                        {MEDIA_TYPE_EMOJI[item.mediaType] ?? "📄"}
                      </div>
                    )}
                    <span className="text-xs text-gray-600 text-center leading-tight line-clamp-2 w-full">
                      {item.title}
                    </span>
                    <span className={`text-xs px-1 py-0.5 rounded text-white ${MEDIA_TYPE_COLORS[item.mediaType] || "bg-gray-400"}`}>
                      {MEDIA_TYPE_LABELS[item.mediaType] ?? item.mediaType}
                    </span>
                  </div>
                ))}
              </div>
              {items.length > 5 && (
                <button
                  onClick={() => toggleExpand(author)}
                  className="mt-3 text-sm text-purple-600 hover:text-purple-800 font-medium"
                >
                  {expanded ? "Pokaż mniej" : `Pokaż więcej (${items.length - 5} więcej)`}
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
