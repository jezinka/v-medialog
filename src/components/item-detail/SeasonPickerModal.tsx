"use client";
import { useState } from "react";
import Image from "next/image";
import Modal from "../Modal";
import { BOOK_TYPES, MOVIE_TYPES, SCREEN_TYPES } from "@/lib/utils";
import { partNo, seasonLabel } from "@/lib/part-number";
import { SEASON_COLORS } from "@/lib/calendar-days";
import type { SeasonRow } from "./types";

/** Picks the season a new session on `date` goes to, with cinema / with-child flags. */
export default function SeasonPickerModal({
  date, seasons, coverUrl, mediaType, partLabel, hasSpecials, adding, onPick, onClose,
}: {
  date: string;
  seasons: SeasonRow[];
  coverUrl: string | null;
  mediaType: string;
  partLabel: string;
  hasSpecials: boolean;
  adding: boolean;
  onPick: (seasonId: number, flags: { cinema: boolean; withChild: boolean }) => void;
  onClose: () => void;
}) {
  const [cinema, setCinema] = useState(false);
  const [withChild, setWithChild] = useState(false);

  return (
    <Modal onClose={onClose} label="Dodaj sesję" className="rounded-xl shadow-xl p-5 max-w-sm w-full space-y-3">
        <h3 className="text-sm font-semibold text-gray-900">Dodaj sesję</h3>
        <p className="text-xs text-gray-500">{date}</p>
        {/* Cinema toggle — only for movies */}
        {MOVIE_TYPES.includes(mediaType) && (
          <label className="flex items-center gap-2 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={cinema}
              onChange={(e) => setCinema(e.target.checked)}
              className="w-4 h-4 accent-yellow-500"
            />
            <span className="text-sm text-gray-700">🎟️ Oglądane w kinie</span>
          </label>
        )}
        {SCREEN_TYPES.includes(mediaType) && (
          <label className="flex items-center gap-2 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={withChild}
              onChange={(e) => setWithChild(e.target.checked)}
              className="w-4 h-4 accent-emerald-500"
            />
            <span className="text-sm text-gray-700">👶 Z dzieckiem</span>
          </label>
        )}
        {seasons.length > 1 && (
          <p className="text-xs font-medium text-gray-500 pt-1">Wybierz {partLabel.toLowerCase()}:</p>
        )}
        {/* Book parts are picked by cover; so is a movie with one part, which has nothing to list */}
        {BOOK_TYPES.includes(mediaType) || (MOVIE_TYPES.includes(mediaType) && seasons.length === 1) ? (
          <div className="grid grid-cols-5 gap-2 max-h-80 overflow-y-auto p-1">
            {seasons.map((s, idx) => {
              // A single part has no cover of its own, so it shows the book's or movie's cover
              const cover = s.cover_url ?? (seasons.length === 1 ? coverUrl : null);
              return (
              <button
                key={s.id}
                onClick={() => onPick(s.id, { cinema, withChild })}
                disabled={adding}
                title={seasonLabel(s, partNo(seasons, idx, hasSpecials), partLabel)}
                className="rounded-md hover:ring-2 hover:ring-blue-400 disabled:opacity-50"
              >
                <div className="relative aspect-[2/3] rounded-md overflow-hidden bg-gray-100">
                  {cover ? (
                    <Image unoptimized src={cover} alt="" fill className="object-cover" />
                  ) : (
                    <div className={`absolute inset-0 flex items-center justify-center text-white text-sm font-semibold ${SEASON_COLORS[idx % SEASON_COLORS.length]}`}>
                      {partNo(seasons, idx, hasSpecials)}
                    </div>
                  )}
                </div>
                <p className="text-[11px] text-gray-600 text-center mt-0.5">{partNo(seasons, idx, hasSpecials)}</p>
              </button>
              );
            })}
          </div>
        ) : (
          <div className="space-y-2">
            {seasons.map((s, idx) => (
              <button
                key={s.id}
                onClick={() => onPick(s.id, { cinema, withChild })}
                disabled={adding}
                className="flex items-center gap-2 w-full text-left px-3 py-2 rounded-lg border border-gray-200 hover:bg-gray-50 text-sm transition-colors disabled:opacity-50"
              >
                <span
                  className={`w-2.5 h-2.5 rounded-full shrink-0 ${SEASON_COLORS[idx % SEASON_COLORS.length]}`}
                />
                <span className="font-medium">
                  {seasonLabel(s, partNo(seasons, idx, hasSpecials), partLabel)}
                </span>
                {s.session_count > 0 && (
                  <span className="ml-auto text-xs text-gray-400">{s.session_count} sesji</span>
                )}
              </button>
            ))}
          </div>
        )}
        <button
          onClick={onClose}
          className="text-xs text-gray-400 hover:text-gray-600 w-full text-center pt-1"
        >
          Anuluj
        </button>
    </Modal>
  );
}
