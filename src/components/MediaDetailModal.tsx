"use client";
import { useEffect, useState } from "react";
import Image from "next/image";
import {
  formatDate,
  MEDIA_TYPE_LABELS,
  MEDIA_TYPE_COLORS,
  MEDIA_TYPE_ICONS,
  formatDateTime,
} from "@/lib/utils";
import { toast } from "./Toast";
import MediaForm from "./MediaForm";
import type { TmdbInfoResult } from "@/app/api/tmdb/info/route";

interface MediaItem {
  id: number;
  title: string;
  originalTitle: string | null;
  author: string | null;
  mediaType: string;
  startDate: string;
  endDate: string | null;
  volumeEpisode: string | null;
  tags: string | null;
  discontinued: boolean | null;
  coverUrl: string | null;
  cinema?: boolean | number | null;
  additionalSessions?: string | null;
  tagList?: { id: number; name: string }[];
  tmdbId?: number | null;
  olKey?: string | null;
  externalSyncedAt?: string | null;
  description?: string | null;
  genres?: string | null;
  voteAverage?: number | null;
  runtime?: number | null;
  releaseYear?: number | null;
}

interface Props {
  item: MediaItem;
  onClose: () => void;
  onRefresh: () => void;
}

type TmdbCandidate = {
  tmdb_id: number;
  name: string;
  first_air_date: string;
  poster_path: string | null;
};

type ExternalState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "tmdb_candidates"; candidates: TmdbCandidate[] }
  | { status: "tmdb_done"; data: TmdbInfoResult }
  | { status: "error"; message: string };

function parseSessions(additionalSessions?: string | null) {
  try {
    if (!additionalSessions) return [];
    return JSON.parse(additionalSessions) as Array<{ start_date: string; end_date: string }>;
  } catch {
    return [];
  }
}

type CachedData = {
  tmdbId: number | null;
  olKey: string | null;
  externalSyncedAt: string | null;
  description: string | null;
  genres: string[];
  voteAverage: number | null;
  runtime: number | null;
  releaseYear: number | null;
  persons: Array<{
    personId: number;
    name: string;
    photoUrl: string | null;
    role: string;
    characterName: string | null;
    displayOrder: number;
  }>;
};

export default function MediaDetailModal({ item, onClose, onRefresh }: Props) {
  const [externalState, setExternalState] = useState<ExternalState>({ status: "idle" });
  const [showEdit, setShowEdit] = useState(false);
  const [cachedData, setCachedData] = useState<CachedData | null>(null);
  const [manualTmdbId, setManualTmdbId] = useState("");
  const [forceRefetch, setForceRefetch] = useState(false);

  const isTmdb = ["series", "anime", "movie", "cartoon"].includes(item.mediaType);

  const buildPersons = (data: TmdbInfoResult) => {
    const result: Array<{
      name: string;
      role: string;
      character_name?: string;
      display_order?: number;
      photo_url?: string | null;
      tmdb_id?: number | null;
    }> = [];
    if ("cast" in data) {
      result.push(
        ...data.cast.map((c, i) => ({
          name: c.name,
          role: "actor",
          character_name: c.character,
          display_order: i,
          photo_url: c.profile_path,
        }))
      );
    }
    if ("director" in data && data.director) {
      result.push({ name: data.director, role: "director", display_order: 0 });
    }
    if ("created_by" in data && data.created_by) {
      result.push(
        ...data.created_by.map((c, i) => ({ name: c.name, role: "creator", display_order: i }))
      );
    }
    return result;
  };

  const saveExternalData = async (
    data: TmdbInfoResult,
    mediaId: number
  ) => {
    const isTvData = "first_air_date" in data;
    const dateStr = data.release_date ?? data.first_air_date;
    const releaseYear = dateStr ? parseInt(dateStr.slice(0, 4)) || null : null;

    const body = {
      tmdb_id: data.tmdb_id,
      ol_key: null,
      description: data.overview,
      genres: data.genres,
      vote_average: data.vote_average,
      runtime: !isTvData ? data.runtime : null,
      release_year: releaseYear,
      persons: buildPersons(data),
    };

    await fetch(`/api/media/${mediaId}/external`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    const res = await fetch(`/api/media/${mediaId}/external`);
    if (res.ok) setCachedData(await res.json());

    // Download cover to local storage if not already local
    const posterUrl = "poster_url" in data ? data.poster_url : null;
    if (posterUrl && !item.coverUrl?.startsWith("/covers/")) {
      try {
        const dlRes = await fetch("/api/cover/download", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ url: posterUrl }),
        });
        if (dlRes.ok) {
          const { path } = await dlRes.json();
          await fetch(`/api/media/${item.id}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              title: item.title,
              original_title: item.originalTitle ?? "",
              author: item.author ?? "",
              media_type: item.mediaType,
              start_date: item.startDate,
              end_date: item.endDate ?? "",
              volume_episode: item.volumeEpisode ?? "",
              tags: item.tagList?.map((t) => t.name).join(", ") ?? item.tags ?? "",
              discontinued: item.discontinued ?? false,
              cover_url: path,
              cinema: item.cinema ?? false,
              additional_sessions: item.additionalSessions ?? "",
              tmdb_id: item.tmdbId ?? null,
              ol_key: item.olKey ?? null,
            }),
          });
          onRefresh();
        }
      } catch {}
    }
  };

  const fetchTmdb = async (tmdbId?: number) => {
    setExternalState({ status: "loading" });
    try {
      const params = new URLSearchParams({ type: item.mediaType });
      if (tmdbId) {
        params.set("tmdb_id", String(tmdbId));
      } else {
        params.set("title", item.title);
        if (item.originalTitle) params.set("original_title", item.originalTitle);
      }
      const res = await fetch(`/api/tmdb/info?${params}`);
      const data = await res.json();
      if (!res.ok) {
        setExternalState({ status: "error", message: data.error ?? "Błąd TMDB" });
        return;
      }
      if (data.candidates) {
        setExternalState({ status: "tmdb_candidates", candidates: data.candidates });
        return;
      }
      setExternalState({ status: "tmdb_done", data });
      await saveExternalData(data, item.id);
    } catch {
      setExternalState({ status: "error", message: "Błąd sieci" });
    }
  };

  useEffect(() => {
    if (!isTmdb) return;
    const loadExternal = async () => {
      const res = await fetch(`/api/media/${item.id}/external`);
      if (res.ok) {
        const data: CachedData = await res.json();
        if (data.externalSyncedAt && !forceRefetch) {
          setCachedData(data);
          return;
        }
      }
      fetchTmdb();
    };
    loadExternal();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [item.id, forceRefetch]);

  const typeColor = MEDIA_TYPE_COLORS[item.mediaType] || "bg-gray-100 text-gray-700";
  const typeIcon = MEDIA_TYPE_ICONS[item.mediaType];
  const sessions = parseSessions(item.additionalSessions);

  const backdropUrl =
    externalState.status === "tmdb_done" ? externalState.data.backdrop_url : null;

  const externalCoverUrl =
    externalState.status === "tmdb_done"
      ? externalState.data.poster_url
      : null;

  const displayCover = item.coverUrl || externalCoverUrl;

  return (
    <>
      {/* Backdrop overlay */}
      <div
        className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
        onClick={onClose}
      >
        <div
          className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header with optional backdrop */}
          <div className="relative rounded-t-2xl overflow-hidden">
            {backdropUrl && (
              <div className="absolute inset-0">
                <Image
                  src={backdropUrl}
                  alt=""
                  fill
                  className="object-cover opacity-30"
                  sizes="672px"
                />
              </div>
            )}
            <div className={`relative p-5 ${backdropUrl ? "bg-white/70 backdrop-blur-sm" : "bg-white border-b border-gray-100"}`}>
              <div className="flex gap-4 items-start">
                {/* Cover */}
                {displayCover ? (
                  <div className="relative w-20 h-28 shrink-0 rounded-lg overflow-hidden border border-gray-200 shadow">
                    <Image src={displayCover} alt={item.title} fill className="object-cover" sizes="80px" />
                  </div>
                ) : (
                  <div className="w-20 h-28 shrink-0 rounded-lg bg-gray-100 flex items-center justify-center border border-gray-200">
                    {typeIcon && <Image src={typeIcon} alt="" width={32} height={32} className="opacity-40" />}
                  </div>
                )}

                {/* Title area */}
                <div className="flex-1 min-w-0">
                  <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium mb-2 ${typeColor}`}>
                    {typeIcon && <Image src={typeIcon} alt="" width={12} height={12} className="object-contain" />}
                    {MEDIA_TYPE_LABELS[item.mediaType] || item.mediaType}
                  </span>
                  <h2 className="text-xl font-bold text-gray-900 leading-tight">
                    {item.title}
                    {item.volumeEpisode ? ` (s. ${item.volumeEpisode})` : ""}
                  </h2>
                  {item.originalTitle && item.originalTitle !== item.title && (
                    <p className="text-sm text-gray-500 italic mt-0.5">{item.originalTitle}</p>
                  )}
                  {item.author && (
                    <p className="text-sm text-gray-600 mt-1">{item.author}</p>
                  )}
                  {item.discontinued && (
                    <span className="text-xs text-red-500 font-medium mt-1 inline-block">Porzucone</span>
                  )}
                </div>

                {/* Close button */}
                <button
                  onClick={onClose}
                  className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors shrink-0"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>
          </div>

          {/* My data section */}
          <div className="p-5 space-y-4">
            <div>
              <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Moje dane</h3>
              <div className="space-y-2">
                {/* Dates */}
                <div className="flex gap-2 text-sm">
                  <span className="text-gray-500 shrink-0">📅 Sesja 1:</span>
                  <span className="text-gray-800 font-medium">
                    {formatDate(item.startDate)}
                    {item.endDate ? ` – ${formatDate(item.endDate)}` : " – W trakcie"}
                  </span>
                  {item.cinema && (
                    <span className="text-xs bg-yellow-100 text-yellow-800 px-1.5 py-0.5 rounded-full font-medium">🎬 Kino</span>
                  )}
                </div>

                {/* Additional sessions */}
                {sessions.length > 0 && sessions.map((s, i) => (
                  <div key={i} className="flex gap-2 text-sm">
                    <span className="text-gray-500 shrink-0">📅 Sesja {i + 2}:</span>
                    <span className="text-gray-800 font-medium">
                      {formatDate(s.start_date)}
                      {s.end_date && s.end_date !== s.start_date ? ` – ${formatDate(s.end_date)}` : ""}
                    </span>
                  </div>
                ))}

                {/* Tags */}
                {item.tagList && item.tagList.length > 0 && (
                  <div className="flex flex-wrap gap-1 items-center">
                    <span className="text-sm text-gray-500 mr-1">🏷️</span>
                    {item.tagList.map((tag) => (
                      <span key={tag.id} className="px-2 py-0.5 bg-gray-100 text-gray-600 rounded-full text-xs">
                        {tag.name}
                      </span>
                    ))}
                  </div>
                )}

                {/* Notes */}
              </div>
            </div>

            {/* Divider */}
            {isTmdb && (
              <div className="border-t border-gray-100 pt-4">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
                    Dane z TMDB
                  </h3>
                  {cachedData?.externalSyncedAt ? (
                    <button
                      onClick={() => { setCachedData(null); setForceRefetch((f) => !f); }}
                      className="text-xs text-blue-500 hover:text-blue-700 flex items-center gap-1 transition-colors"
                    >
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                      </svg>
                      Odśwież
                    </button>
                  ) : (
                    <button
                      onClick={() => fetchTmdb()}
                      className="text-xs text-blue-500 hover:text-blue-700 flex items-center gap-1 transition-colors"
                      disabled={externalState.status === "loading"}
                    >
                      {externalState.status === "loading" ? (
                        <span className="animate-pulse">Ładowanie…</span>
                      ) : (
                        <>
                          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                          </svg>
                          Odśwież
                        </>
                      )}
                    </button>
                  )}
                </div>

                {/* Cached data display */}
                {cachedData?.externalSyncedAt && (
                  <CachedExternalInfo
                    data={cachedData}
                    isTv={["series", "anime"].includes(item.mediaType)}
                  />
                )}

                {/* Live fetch states (when no cache yet) */}
                {!cachedData?.externalSyncedAt && (
                  <>
                    {/* Candidates picker — TMDB */}
                    {externalState.status === "tmdb_candidates" && (
                      <div className="space-y-2">
                        <p className="text-xs text-gray-500 font-medium">Wybierz tytuł:</p>
                        {externalState.candidates.map((c) => (
                          <button
                            key={c.tmdb_id}
                            onClick={() => fetchTmdb(c.tmdb_id)}
                            className="flex items-center gap-2 text-left text-sm bg-white hover:bg-blue-50 border border-gray-200 rounded-lg px-3 py-2 w-full transition-colors"
                          >
                            {c.poster_path && (
                              <img src={c.poster_path} alt="" className="w-8 h-11 object-cover rounded shrink-0" />
                            )}
                            <div>
                              <div className="font-medium text-gray-800">{c.name}</div>
                              <div className="text-xs text-gray-400">{c.first_air_date?.slice(0, 4)}</div>
                            </div>
                          </button>
                        ))}
                      </div>
                    )}

                    {/* TMDB result (transient, before save confirmation) */}
                    {externalState.status === "tmdb_done" && (
                      <TmdbInfo data={externalState.data} isTv={["series", "anime"].includes(item.mediaType)} />
                    )}

                    {externalState.status === "error" && (
                      <div className="space-y-3">
                        <p className="text-sm text-red-500">{externalState.message}</p>
                        <div className="flex gap-2 items-center">
                            <input
                              type="number"
                              value={manualTmdbId}
                              onChange={(e) => setManualTmdbId(e.target.value)}
                              placeholder="TMDB ID (ręcznie)"
                              className="flex-1 border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:ring-2 focus:ring-gray-400 focus:border-transparent"
                            />
                            <button
                              onClick={() => { if (manualTmdbId) fetchTmdb(parseInt(manualTmdbId)); }}
                              className="px-3 py-1.5 bg-gray-800 text-white rounded-lg text-sm hover:bg-gray-700 transition-colors"
                            >
                              Synchronizuj
                            </button>
                          </div>
                      </div>
                    )}

                    {externalState.status === "idle" && isTmdb && (
                      <div className="flex gap-2 items-center">
                        <input
                          type="number"
                          value={manualTmdbId}
                          onChange={(e) => setManualTmdbId(e.target.value)}
                          placeholder="TMDB ID (ręcznie)"
                          className="flex-1 border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:ring-2 focus:ring-gray-400 focus:border-transparent"
                        />
                        <button
                          onClick={() => { if (manualTmdbId) fetchTmdb(parseInt(manualTmdbId)); }}
                          className="px-3 py-1.5 bg-gray-800 text-white rounded-lg text-sm hover:bg-gray-700 transition-colors"
                        >
                          Synchronizuj
                        </button>
                      </div>
                    )}

                    {externalState.status === "loading" && (
                      <div className="space-y-2">
                        {[1, 2, 3].map((i) => (
                          <div key={i} className="h-4 bg-gray-100 rounded animate-pulse" />
                        ))}
                      </div>
                    )}
                  </>
                )}
              </div>
            )}

            {/* Edit button */}
            <div className="border-t border-gray-100 pt-4 flex justify-end">
              <button
                onClick={() => setShowEdit(true)}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                </svg>
                Edytuj
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Edit form modal on top */}
      {showEdit && (
        <MediaForm
          mode="edit"
          initialData={{
            id: item.id,
            title: item.title,
            original_title: item.originalTitle ?? "",
            author: item.author ?? "",
            media_type: item.mediaType,
            start_date: item.startDate,
            end_date: item.endDate ?? "",
            volume_episode: item.volumeEpisode ?? "",
            tags: item.tagList?.map((t) => t.name).join(", ") ?? item.tags ?? "",
            discontinued: item.discontinued ?? false,
            cover_url: item.coverUrl ?? "",
            additional_sessions: item.additionalSessions ?? "",
            tmdb_id: item.tmdbId ? String(item.tmdbId) : "",
            ol_key: item.olKey ?? "",
          }}
          onSuccess={() => {
            setShowEdit(false);
            toast("Zapisano!", "success");
            onRefresh();
          }}
          onCancel={() => setShowEdit(false)}
        />
      )}
    </>
  );
}

function TmdbInfo({ data, isTv }: { data: TmdbInfoResult; isTv: boolean }) {
  return (
    <div className="space-y-3">
      {/* Rating & genres */}
      <div className="flex flex-wrap items-center gap-2">
        {data.vote_average > 0 && (
          <span className="flex items-center gap-1 text-sm font-semibold text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full">
            ⭐ {data.vote_average.toFixed(1)}
          </span>
        )}
        {data.genres.map((g) => (
          <span key={g} className="px-2 py-0.5 bg-gray-100 text-gray-600 rounded-full text-xs">{g}</span>
        ))}
      </div>

      {/* TV-specific info */}
      {isTv && (
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-gray-600">
          {data.status && <span>Status: <strong>{data.status}</strong></span>}
          {data.first_air_date && <span>Premiera: <strong>{data.first_air_date.slice(0, 4)}</strong></span>}
          {data.number_of_seasons && <span>Sezony: <strong>{data.number_of_seasons}</strong></span>}
          {data.number_of_episodes && <span>Odcinki: <strong>{data.number_of_episodes}</strong></span>}
          {data.created_by && data.created_by.length > 0 && (
            <span>Twórcy: <strong>{data.created_by.map((c) => c.name).join(", ")}</strong></span>
          )}
        </div>
      )}

      {/* Movie-specific info */}
      {!isTv && (
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-gray-600">
          {data.release_date && <span>Premiera: <strong>{data.release_date.slice(0, 4)}</strong></span>}
          {data.runtime && <span>Czas: <strong>{data.runtime} min</strong></span>}
          {data.director && <span>Reżyser: <strong>{data.director}</strong></span>}
        </div>
      )}

      {/* Overview */}
      {data.overview && (
        <p className="text-sm text-gray-700 leading-relaxed">{data.overview}</p>
      )}

      {/* Cast */}
      {data.cast.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Obsada</p>
          <div className="flex flex-wrap gap-2">
            {data.cast.slice(0, 8).map((c, i) => (
              <div key={i} className="flex items-center gap-1.5 bg-gray-50 rounded-lg px-2 py-1 text-xs">
                {c.profile_path ? (
                  <img src={c.profile_path} alt={c.name} className="w-5 h-5 rounded-full object-cover" />
                ) : (
                  <div className="w-5 h-5 rounded-full bg-gray-200" />
                )}
                <div>
                  <div className="font-medium text-gray-800">{c.name}</div>
                  {c.character && <div className="text-gray-400">{c.character}</div>}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function CachedExternalInfo({ data, isTv }: { data: CachedData; isTv: boolean }) {
  const actors = data.persons.filter((p) => p.role === "actor");
  const directors = data.persons.filter((p) => p.role === "director");
  const creators = data.persons.filter((p) => p.role === "creator");
  const authors = data.persons.filter((p) => p.role === "author");

  const formatRuntime = (mins: number) => {
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    return h > 0 ? `${h}h ${m}m` : `${m}m`;
  };

  return (
    <div className="space-y-3">
      {/* Rating & genres */}
      <div className="flex flex-wrap items-center gap-2">
        {data.voteAverage != null && data.voteAverage > 0 && (
          <span className="flex items-center gap-1 text-sm font-semibold text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full">
            ⭐ {data.voteAverage.toFixed(1)}
          </span>
        )}
        {data.releaseYear && (
          <span className="text-sm text-gray-600 bg-gray-100 px-2 py-0.5 rounded-full">{data.releaseYear}</span>
        )}
        {data.runtime && !isTv && (
          <span className="text-sm text-gray-600 bg-gray-100 px-2 py-0.5 rounded-full">
            🕐 {formatRuntime(data.runtime)}
          </span>
        )}
        {data.genres.map((g) => (
          <span key={g} className="px-2 py-0.5 bg-gray-100 text-gray-600 rounded-full text-xs">{g}</span>
        ))}
      </div>

      {/* Description */}
      {data.description && (
        <p className="text-sm text-gray-600 leading-relaxed line-clamp-4">{data.description}</p>
      )}

      {/* Directors / Creators */}
      {directors.length > 0 && (
        <p className="text-sm text-gray-600">
          Reżyser: <strong>{directors.map((p) => p.name).join(", ")}</strong>
        </p>
      )}
      {creators.length > 0 && (
        <p className="text-sm text-gray-600">
          Twórcy: <strong>{creators.map((p) => p.name).join(", ")}</strong>
        </p>
      )}

      {/* Authors (books) */}
      {authors.length > 0 && (
        <p className="text-sm text-gray-600">
          Autor: <strong>{authors.map((p) => p.name).join(", ")}</strong>
        </p>
      )}

      {/* Cast */}
      {actors.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Obsada</p>
          <div className="flex flex-wrap gap-2">
            {actors.slice(0, 8).map((p) => (
              <div key={p.personId} className="flex items-center gap-1.5 bg-gray-50 rounded-lg px-2 py-1 text-xs">
                {p.photoUrl ? (
                  <img src={p.photoUrl} alt={p.name} className="w-5 h-5 rounded-full object-cover" />
                ) : (
                  <div className="w-5 h-5 rounded-full bg-gray-200" />
                )}
                <div>
                  <div className="font-medium text-gray-800">{p.name}</div>
                  {p.characterName && <div className="text-gray-400">{p.characterName}</div>}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Sync timestamp */}
      {data.externalSyncedAt && (
        <p className="text-xs text-gray-400">
          Zsynchronizowano: {formatDateTime(data.externalSyncedAt)}
        </p>
      )}
    </div>
  );
}
