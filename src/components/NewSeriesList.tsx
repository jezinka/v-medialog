"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import MediaCoverThumb from "./MediaCoverThumb";
import MonthSwitcher from "./MonthSwitcher";
import { toast } from "./Toast";
import { formatDate } from "@/lib/utils";
import { monthKey } from "@/lib/schedule";
import type { NewSeriesItem } from "@/lib/new-series";

const FLAGS: Record<string, string> = { PL: "🇵🇱", US: "🇺🇸", GB: "🇬🇧" };

/** New PL / US / GB series premiering in a month on platforms available in Poland (from TMDB). */
export default function NewSeriesList({ initialMonth }: { initialMonth: string | null }) {
  const [month, setMonth] = useState(() => initialMonth ?? monthKey(new Date()));
  const [loaded, setLoaded] = useState<{ month: string; items: NewSeriesItem[] } | { month: string; error: true } | null>(null);
  const [adding, setAdding] = useState<number | null>(null);
  const [showIgnored, setShowIgnored] = useState(false);

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
      const { media_id, added } = await res.json() as { media_id: number; added: boolean };
      setLoaded((prev) => prev && "items" in prev
        ? { ...prev, items: prev.items.map((i) => (i.tmdb_id === item.tmdb_id ? { ...i, media_id } : i)) }
        : prev);
      toast(added ? `Dodano „${item.title}” do listy ✓` : `„${item.title}” już jest w bibliotece`, "success");
    } catch {
      toast("Błąd dodawania", "error");
    } finally {
      setAdding(null);
    }
  };

  const setIgnored = async (item: NewSeriesItem, ignored: boolean) => {
    try {
      const res = await fetch("/api/schedule/new-series/ignore", {
        method: ignored ? "POST" : "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tmdb_id: item.tmdb_id }),
      });
      if (!res.ok) throw new Error();
      setLoaded((prev) => prev && "items" in prev
        ? { ...prev, items: prev.items.map((i) => (i.tmdb_id === item.tmdb_id ? { ...i, ignored } : i)) }
        : prev);
    } catch {
      toast(ignored ? "Błąd ukrywania" : "Błąd przywracania", "error");
    }
  };

  const current = loaded?.month === month ? loaded : null;
  const ignoredCount = current && "items" in current ? current.items.filter((i) => i.ignored).length : 0;
  const visible = current && "items" in current
    ? current.items.filter((i) => showIgnored || !i.ignored).sort((a, b) => a.first_air_date.localeCompare(b.first_air_date))
    : [];
  return (
    <section className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
      <div className="mb-3">
        <MonthSwitcher label="✨ Nowe seriale" month={month} onChange={setMonth} />
      </div>
      {current === null ? (
        <p className="text-sm text-gray-400">Ładowanie…</p>
      ) : "error" in current ? (
        <p className="text-sm text-red-500">Nie udało się pobrać listy z TMDB.</p>
      ) : visible.length === 0 ? (
        <p className="text-sm text-gray-400">{ignoredCount > 0 ? "Wszystkie zapowiedzi w tym miesiącu są ukryte." : "Brak zapowiedzi w tym miesiącu."}</p>
      ) : (
        <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {visible.map((item) => (
            <li key={item.tmdb_id} className={`flex gap-3 rounded-lg border border-gray-100 p-2 ${item.ignored ? "opacity-50" : ""}`}>
              <MediaCoverThumb coverUrl={item.poster_url} title={item.title} mediaType="series" className="w-10 h-14" sizes="40px" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 truncate">{item.title}</p>
                <p className="text-xs text-gray-500">
                  {formatDate(item.first_air_date)} · {item.origin_country.map((c) => FLAGS[c] ?? c).join(" ")}
                </p>
                {item.overview && (
                  <p className="text-xs text-gray-600 line-clamp-2 my-0.5" title={item.overview}>{item.overview}</p>
                )}
                <div className="flex items-center gap-3">
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
                  <button
                    onClick={() => void setIgnored(item, !item.ignored)}
                    aria-label={`${item.ignored ? "Przywróć" : "Ukryj"} ${item.title}`}
                    className="text-xs text-gray-400 hover:text-gray-700"
                  >
                    {item.ignored ? "przywróć" : "ukryj"}
                  </button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
      {(ignoredCount > 0 || showIgnored) && (
        <button onClick={() => setShowIgnored((v) => !v)} className="text-xs text-gray-500 hover:text-gray-800 mt-3">
          {showIgnored ? "Schowaj ukryte" : `Pokaż ukryte (${ignoredCount})`}
        </button>
      )}
      <p className="text-[11px] text-gray-400 mt-3">Produkcje z Polski, USA i Wielkiej Brytanii od stacji i platform dostępnych w Polsce. Daty z TMDB (zwykle premiera w USA); polska platforma może pokazać serial później.</p>
    </section>
  );
}
