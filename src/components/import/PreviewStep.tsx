"use client";
import Image from "next/image";
import { MEDIA_TYPE_LABELS, isYearPlaceholder } from "./types";
import type { ImportType, MediaPreviewRow, PreviewResponse, TmdbFetchState, ValidItem, WishlistPreviewRow } from "./types";

interface PreviewStepProps {
  preview: PreviewResponse;
  editedItems: ValidItem[];
  selected: Set<number>;
  importType: ImportType;
  onToggleSelect: (row: number) => void;
  onToggleAll: () => void;
  onUpdateField: (row: number, field: string, value: string) => void;
  onImport: () => void;
  onBack: () => void;
  selectedCount: number;
  loading: boolean;
  yearPlaceholderCount: number;
  showOnlyYearPlaceholders: boolean;
  onToggleYearFilter: () => void;
  tmdbStates: Record<number, TmdbFetchState>;
  onFetchTmdb: (row: number, title: string, season: string, tmdbId?: number, originalTitle?: string) => void;
  onPickTmdbCandidate: (row: number, title: string, season: string, tmdbId: number, originalTitle?: string) => void;
}

export default function PreviewStep({
  preview, editedItems, selected, importType,
  onToggleSelect, onToggleAll, onUpdateField, onImport, onBack, selectedCount, loading,
  yearPlaceholderCount, showOnlyYearPlaceholders, onToggleYearFilter,
  tmdbStates, onFetchTmdb, onPickTmdbCandidate,
}: PreviewStepProps) {
  const visibleItems = showOnlyYearPlaceholders ? editedItems.filter(isYearPlaceholder) : editedItems;
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <p className="text-sm text-gray-700">
          <span className="font-medium">{preview.total} wierszy</span> —{" "}
          <span className="text-green-600 font-medium">{preview.valid.length} poprawnych</span>
          {preview.invalid.length > 0 && (
            <span className="text-red-500 font-medium">, {preview.invalid.length} błędnych</span>
          )}
          {yearPlaceholderCount > 0 && importType === "media" && (
            <span className="text-amber-600 font-medium">, {yearPlaceholderCount} z rokiem zamiast datą ⚠️</span>
          )}
        </p>
        <div className="flex items-center gap-2">
          {yearPlaceholderCount > 0 && importType === "media" && (
            <button
              onClick={onToggleYearFilter}
              className={`text-xs px-3 py-1 rounded-full border font-medium transition-colors ${showOnlyYearPlaceholders ? "bg-amber-100 border-amber-400 text-amber-800" : "bg-white border-gray-300 text-gray-600 hover:border-amber-400"}`}
            >
              ⚠️ {showOnlyYearPlaceholders ? `Pokaż wszystkie` : `Pokaż tylko rok-placeholdery (${yearPlaceholderCount})`}
            </button>
          )}
          <button onClick={onBack} className="text-sm text-gray-500 hover:text-gray-700 underline">
            ← Wróć
          </button>
        </div>
      </div>

      {/* Valid rows table */}
      {editedItems.length > 0 && (
        <div className="overflow-x-auto rounded-lg border border-gray-200">
          <table className="w-full text-xs">
            <thead className="bg-gray-50">
              <tr>
                <th className="p-2 text-left">
                  <input type="checkbox" checked={selected.size === editedItems.length} onChange={onToggleAll} className="rounded text-purple-600" />
                </th>
                <th className="p-2 text-left font-medium text-gray-700">Tytuł</th>
                <th className="p-2 text-left font-medium text-gray-700">Autor</th>
                <th className="p-2 text-left font-medium text-gray-700">Typ</th>
                {importType === "media" && (
                  <>
                    <th className="p-2 text-left font-medium text-gray-700">Data pocz.</th>
                    <th className="p-2 text-left font-medium text-gray-700">Data końc.</th>
                    <th className="p-2 text-left font-medium text-gray-700">Sezon</th>
                    <th className="p-2 text-left font-medium text-gray-700">TMDB</th>
                  </>
                )}
                {importType === "wishlist" && (
                  <th className="p-2 text-left font-medium text-gray-700">Priorytet</th>
                )}
              </tr>
            </thead>
            <tbody>
              {visibleItems.map((item) => {
                const placeholder = isYearPlaceholder(item);
                return (
                <tr key={item.row} className={`border-t border-gray-100 ${placeholder ? "bg-amber-50" : selected.has(item.row) ? "bg-white" : "bg-gray-50 opacity-60"}`}>
                  <td className="p-2">
                    <input type="checkbox" checked={selected.has(item.row)} onChange={() => onToggleSelect(item.row)} className="rounded text-purple-600" />
                  </td>
                  <td className="p-1">
                    <input
                      type="text"
                      value={(item.data as MediaPreviewRow | WishlistPreviewRow).title}
                      onChange={(e) => onUpdateField(item.row, "title", e.target.value)}
                      className="w-full border border-gray-200 rounded px-1.5 py-0.5 text-xs min-w-[120px]"
                    />
                  </td>
                  <td className="p-1">
                    <input
                      type="text"
                      value={(item.data as MediaPreviewRow | WishlistPreviewRow).author}
                      onChange={(e) => onUpdateField(item.row, "author", e.target.value)}
                      className="w-full border border-gray-200 rounded px-1.5 py-0.5 text-xs min-w-[100px]"
                    />
                  </td>
                  <td className="p-2 text-gray-700">
                    {MEDIA_TYPE_LABELS[(item.data as MediaPreviewRow).media_type] ?? (item.data as MediaPreviewRow).media_type}
                  </td>
                  {importType === "media" && (() => {
                    const mediaData = item.data as MediaPreviewRow;
                    const isSeries = mediaData.media_type === "series" || mediaData.media_type === "anime";
                    const tmdbState = tmdbStates[item.row] ?? { status: "idle" };
                    return (
                    <>
                      <td className="p-1">
                        <input
                          type="date"
                          value={mediaData.start_date}
                          onChange={(e) => onUpdateField(item.row, "start_date", e.target.value)}
                          className={`border rounded px-1.5 py-0.5 text-xs ${placeholder ? "border-amber-400 bg-amber-50" : "border-gray-200"}`}
                        />
                      </td>
                      <td className="p-1">
                        <div className="flex items-center gap-1">
                          {placeholder && <span title="Rok zamiast daty">⚠️</span>}
                          <input
                            type="date"
                            value={mediaData.end_date}
                            onChange={(e) => onUpdateField(item.row, "end_date", e.target.value)}
                            className={`border rounded px-1.5 py-0.5 text-xs ${placeholder ? "border-amber-400 bg-amber-50" : "border-gray-200"}`}
                          />
                        </div>
                      </td>
                      <td className="p-1">
                        <input
                          type="text"
                          value={mediaData.volume_episode ?? ""}
                          onChange={(e) => onUpdateField(item.row, "volume_episode", e.target.value)}
                          placeholder="np. 2"
                          className="border border-gray-200 rounded px-1.5 py-0.5 text-xs w-14"
                        />
                      </td>
                      <td className="p-1 min-w-[120px]">
                        {isSeries && (
                          <div className="space-y-1">
                            {tmdbState.status === "idle" && (
                              <button
                                onClick={() => onFetchTmdb(item.row, mediaData.title, mediaData.volume_episode || "1", undefined, mediaData.original_title || undefined)}
                                className="text-xs bg-blue-50 hover:bg-blue-100 border border-blue-200 text-blue-700 px-2 py-0.5 rounded transition-colors"
                                title="Pobierz daty emisji z TMDB"
                              >
                                🎬 Pobierz daty
                              </button>
                            )}
                            {tmdbState.status === "loading" && (
                              <span className="text-xs text-gray-500 animate-pulse">⏳ Szukam…</span>
                            )}
                            {tmdbState.status === "done" && (
                              <div className="flex items-center gap-1">
                                <span className="text-xs text-green-600" title={`${tmdbState.show_name} — ${tmdbState.episode_count} odc.`}>✅ {tmdbState.episode_count} odc.</span>
                                <button onClick={() => onFetchTmdb(item.row, mediaData.title, mediaData.volume_episode || "1", undefined, mediaData.original_title || undefined)} className="text-xs text-gray-400 hover:text-gray-600">↺</button>
                              </div>
                            )}
                            {tmdbState.status === "error" && (
                              <div className="flex items-center gap-1">
                                <span className="text-xs text-red-500" title={tmdbState.message}>❌</span>
                                <button onClick={() => onFetchTmdb(item.row, mediaData.title, mediaData.volume_episode || "1", undefined, mediaData.original_title || undefined)} className="text-xs text-gray-400 hover:text-gray-600">↺</button>
                              </div>
                            )}
                            {tmdbState.status === "candidates" && (
                              <div className="space-y-1">
                                <p className="text-xs text-gray-500">Wybierz serial:</p>
                                {tmdbState.candidates.map((c) => (
                                  <button
                                    key={c.tmdb_id}
                                    onClick={() => onPickTmdbCandidate(item.row, mediaData.title, mediaData.volume_episode || "1", c.tmdb_id, mediaData.original_title || undefined)}
                                    className="flex items-center gap-1 text-left text-xs bg-white hover:bg-blue-50 border border-gray-200 rounded px-1.5 py-0.5 w-full transition-colors"
                                  >
                                    {c.poster_path && <Image unoptimized src={c.poster_path} alt="" width={20} height={28} className="w-5 h-7 object-cover rounded flex-shrink-0" />}
                                    <span className="truncate">{c.name} <span className="text-gray-400">{c.first_air_date?.slice(0, 4)}</span></span>
                                  </button>
                                ))}
                              </div>
                            )}
                          </div>
                        )}
                      </td>
                    </>
                    );
                  })()}
                  {importType === "wishlist" && (
                    <td className="p-2 text-gray-700">
                      {(item.data as WishlistPreviewRow).priority}
                    </td>
                  )}
                </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Invalid rows */}
      {preview.invalid.length > 0 && (
        <div className="space-y-2">
          <p className="text-sm font-medium text-red-600">Błędne wiersze (pominięte):</p>
          {preview.invalid.map((inv) => (
            <div key={inv.row} className="bg-red-50 border border-red-200 rounded-lg p-3 text-xs">
              <span className="font-medium text-red-700">Wiersz {inv.row}:</span>{" "}
              <span className="text-red-600">{inv.error}</span>
              <div className="font-mono text-gray-500 mt-1 truncate">{inv.raw}</div>
            </div>
          ))}
        </div>
      )}

      <div className="flex gap-3 pt-2">
        <button
          onClick={onImport}
          disabled={loading || selectedCount === 0}
          className="bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white px-6 py-2 rounded-lg text-sm font-medium transition-colors"
        >
          {loading ? "Importuję..." : `Importuj zaznaczone (${selectedCount})`}
        </button>
        <button onClick={onBack} className="bg-gray-200 hover:bg-gray-300 text-gray-700 px-6 py-2 rounded-lg text-sm font-medium transition-colors">
          Anuluj
        </button>
      </div>
    </div>
  );
}
