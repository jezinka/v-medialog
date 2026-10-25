import CoverImg from "../CoverImg";
import { MEDIA_TYPE_EMOJI, MEDIA_TYPE_LABELS, formatDate } from "@/lib/utils";
import type { MediaItem, SeasonRow } from "./types";

const seasonLabel = (s: SeasonRow) => {
  if (s.title) return s.title;
  if (s.season_number != null) return `Sezon ${s.season_number}`;
  return `Sezon #${s.id}`;
};

interface MediaRowProps {
  medium: MediaItem;
  isExpanded: boolean;
  isSelected: boolean;
  mediaSeasons: SeasonRow[];
  isLoadingSeasons: boolean;
  toggleSelect: (id: number) => void;
  toggleExpand: (id: number) => void;
  deleteMedia: (medium: MediaItem) => void;
  deleteSeason: (season: SeasonRow) => void;
}

export default function MediaRow({
  medium, isExpanded, isSelected, mediaSeasons, isLoadingSeasons,
  toggleSelect, toggleExpand, deleteMedia, deleteSeason,
}: MediaRowProps) {
  return (
    <div className={`transition-colors ${isSelected ? "bg-red-50" : "bg-white"}`}>
      {/* Medium row */}
      <div className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50">
        <input
          type="checkbox"
          checked={isSelected}
          onChange={() => toggleSelect(medium.id)}
          className="cursor-pointer shrink-0"
        />

        {/* Cover */}
        <div className="w-8 h-10 shrink-0 rounded overflow-hidden bg-gray-100">
          {medium.cover_url ? (
            <CoverImg src={medium.cover_url} alt={medium.title} className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-gray-400 text-lg">
              {MEDIA_TYPE_EMOJI[medium.media_type] ?? "📄"}
            </div>
          )}
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <a
            href={`/media/${medium.id}`}
            className="font-medium text-gray-900 hover:text-purple-700 text-left truncate block max-w-xs"
          >
            {medium.title}
          </a>
          <div className="flex items-center gap-2 text-xs text-gray-500 mt-0.5">
            <span>{MEDIA_TYPE_EMOJI[medium.media_type]} {MEDIA_TYPE_LABELS[medium.media_type] ?? medium.media_type}</span>
            {medium.author && <span>· {medium.author}</span>}
            {medium.last_session_date && (
              <span>· ostatnio {formatDate(medium.last_session_date)}</span>
            )}
            {medium.has_cinema_session && (
              <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 text-amber-700 px-1.5 py-0.5 font-medium">
                🎟️ w kinie
              </span>
            )}
            {medium.has_child_session && (
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 text-emerald-700 px-1.5 py-0.5 font-medium">
                👶 z dzieckiem
              </span>
            )}
            {medium.series_status && (
              <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${
                medium.series_status === "Ended" || medium.series_status === "Canceled"
                  ? "bg-gray-100 text-gray-500"
                  : medium.series_status === "Returning Series"
                  ? "bg-green-100 text-green-700"
                  : "bg-blue-100 text-blue-700"
              }`}>
                {medium.series_status}
                {medium.tmdb_seasons_count != null && ` · ${medium.season_count}/${medium.tmdb_seasons_count} sez.`}
              </span>
            )}
          </div>
        </div>

        {/* Season count + expand */}
        <button
          onClick={() => toggleExpand(medium.id)}
          className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-purple-700 px-2 py-1 rounded hover:bg-purple-50 transition-colors shrink-0"
        >
          <span className="font-mono bg-gray-100 rounded px-1.5 py-0.5 text-gray-700">
            {medium.season_count}
          </span>
          sezon{medium.season_count === 1 ? "" : "y/ów"}
          <span className={`transition-transform ${isExpanded ? "rotate-180" : ""}`}>▾</span>
        </button>

        {/* Delete */}
        <button
          onClick={() => deleteMedia(medium)}
          className="text-red-400 hover:text-red-600 text-sm px-1 shrink-0"
          title="Usuń medium"
        >
          🗑️
        </button>
      </div>

      {/* Expanded seasons */}
      {isExpanded && (
        <div className="bg-gray-50 border-t border-gray-100 px-4 py-3">
          {isLoadingSeasons ? (
            <p className="text-xs text-gray-400 py-2">Ładowanie…</p>
          ) : mediaSeasons.length === 0 ? (
            <p className="text-xs text-gray-400 py-2">Brak sezonów</p>
          ) : (
            <div className="space-y-1.5">
              {mediaSeasons.map((s) => (
                <div key={s.id} className="flex items-center gap-3 bg-white rounded-lg px-3 py-2 border border-gray-100">
                  {/* Mini cover */}
                  <div className="w-6 h-8 shrink-0 rounded overflow-hidden bg-gray-100">
                    {s.cover_url ? (
                      <CoverImg src={s.cover_url} alt={seasonLabel(s)} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full bg-gray-200" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <span className="text-sm font-medium text-gray-800">{seasonLabel(s)}</span>
                    <div className="text-xs text-gray-400 mt-0.5 flex flex-wrap gap-2">
                      <span>{s.session_count} sesji</span>
                      {s.first_session_date && (
                        <span>{formatDate(s.first_session_date)}{s.last_session_date && s.last_session_date !== s.first_session_date ? ` – ${formatDate(s.last_session_date)}` : ""}</span>
                      )}
                      {s.has_cinema_session && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 text-amber-700 px-1.5 py-0.5 font-medium">
                          🎟️ w kinie
                        </span>
                      )}
                      {s.has_child_session && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 text-emerald-700 px-1.5 py-0.5 font-medium">
                          👶 z dzieckiem
                        </span>
                      )}
                    </div>
                  </div>
                  <button
                    onClick={() => deleteSeason(s)}
                    className="text-xs text-red-400 hover:text-red-600 px-1"
                    title="Usuń sezon"
                  >
                    🗑️
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
