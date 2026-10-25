"use client";
import { useState } from "react";
import Image from "next/image";
import { SCREEN_TYPES, ITUNES_TYPES } from "@/lib/utils";
import type { ExternalData } from "./useExternalData";
import type { MediaData } from "./types";

/** "Pull from TMDB / iTunes" button, plus an Apple Music URL field for records and podcasts. */
export function SyncButtons({ media, sync }: { media: MediaData; sync: ExternalData }) {
  const [appleMusicUrlInput, setAppleMusicUrlInput] = useState("");
  return (
    <>
      {(SCREEN_TYPES.includes(media.media_type) || ITUNES_TYPES.includes(media.media_type)) && (
        <button
          onClick={sync.triggerSync}
          disabled={sync.state.status === "loading"}
          className="text-xs text-gray-500 hover:text-gray-700 flex items-center gap-1 px-2 py-1 rounded border border-gray-200 hover:bg-gray-50 transition-colors disabled:opacity-50"
        >
          {sync.state.status === "loading" ? "⏳ Ładowanie…" :
           SCREEN_TYPES.includes(media.media_type) ? "🎬 Zaciągnij z TMDB" :
           "🎵 Zaciągnij z iTunes"}
        </button>
      )}
      {ITUNES_TYPES.includes(media.media_type) && (
        <div className="flex gap-1 items-center">
          <input
            type="url"
            placeholder="lub wklej link z Apple Music…"
            value={appleMusicUrlInput}
            onChange={(e) => setAppleMusicUrlInput(e.target.value)}
            className="text-xs border border-gray-200 rounded px-2 py-1 w-52 focus:outline-none focus:border-pink-400"
          />
          <button
            onClick={() => { if (appleMusicUrlInput) { const u = appleMusicUrlInput; setAppleMusicUrlInput(""); sync.syncFromItunes(undefined, u); } }}
            disabled={!appleMusicUrlInput || sync.state.status === "loading"}
            className="text-xs px-2 py-1 bg-pink-50 hover:bg-pink-100 text-pink-700 rounded border border-pink-200 disabled:opacity-40"
          >
            🎵
          </button>
        </div>
      )}
    </>
  );
}

/** Candidates to pick from when TMDB / iTunes matched several titles, or the sync error. */
export function SyncCandidates({ sync }: { sync: ExternalData }) {
  return (
    <>
      {sync.state.status === "tmdb_candidates" && (
        <div className="mb-4 border border-blue-200 rounded-lg p-3 bg-blue-50 space-y-2">
          <p className="text-xs font-medium text-blue-800">Wybierz tytuł z TMDB:</p>
          <div className="flex flex-wrap gap-2">
            {sync.state.candidates.map((c) => (
              <button
                key={c.tmdb_id}
                onClick={() => sync.syncFromTmdb(c.tmdb_id)}
                className="flex items-center gap-2 px-3 py-1.5 bg-white border border-blue-200 rounded-lg text-xs hover:bg-blue-100 transition-colors"
              >
                {c.poster_path && (
                  <Image unoptimized src={`https://image.tmdb.org/t/p/w45${c.poster_path}`} alt="" width={20} height={28} className="w-5 h-7 object-cover rounded" />
                )}
                <span className="font-medium">{c.name}</span>
                {c.first_air_date && <span className="text-gray-400">{c.first_air_date.slice(0, 4)}</span>}
              </button>
            ))}
          </div>
          <button onClick={() => sync.setState({ status: "idle" })} className="text-xs text-gray-400 hover:text-gray-600">Anuluj</button>
        </div>
      )}
      {sync.state.status === "itunes_candidates" && (
        <div className="mb-4 border border-pink-200 rounded-lg p-3 bg-pink-50 space-y-2">
          <p className="text-xs font-medium text-pink-800">Wybierz z iTunes:</p>
          <div className="flex flex-wrap gap-2">
            {sync.state.candidates.map((c) => (
              <button
                key={c.itunes_id}
                onClick={() => sync.syncFromItunes(c.itunes_id)}
                className="flex items-center gap-2 px-3 py-1.5 bg-white border border-pink-200 rounded-lg text-xs hover:bg-pink-100 transition-colors"
              >
                {c.cover_url && (
                  <Image unoptimized src={c.cover_url.replace("600x600bb", "45x45bb")} alt="" width={28} height={28} className="w-7 h-7 object-cover rounded" />
                )}
                <span className="font-medium">{c.title}</span>
                {c.artist && <span className="text-gray-500">{c.artist}</span>}
                {c.year && <span className="text-gray-400">{c.year}</span>}
              </button>
            ))}
          </div>
          <button onClick={() => sync.setState({ status: "idle" })} className="text-xs text-gray-400 hover:text-gray-600">Anuluj</button>
        </div>
      )}
      {sync.state.status === "error" && (
        <div className="mb-4 bg-red-50 border border-red-200 rounded-lg px-3 py-2 space-y-1.5">
          <p className="text-xs text-red-600">⚠️ {sync.state.message}</p>
        </div>
      )}
    </>
  );
}
