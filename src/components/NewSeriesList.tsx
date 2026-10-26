"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import MediaCoverThumb from "./MediaCoverThumb";
import MonthSwitcher from "./MonthSwitcher";
import { toast } from "./Toast";
import { formatDate } from "@/lib/utils";
import { monthKey } from "@/lib/schedule";
import { NEW_SERIES_COUNTRIES, NEW_SERIES_PLATFORMS, type NewSeriesItem } from "@/lib/new-series";

const FLAGS: Record<string, string> = { PL: "🇵🇱", US: "🇺🇸", GB: "🇬🇧" };
const COUNTRY_NAMES: Record<string, string> = { PL: "Polska", US: "USA", GB: "Wielka Brytania" };

/** New PL / US / GB series premiering in a month on platforms available in Poland (from TMDB). */
export default function NewSeriesList({ initialMonth, initialCountry, initialPlatform, initialHideLibrary }: {
  initialMonth: string | null;
  initialCountry: string;
  initialPlatform: string;
  initialHideLibrary: boolean;
}) {
  const [month, setMonth] = useState(() => initialMonth ?? monthKey(new Date()));
  const [country, setCountry] = useState(initialCountry);
  const [platform, setPlatform] = useState(initialPlatform);
  const [hideLibrary, setHideLibrary] = useState(initialHideLibrary);
  // Tagged with the month and filters, so a slower or failed load never shows another query's list
  const query = new URLSearchParams(Object.entries({ month, country, platform }).filter(([, v]) => v)).toString();
  const [loaded, setLoaded] = useState<{ query: string; items: NewSeriesItem[] } | { query: string; error: true } | null>(null);
  const [adding, setAdding] = useState<number | null>(null);
  const [showIgnored, setShowIgnored] = useState(false);

  useEffect(() => {
    // Keeps the month and filters across a reload and in a copied link
    window.history.replaceState(null, "", `?${query}${hideLibrary ? "&library=hide" : ""}`);
  }, [query, hideLibrary]);

  useEffect(() => {
    let stale = false;
    fetch(`/api/schedule/new-series?${query}`)
      .then((res) => (res.ok ? res.json() : Promise.reject()))
      .then((data: { items: NewSeriesItem[] }) => { if (!stale) setLoaded({ query, items: data.items }); })
      .catch(() => { if (!stale) setLoaded({ query, error: true }); });
    return () => { stale = true; };
  }, [query]);

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

  const current = loaded?.query === query ? loaded : null;
  const ignoredCount = current && "items" in current ? current.items.filter((i) => i.ignored && !(hideLibrary && i.media_id)).length : 0;
  const visible = current && "items" in current
    ? current.items.filter((i) => (showIgnored || !i.ignored) && !(hideLibrary && i.media_id)).sort((a, b) => a.first_air_date.localeCompare(b.first_air_date))
    : [];
  return (
    <section className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
        <MonthSwitcher label="✨ Nowe seriale" month={month} onChange={setMonth} />
        <div className="flex flex-wrap gap-2">
          <select value={country} onChange={(e) => setCountry(e.target.value)} aria-label="Kraj" className="text-xs border border-gray-200 rounded-lg px-2 py-1 bg-white text-gray-700">
            <option value="">Wszystkie kraje</option>
            {NEW_SERIES_COUNTRIES.map((c) => <option key={c} value={c}>{FLAGS[c]} {COUNTRY_NAMES[c]}</option>)}
          </select>
          <select value={platform} onChange={(e) => setPlatform(e.target.value)} aria-label="Platforma lub stacja" className="text-xs border border-gray-200 rounded-lg px-2 py-1 bg-white text-gray-700">
            <option value="">Wszystkie platformy</option>
            {NEW_SERIES_PLATFORMS.map((p) => <option key={p} value={p}>{p}</option>)}
          </select>
          <label className="flex items-center gap-1 text-xs text-gray-700">
            <input type="checkbox" checked={hideLibrary} onChange={(e) => setHideLibrary(e.target.checked)} />
            Bez seriali z biblioteki
          </label>
        </div>
      </div>
      {current === null ? (
        <p className="text-sm text-gray-400">Ładowanie…</p>
      ) : "error" in current ? (
        <p className="text-sm text-red-500">Nie udało się pobrać listy z TMDB.</p>
      ) : visible.length === 0 ? (
        <p className="text-sm text-gray-400">{current.items.length > 0 ? `Wszystkie zapowiedzi w tym miesiącu są ukryte${hideLibrary ? " lub już w bibliotece" : ""}.` : country || platform ? "Brak zapowiedzi dla tych filtrów w tym miesiącu." : "Brak zapowiedzi w tym miesiącu."}</p>
      ) : (
        <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {visible.map((item) => (
            <li key={item.tmdb_id} className={`flex gap-3 rounded-lg border border-gray-100 p-2 ${item.ignored ? "opacity-50" : ""}`}>
              <MediaCoverThumb coverUrl={item.poster_url} title={item.title} mediaType="series" className="w-10 h-14" sizes="40px" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 truncate">{item.title}</p>
                <p className="text-xs text-gray-500">
                  {formatDate(item.first_air_date)} · {item.origin_country.map((c) => FLAGS[c] ?? c).join(" ")}
                  {item.rating && (
                    <span title={`Średnia ocena na TMDB, głosów: ${item.rating.count}`}> · ★ {item.rating.average.toFixed(1)} ({item.rating.count})</span>
                  )}
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
