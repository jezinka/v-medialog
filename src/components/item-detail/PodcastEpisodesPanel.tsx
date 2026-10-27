"use client";
import { useState } from "react";
import { toast } from "../Toast";
import { formatDate } from "@/lib/utils";
import { addDaySessions } from "@/lib/session-actions";
import type { SeasonRow } from "./types";

/** Episode release dates from an Apple Podcasts URL, importable as one-day sessions. */
export default function PodcastEpisodesPanel({ mediaId, seasons, sessionDaysMap, onImported }: {
  mediaId: number;
  seasons: SeasonRow[];
  sessionDaysMap: Map<string, string>;
  onImported: () => Promise<void>;
}) {
  const [showPodcastEpisodes, setShowPodcastEpisodes] = useState(false);
  const [podcastUrl, setPodcastUrl] = useState("");
  const [podcastEpisodeDates, setPodcastEpisodeDates] = useState<string[]>([]);
  const [podcastEpisodesLoading, setPodcastEpisodesLoading] = useState(false);
  const [podcastEpisodesError, setPodcastEpisodesError] = useState<string | null>(null);
  const [importingDates, setImportingDates] = useState<Set<string>>(new Set());

  const fetchPodcastEpisodes = async (url: string) => {
    setPodcastEpisodesLoading(true);
    setPodcastEpisodesError(null);
    setPodcastEpisodeDates([]);
    try {
      const res = await fetch(`/api/podcast/episodes?url=${encodeURIComponent(url)}`);
      const data = await res.json() as { dates?: string[]; error?: string };
      if (!res.ok || data.error) { setPodcastEpisodesError(data.error ?? "Błąd"); return; }
      setPodcastEpisodeDates(data.dates ?? []);
    } catch {
      setPodcastEpisodesError("Błąd sieci");
    } finally {
      setPodcastEpisodesLoading(false);
    }
  };

  const importPodcastDates = async (dates: string[]) => {
    const newDates = dates.filter((d) => !sessionDaysMap.has(d));
    if (!newDates.length) { toast("Wszystkie daty już istnieją", "error"); return; }

    let seasonId = seasons[0]?.id ?? null;
    if (seasonId === null) {
      try {
        const sRes = await fetch("/api/seasons", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ media_id: mediaId, season_number: 1 }),
        });
        if (!sRes.ok) throw new Error();
        const sData = await sRes.json() as { id: number };
        seasonId = sData.id;
      } catch {
        toast("Błąd tworzenia sezonu", "error");
        return;
      }
    }

    setImportingDates((prev) => new Set([...prev, ...newDates]));
    const added = await addDaySessions(seasonId, newDates);
    setImportingDates((prev) => { const n = new Set(prev); newDates.forEach((d) => n.delete(d)); return n; });
    toast(added > 0 ? `Dodano ${added} sesji ✓` : "Błąd zapisu sesji", added > 0 ? "success" : "error");
    await onImported();
  };

  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <button
          onClick={() => setShowPodcastEpisodes((v) => !v)}
          className={`text-xs flex items-center gap-1 px-2 py-1 rounded border transition-colors ${
            showPodcastEpisodes
              ? "border-cyan-400 bg-cyan-50 text-cyan-700"
              : "border-gray-200 text-gray-500 hover:text-gray-700 hover:bg-gray-50"
          }`}
        >
          🎙️ {showPodcastEpisodes ? "Ukryj odcinki" : "Daty odcinków Apple Podcasts"}
        </button>
      </div>

      {showPodcastEpisodes && (
        <div className="border border-gray-200 rounded-lg overflow-hidden">
          <div className="flex items-center gap-2 px-3 py-2 bg-gray-50 border-b border-gray-100">
            <input
              type="url"
              placeholder="https://podcasts.apple.com/…"
              value={podcastUrl}
              onChange={(e) => setPodcastUrl(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && podcastUrl) fetchPodcastEpisodes(podcastUrl); }}
              className="input flex-1 text-xs px-2 py-1"
            />
            <button
              onClick={() => { if (podcastUrl) fetchPodcastEpisodes(podcastUrl); }}
              disabled={!podcastUrl || podcastEpisodesLoading}
              className="text-xs px-3 py-1 bg-cyan-600 text-white rounded hover:bg-cyan-700 disabled:opacity-40"
            >
              {podcastEpisodesLoading ? "⏳" : "Pobierz"}
            </button>
            {podcastEpisodeDates.length > 0 && (() => {
              const newDates = podcastEpisodeDates.filter((d) => !sessionDaysMap.has(d));
              return newDates.length > 0 ? (
                <button
                  onClick={() => importPodcastDates(newDates)}
                  disabled={newDates.some((d) => importingDates.has(d))}
                  className="text-xs px-3 py-1 bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-40"
                >
                  + Dodaj wszystkie nowe ({newDates.length})
                </button>
              ) : null;
            })()}
          </div>

          {podcastEpisodesError && (
            <p className="px-3 py-2 text-xs text-red-500">{podcastEpisodesError}</p>
          )}

          {!podcastEpisodesLoading && podcastEpisodeDates.length > 0 && (
            <div className="p-3 space-y-1">
              <p className="text-[10px] text-gray-400 mb-2">
                {podcastEpisodeDates.length} odcinków · {podcastEpisodeDates.filter((d) => !sessionDaysMap.has(d)).length} nowych
              </p>
              <div className="flex flex-wrap gap-1.5">
                {podcastEpisodeDates.map((date) => {
                  const exists = sessionDaysMap.has(date);
                  const importing = importingDates.has(date);
                  return (
                    <button
                      key={date}
                      onClick={() => !exists && !importing && importPodcastDates([date])}
                      disabled={exists || importing}
                      title={exists ? "Już zalogowane" : `Dodaj ${date} jako sesję`}
                      className={`text-[11px] px-2 py-0.5 rounded-full border transition-colors ${
                        exists
                          ? "bg-green-100 border-green-200 text-green-700 cursor-default"
                          : importing
                          ? "bg-gray-100 border-gray-200 text-gray-400 cursor-wait"
                          : "bg-white border-gray-300 text-gray-700 hover:bg-cyan-50 hover:border-cyan-300 cursor-pointer"
                      }`}
                    >
                      {formatDate(date)}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
