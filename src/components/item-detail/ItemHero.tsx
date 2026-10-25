import type { ReactNode } from "react";
import CoverImg from "../CoverImg";
import type { CachedData, MediaData } from "./types";

/** Cover, title, people, year, status, rating, description, genres, track list and tags; `children` go at the end. */
export default function ItemHero({ media, cachedData, onOpenPerson, children }: {
  media: MediaData;
  cachedData: CachedData | null;
  onOpenPerson?: (personId: number) => void;
  children?: ReactNode;
}) {
  const directors =
    cachedData?.persons.filter((p) => p.role === "director" || p.role === "creator") ?? [];
  const authorPersons = cachedData?.persons.filter((p) => p.role === "author") ?? [];

  const displayAuthor =
    media.author ||
    (directors.length > 0 ? directors.map((d) => d.name).join(", ") : null) ||
    (authorPersons.length > 0 ? authorPersons.map((a) => a.name).join(", ") : null);

  const releaseYear = cachedData?.releaseYear ?? media.release_year;
  const voteAverage = cachedData?.voteAverage ?? media.vote_average;
  const description = cachedData?.description ?? media.description;
  const genres =
    cachedData?.genres ??
    (media.genres
      ? media.genres
          .split(",")
          .map((g) => g.trim())
          .filter(Boolean)
      : []);

  return (
    <div className="flex gap-5">
      {media.cover_url && (
        <div className="shrink-0">
          <CoverImg
            src={media.cover_url}
            alt={media.title}
            width={120}
            height={180}
            className="rounded-xl object-cover shadow-md max-w-[160px]"
          />
        </div>
      )}
      <div className="flex-1 min-w-0 space-y-2">
        <h2 className="text-xl font-bold text-gray-900 leading-tight">{media.title}</h2>
        {media.original_title && media.original_title !== media.title && (
          <p className="text-sm text-gray-400">{media.original_title}</p>
        )}
        {(directors.length > 0 || authorPersons.length > 0) ? (
          <p className="text-sm text-gray-600 font-medium flex flex-wrap gap-1">
            {[...directors, ...authorPersons].map((p, i) => {
              const total = directors.length + authorPersons.length;
              return (
                <button
                  key={p.personId}
                  onClick={() => onOpenPerson?.(p.personId)}
                  className="hover:text-blue-600 hover:underline transition-colors"
                >
                  {p.name}{i < total - 1 ? "," : ""}
                </button>
              );
            })}
          </p>
        ) : displayAuthor ? (
          <p className="text-sm text-gray-600 font-medium">{displayAuthor}</p>
        ) : null}
        {releaseYear && <p className="text-sm text-gray-500">{releaseYear}</p>}
        {media.series_status && (
          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${
            media.series_status === "Ended" || media.series_status === "Canceled"
              ? "bg-gray-100 text-gray-600"
              : "bg-green-100 text-green-700"
          }`}>
            {media.series_status === "Ended" ? "🔴 Zakończony"
              : media.series_status === "Canceled" ? "🔴 Anulowany"
              : media.series_status === "Returning Series" ? "🟢 Trwający"
              : media.series_status === "In Production" ? "🟡 W produkcji"
              : media.series_status}
          </span>
        )}
        {voteAverage != null && (
          <p className="text-sm text-yellow-600 font-medium">★ {voteAverage.toFixed(1)}</p>
        )}
        {description && (
          <p className="text-sm text-gray-600 leading-relaxed line-clamp-5">{description}</p>
        )}
        {genres.length > 0 && (
          <div className="flex flex-wrap gap-1.5 pt-1">
            {genres.map((g) => (
              <span key={g} className="px-2 py-0.5 bg-gray-100 text-gray-600 rounded-full text-xs">
                {g}
              </span>
            ))}
          </div>
        )}
        {cachedData?.runtime != null && (
          <p className="text-xs text-gray-500">
            ⏱ {Math.floor(cachedData.runtime / 60)}h {cachedData.runtime % 60}m
          </p>
        )}
        {cachedData?.trackList && cachedData.trackList.length > 0 && (
          <div className="mt-3">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
              Lista utworów ({cachedData.trackList.length})
            </p>
            <ol className="space-y-0.5">
              {cachedData.trackList.map((t) => (
                <li key={t.number} className="flex items-center gap-2 text-xs text-gray-700">
                  <span className="w-5 text-right text-gray-400 shrink-0">{t.number}.</span>
                  <span className="flex-1">{t.title}</span>
                  {t.duration_ms != null && (
                    <span className="text-gray-400 shrink-0">
                      {Math.floor(t.duration_ms / 60000)}:{String(Math.floor((t.duration_ms % 60000) / 1000)).padStart(2, "0")}
                    </span>
                  )}
                </li>
              ))}
            </ol>
          </div>
        )}
        {media.tagList && media.tagList.length > 0 && (
          <div className="flex flex-wrap gap-1 pt-1">
            {media.tagList.map((t) => (
              <span
                key={t.id}
                className="px-1.5 py-0.5 bg-blue-50 text-blue-700 rounded text-[10px] font-medium"
              >
                #{t.name}
              </span>
            ))}
          </div>
        )}

        {children}
      </div>
    </div>
  );
}
