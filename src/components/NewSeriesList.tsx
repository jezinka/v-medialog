"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import MediaCoverThumb from "./MediaCoverThumb";
import { toast } from "./Toast";
import { formatDate } from "@/lib/utils";
import type { NewSeriesItem } from "@/lib/new-series";

const FLAGS: Record<string, string> = { PL: "🇵🇱", US: "🇺🇸", GB: "🇬🇧" };

/** New PL / US / GB series premiering in `month` on platforms available in Poland (from TMDB). */
export default function NewSeriesList({ month, onAdded }: { month: string; onAdded: () => void }) {
  const [loaded, setLoaded] = useState<{ month: string; items: NewSeriesItem[] } | { month: string; error: true } | null>(null);
  const [adding, setAdding] = useState<number | null>(null);

  useEffect(() => {
    let stale = false;
    fetch(`/api/schedule/new-series?month=${month}`)
      .then((res) => (res.ok ? res.json() : Promise.reject()))
      .then((data: { items: NewSeriesItem[] }) => { if (!stale) setLoaded({ month, items: data.items }); })
      .catch(() => { if (!stale) setLoaded({ month, error: true }); });
    return () => { stale = true; };
  }, [month]);

  const add = async (item: NewSeriesItem) => {
    setAdding(item.tmdb_id);
    try {
      const res = await fetch("/api/schedule/new-series", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(item),
      });
      if (!res.ok) throw new Error();
      const { media_id } = await res.json() as { media_id: number };
      setLoaded((prev) => prev && "items" in prev
        ? { ...prev, items: prev.items.map((i) => (i.tmdb_id === item.tmdb_id ? { ...i, media_id } : i)) }
        : prev);
      toast(`Dodano „${item.title}” do listy ✓`, "success");
      onAdded();
    } catch {
      toast("Błąd dodawania", "error");
    } finally {
      setAdding(null);
    }
  };

  const current = loaded?.month === month ? loaded : null;
  return (
    <div className="mt-5 pt-4 border-t border-gray-100">
      <h3 className="text-sm font-semibold text-gray-800 mb-2">✨ Nowe seriale</h3>
      {current === null ? (
        <p className="text-sm text-gray-400">Ładowanie…</p>
      ) : "error" in current ? (
        <p className="text-sm text-red-500">Nie udało się pobrać listy z TMDB.</p>
      ) : current.items.length === 0 ? (
        <p className="text-sm text-gray-400">Brak zapowiedzi w tym miesiącu.</p>
      ) : (
        <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {[...current.items].sort((a, b) => a.first_air_date.localeCompare(b.first_air_date)).map((item) => (
            <li key={item.tmdb_id} className="flex gap-3 rounded-lg border border-gray-100 p-2">
              <MediaCoverThumb coverUrl={item.poster_url} title={item.title} mediaType="series" className="w-10 h-14" sizes="40px" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 truncate" title={item.overview || undefined}>{item.title}</p>
                <p className="text-xs text-gray-500">
                  {formatDate(item.first_air_date)} · {item.origin_country.map((c) => FLAGS[c] ?? c).join(" ")}
                </p>
                {item.media_id ? (
                  <Link href={`/media/${item.media_id}`} className="text-xs text-green-700 hover:underline">✓ w bibliotece</Link>
                ) : (
                  <button
                    onClick={() => void add(item)}
                    disabled={adding !== null}
                    aria-label={`Dodaj ${item.title} do listy do obejrzenia`}
                    className="text-xs text-purple-600 hover:text-purple-800 disabled:opacity-50"
                  >
                    {adding === item.tmdb_id ? "Dodaję…" : "+ do obejrzenia"}
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
