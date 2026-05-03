"use client";
import { useMemo, useState } from "react";
import Image from "next/image";
import CoverImg from "./CoverImg";
import { MEDIA_TYPE_LABELS, MEDIA_TYPE_COLORS, MEDIA_TYPE_ICONS, formatDate } from "@/lib/utils";
import type { SessionRow } from "@/lib/types";

interface Props {
  items: SessionRow[];
  onItemClick?: (session: SessionRow) => void;
}

export default function MediaList({ items, onItemClick }: Props) {
  const [hoveredMediaId, setHoveredMediaId] = useState<number | null>(null);

  const grouped = useMemo(() => {
    const sorted = [...items].sort((a, b) => b.startDate.localeCompare(a.startDate));
    const groups = new Map<string, { label: string; items: SessionRow[] }>();
    for (const item of sorted) {
      const [year, month] = item.startDate.split("-");
      const key = `${year}-${month}`;
      const label = new Date(parseInt(year), parseInt(month) - 1, 1)
        .toLocaleDateString("pl-PL", { month: "long", year: "numeric" });
      if (!groups.has(key)) groups.set(key, { label: label.charAt(0).toUpperCase() + label.slice(1), items: [] });
      groups.get(key)!.items.push(item);
    }
    return [...groups.values()];
  }, [items]);

  return (
    <div className="bg-white rounded-2xl shadow border border-gray-100">
      <div className="p-4 border-b border-gray-100">
        <h3 className="text-lg font-semibold text-gray-900">Lista ({items.length})</h3>
      </div>
      <div
        className="divide-y divide-gray-100"
        onMouseLeave={() => setHoveredMediaId(null)}
      >
        {grouped.map(({ label, items: groupItems }) => (
          <div key={label}>
            <div className="px-4 py-2 bg-gray-50 border-b border-gray-100 sticky top-0 z-10">
              <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">{label}</h4>
            </div>
            {groupItems.map((item) => {
              const coverSrc = item.seasonCoverUrl ?? item.mediaCoverUrl;
              const typeIcon = MEDIA_TYPE_ICONS[item.mediaType];
              const typeColor = MEDIA_TYPE_COLORS[item.mediaType] || "bg-gray-100 text-gray-700";

              const isHighlighted = hoveredMediaId === item.mediaId;
              const isDimmed = hoveredMediaId !== null && !isHighlighted;

              return (
                <div
                  key={item.id}
                  className="p-4 transition-all duration-100"
                  style={{
                    backgroundColor: isHighlighted ? "#dbeafe" : undefined,
                    opacity: isDimmed ? 0.35 : 1,
                    borderLeft: isHighlighted ? "3px solid #3b82f6" : "3px solid transparent",
                  }}
                  onMouseEnter={() => setHoveredMediaId(item.mediaId)}
                >
                  <div className="flex items-start gap-3">
                    {coverSrc ? (
                      <div
                        className="relative w-10 h-14 shrink-0 rounded overflow-hidden border border-gray-200 cursor-pointer"
                        onClick={() => onItemClick?.(item)}
                      >
                        <CoverImg src={coverSrc} alt={item.mediaTitle} fill className="object-cover" sizes="40px" />
                      </div>
                    ) : null}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            {/* Type badge */}
                            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${typeColor}`}>
                              {typeIcon && (
                                <Image src={typeIcon} alt="" width={12} height={12} className="object-contain" />
                              )}
                              {MEDIA_TYPE_LABELS[item.mediaType] || item.mediaType}
                            </span>
                            {/* Season badge */}
                            {item.seasonNumber != null && (
                              <span className="px-1.5 py-0.5 bg-indigo-100 text-indigo-700 rounded text-xs font-medium">
                                S{item.seasonNumber}
                              </span>
                            )}
                            <span
                              className={`font-medium text-gray-900 ${item.discontinued ? "line-through opacity-60" : ""} ${onItemClick ? "cursor-pointer hover:text-blue-600" : ""}`}
                              onClick={() => onItemClick?.(item)}
                            >
                              {item.mediaTitle}
                            </span>
                            {/* Cinema badge */}
                            {item.cinema ? (
                              <span className="px-1.5 py-0.5 bg-yellow-100 text-yellow-700 rounded text-xs">🎬 Kino</span>
                            ) : null}
                            {/* Discontinued badge */}
                            {item.discontinued ? (
                              <span className="text-xs text-red-500 font-medium">Porzucone</span>
                            ) : null}
                          </div>
                          {item.mediaOriginalTitle && item.mediaOriginalTitle !== item.mediaTitle && (
                            <div className="text-xs text-gray-400 mt-0.5 italic">{item.mediaOriginalTitle}</div>
                          )}
                          {item.author && <div className="text-sm text-gray-500 mt-0.5">{item.author}</div>}
                          {item.universeName && (
                            <div className="text-xs text-gray-400 mt-0.5">🌐 {item.universeName}</div>
                          )}
                          <div className="text-xs text-gray-400 mt-1">
                            {formatDate(item.startDate)}
                            {item.endDate ? ` – ${formatDate(item.endDate)}` : " – W trakcie"}
                          </div>
                          {item.tagList && item.tagList.length > 0 && (
                            <div className="flex flex-wrap gap-1 mt-1">
                              {item.tagList.map((tag) => (
                                <span key={tag.id} className="px-1.5 py-0.5 bg-gray-100 text-gray-600 rounded text-xs">
                                  {tag.name}
                                </span>
                              ))}
                            </div>
                          )}
                          {!item.tagList && item.tags && (
                            <div className="flex flex-wrap gap-1 mt-1">
                              {item.tags.split(",").map((t, i) => (
                                <span key={i} className="px-1.5 py-0.5 bg-gray-100 text-gray-600 rounded text-xs">
                                  {t.trim()}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                        {/* Edit button */}
                        <div className="flex gap-1 shrink-0 items-start">
                          <button
                            onClick={() => onItemClick?.(item)}
                            className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
                            title="Edytuj sesję"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                            </svg>
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ))}
        {items.length === 0 && (
          <div className="p-8 text-center">
            <Image src="/icons/icons8-nothing-found-96.png" alt="Brak wpisów" width={48} height={48} className="mx-auto mb-2 opacity-40" />
            <p className="text-gray-400 text-sm">Brak wpisów dla tego roku</p>
          </div>
        )}
      </div>
    </div>
  );
}
