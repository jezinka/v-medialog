"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { BOOK_TYPES, SCREEN_TYPES, ITUNES_TYPES } from "@/lib/utils";
import type { CachedData, MediaData } from "./types";
import type { TmdbCandidate } from "@/lib/tmdb";
import type { TmdbInfoResult } from "@/app/api/tmdb/info/route";

type ItunesCandidate = { itunes_id: number; title: string; artist: string; year: number | null; cover_url: string | null };
export type ExternalSyncState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "tmdb_candidates"; candidates: TmdbCandidate[] }
  | { status: "itunes_candidates"; candidates: ItunesCandidate[] }
  | { status: "done" }
  | { status: "error"; message: string };

/**
 * Cached external details of the media (loaded once per media) and the TMDB / iTunes sync that refreshes them.
 * `onCoverChange` gets the local path of a cover downloaded during a sync.
 */
export function useExternalData(mediaId: number, media: MediaData | null, onCoverChange: (path: string) => void) {
  const [cachedData, setCachedData] = useState<CachedData | null>(null);
  const [externalSync, setExternalSync] = useState<ExternalSyncState>({ status: "idle" });

  const loadExternalData = useCallback(async (currentMedia?: MediaData | null) => {
    try {
      const res = await fetch(`/api/media/${mediaId}/external`);
      if (res.ok) {
        let data = (await res.json()) as CachedData;
        // Auto-create person record from media.author if not yet linked
        if (data.persons.length === 0 && currentMedia?.author) {
          const role = BOOK_TYPES.includes(currentMedia.media_type) ? "author" : "director";
          await fetch(`/api/media/${mediaId}/external`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              tmdb_id: currentMedia.tmdb_id ?? null,
              ol_key: currentMedia.ol_key ?? null,
              description: null, genres: [], vote_average: null, runtime: null, release_year: null,
              persons: [{ name: currentMedia.author, role, display_order: 0 }],
            }),
          });
          const res2 = await fetch(`/api/media/${mediaId}/external`);
          if (res2.ok) data = (await res2.json()) as CachedData;
        }
        setCachedData(data);
        if (data.externalSyncedAt) setExternalSync({ status: "done" });
      }
    } catch {
      // ignore external data errors
    }
  }, [mediaId]);

  const saveExternalData = useCallback(async (data: TmdbInfoResult) => {
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
      series_status: isTvData ? (data.status ?? null) : null,
      tmdb_seasons_count: isTvData ? (data.number_of_seasons ?? null) : null,
      persons: data.persons,
    };

    await fetch(`/api/media/${mediaId}/external`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const res = await fetch(`/api/media/${mediaId}/external`);
    if (res.ok) {
      const cached = await res.json() as CachedData;
      setCachedData(cached);
      setExternalSync({ status: "done" });
    }

    // Download cover from TMDB
    if (data.poster_url) {
      try {
        const dlRes = await fetch("/api/cover/download", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ url: data.poster_url }),
        });
        if (dlRes.ok) {
          const { path } = await dlRes.json() as { path: string };
          await fetch(`/api/media/${mediaId}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              title: media?.title, original_title: media?.original_title ?? "",
              author: media?.author ?? "", media_type: media?.media_type,
              cover_url: path, tags: media?.tags,
              discontinued: media?.discontinued, tmdb_id: media?.tmdb_id, ol_key: media?.ol_key,
            }),
          });
          onCoverChange(path);
        }
      } catch { /* ignore */ }
    }
  }, [mediaId, media, onCoverChange]);

  const syncFromTmdb = useCallback(async (tmdbId?: number) => {
    if (!media) return;
    setExternalSync({ status: "loading" });
    try {
      const params = new URLSearchParams({ type: media.media_type });
      if (tmdbId) {
        params.set("tmdb_id", String(tmdbId));
      } else if (media.tmdb_id) {
        params.set("tmdb_id", String(media.tmdb_id));
      } else {
        params.set("title", media.title);
        if (media.original_title) params.set("original_title", media.original_title);
      }
      const res = await fetch(`/api/tmdb/info?${params}`);
      const data = await res.json() as { candidates?: TmdbCandidate[] } & TmdbInfoResult;
      if (!res.ok) { setExternalSync({ status: "error", message: (data as unknown as { error: string }).error ?? "Błąd TMDB" }); return; }
      if (data.candidates) { setExternalSync({ status: "tmdb_candidates", candidates: data.candidates }); return; }
      await saveExternalData(data);
    } catch {
      setExternalSync({ status: "error", message: "Błąd sieci" });
    }
  }, [media, saveExternalData]);

  const syncFromItunes = useCallback(async (itunesId?: number, appleMusicUrl?: string) => {
    if (!media) return;
    setExternalSync({ status: "loading" });
    try {
      const params = new URLSearchParams({ type: media.media_type });
      if (appleMusicUrl) {
        params.set("apple_music_url", appleMusicUrl);
      } else if (itunesId) {
        params.set("itunes_id", String(itunesId));
      } else {
        params.set("title", media.original_title ?? media.title);
        if (media.author) params.set("artist", media.author);
      }
      const res = await fetch(`/api/itunes/info?${params}`);
      const data = await res.json() as {
        error?: string;
        candidates?: ItunesCandidate[];
        description?: string;
        genres?: string[];
        release_year?: number;
        cover_url?: string;
        itunes_id?: number;
        tracks?: Array<{ number: number; title: string; duration_ms: number | null }> | null;
      };
      if (!res.ok) { setExternalSync({ status: "error", message: data.error ?? "Błąd iTunes" }); return; }
      if (data.candidates) { setExternalSync({ status: "itunes_candidates", candidates: data.candidates }); return; }

      await fetch(`/api/media/${mediaId}/external`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tmdb_id: null,
          ol_key: data.itunes_id ? `itunes:${data.itunes_id}` : null,
          description: data.description ?? null,
          genres: data.genres ?? [],
          vote_average: null,
          runtime: null,
          release_year: data.release_year ?? null,
          track_list: data.tracks ?? null,
          persons: [],
        }),
      });
      const refreshRes = await fetch(`/api/media/${mediaId}/external`);
      if (refreshRes.ok) {
        const cached = await refreshRes.json() as CachedData;
        setCachedData(cached);
        setExternalSync({ status: "done" });
      }
      // Download cover
      if (data.cover_url) {
        try {
          const dlRes = await fetch("/api/cover/download", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ url: data.cover_url }),
          });
          if (dlRes.ok) {
            const { path } = await dlRes.json() as { path: string };
            await fetch(`/api/media/${mediaId}`, {
              method: "PUT",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                title: media.title, original_title: media.original_title ?? "",
                author: media.author ?? "", media_type: media.media_type,
                cover_url: path, tags: media.tags,
                discontinued: media.discontinued, tmdb_id: media.tmdb_id, ol_key: media.ol_key,
              }),
            });
            onCoverChange(path);
          }
        } catch { /* ignore */ }
      }
    } catch {
      setExternalSync({ status: "error", message: "Błąd sieci" });
    }
  }, [media, mediaId, onCoverChange]);

  const triggerSync = useCallback(() => {
    if (!media) return;
    if (SCREEN_TYPES.includes(media.media_type)) syncFromTmdb();
    else if (ITUNES_TYPES.includes(media.media_type)) syncFromItunes();
  }, [media, syncFromTmdb, syncFromItunes]);

  // Load external data once per media, when its row has arrived (later reloads of the row don't refetch)
  const mediaReady = media?.id === mediaId;
  const mediaRef = useRef(media);
  useEffect(() => { mediaRef.current = media; });
  useEffect(() => {
    if (mediaReady) void loadExternalData(mediaRef.current);
  }, [mediaReady, loadExternalData]);

  return { cachedData, state: externalSync, setState: setExternalSync, syncFromTmdb, syncFromItunes, triggerSync };
}

export type ExternalData = ReturnType<typeof useExternalData>;
