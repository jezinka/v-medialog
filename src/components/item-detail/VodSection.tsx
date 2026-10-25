"use client";
import { useCallback, useEffect, useState } from "react";
import Image from "next/image";
import { toast } from "../Toast";
import type { MediaData } from "./types";

type VodOffer = {
  id: number; provider_name: string; provider_logo: string | null;
  provider_slug: string; monetization_type: string; quality: string | null;
  url: string | null; available_to: string | null; last_checked_at: string | null;
};

/** Polish VOD offers stored for the media, with a button to re-check them on JustWatch. */
export default function VodSection({ media }: { media: MediaData }) {
  const [vodOffers, setVodOffers] = useState<VodOffer[]>([]);
  const [vodLastChecked, setVodLastChecked] = useState<string | null>(null);
  const [vodLoading, setVodLoading] = useState(false);

  const fetchVodOffers = useCallback(async (id: number) => {
    const res = await fetch(`/api/vod/offers?itemType=media&itemId=${id}`);
    if (res.ok) {
      const data = await res.json() as { offers: VodOffer[]; lastCheckedAt: string | null };
      setVodOffers(data.offers);
      setVodLastChecked(data.lastCheckedAt);
    }
  }, []);

  useEffect(() => { void fetchVodOffers(media.id); }, [media.id, fetchVodOffers]);

  const checkVod = async () => {
    setVodLoading(true);
    try {
      const res = await fetch("/api/vod/check", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          itemId: media.id,
          title: media.title,
          year: media.release_year,
          tmdbId: media.tmdb_id,
          mediaType: media.media_type,
        }),
      });
      if (!res.ok) throw new Error("Błąd sprawdzania VOD");
      await fetchVodOffers(media.id);
      toast("Sprawdzono dostępność VOD ✓", "success");
    } catch {
      toast("Nie udało się sprawdzić VOD", "error");
    } finally {
      setVodLoading(false);
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-gray-800">Dostępność VOD</h3>
        <button
          onClick={checkVod}
          disabled={vodLoading}
          className="text-xs text-gray-500 hover:text-gray-700 flex items-center gap-1 px-2 py-1 rounded border border-gray-200 hover:bg-gray-50 transition-colors disabled:opacity-50"
        >
          {vodLoading ? "⏳ Sprawdzam…" : "🔄 Sprawdź dostępność"}
        </button>
      </div>
      {vodLastChecked && (
        <p className="text-[10px] text-gray-400 mb-2">
          Ostatnio sprawdzono: {new Date(vodLastChecked).toLocaleString("pl-PL")}
        </p>
      )}
      {vodOffers.length === 0 ? (
        <p className="text-xs text-gray-400 italic">
          {vodLastChecked ? "Brak dostępności w abonamencie na polskich platformach VOD." : "Nie sprawdzono jeszcze."}
        </p>
      ) : (
        <div className="flex flex-wrap gap-2">
          {vodOffers.map((o) => {
            const daysLeft = o.available_to
              ? Math.ceil((new Date(o.available_to).getTime() - Date.now()) / 86_400_000)
              : null;
            const leaving = daysLeft !== null && daysLeft <= 7;
            return (
              <a
                key={o.id}
                href={o.url ?? "#"}
                target="_blank"
                rel="noopener noreferrer"
                className={`flex items-center gap-2 px-3 py-2 rounded-xl border text-xs transition-colors ${
                  leaving
                    ? "border-orange-300 bg-orange-50 hover:bg-orange-100"
                    : "border-gray-200 bg-white hover:bg-gray-50"
                }`}
                title={`${o.provider_name} · ${o.monetization_type}${o.quality ? ` · ${o.quality}` : ""}`}
              >
                {o.provider_logo && (
                  <Image unoptimized src={o.provider_logo} alt={o.provider_name} width={24} height={24} className="w-6 h-6 object-contain rounded" />
                )}
                <span className="font-medium text-gray-800">{o.provider_name}</span>
                <span className="text-gray-400">{o.monetization_type === "FLATRATE" ? "Sub" : o.monetization_type === "FREE" ? "Free" : o.monetization_type === "BUY" ? "Kup" : "Wynajem"}</span>
                {o.quality && <span className="text-gray-400">{o.quality.replace("_4K", "4K")}</span>}
                {leaving && daysLeft !== null && (
                  <span className="text-orange-600 font-semibold">⚠ {daysLeft}d</span>
                )}
              </a>
            );
          })}
        </div>
      )}
    </div>
  );
}
