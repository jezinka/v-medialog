"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import MediaCoverThumb from "./MediaCoverThumb";
import NewSeriesList from "./NewSeriesList";
import { toast } from "./Toast";
import { MONTH_NAMES, formatDate } from "@/lib/utils";
import { groupByDate, monthKey, shiftMonth } from "@/lib/schedule";
import type { ScheduleItem } from "@/app/api/schedule/route";

/** Month-by-month list of season premieres of the series and anime on the watch list. */
export default function SeriesSchedule({ refreshKey, onChecked }: { refreshKey: number; onChecked: () => void }) {
  const [month, setMonth] = useState(() => monthKey(new Date()));
  // Tagged with its month, so a slower or failed load never shows another month's list
  const [loaded, setLoaded] = useState<{ month: string; items: ScheduleItem[] } | null>(null);
  const [checking, setChecking] = useState(false);

  useEffect(() => {
    let stale = false;
    fetch(`/api/schedule?month=${month}`)
      .then((res) => (res.ok ? res.json() : Promise.reject()))
      .then((data: { items: ScheduleItem[] }) => { if (!stale) setLoaded({ month, items: data.items }); })
      .catch(() => { if (!stale) toast("Błąd ładowania rozkładu", "error"); });
    return () => { stale = true; };
  }, [month, refreshKey]);

  const checkNow = async () => {
    setChecking(true);
    try {
      const res = await fetch("/api/jobs/check-upcoming-seasons", { method: "POST" });
      if (!res.ok) throw new Error();
      const data = await res.json() as { added: number };
      toast(data.added > 0 ? `Dodano ${data.added} nowych sezonów ✓` : "Brak nowych sezonów", "success");
      onChecked();
    } catch {
      toast("Błąd sprawdzania sezonów", "error");
    } finally {
      setChecking(false);
    }
  };

  const [y, m] = month.split("-").map(Number);
  const items = loaded?.month === month ? loaded.items : null;
  const days = items ? groupByDate(items) : [];
  return (
    <section className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
      <div className="flex items-center justify-between gap-3 mb-3">
        <div className="flex items-center gap-2">
          <button onClick={() => setMonth((cur) => shiftMonth(cur, -1))} aria-label="Poprzedni miesiąc" className="w-7 h-7 rounded-full hover:bg-gray-100 text-gray-600 font-bold">‹</button>
          <h2 className="text-base font-semibold text-gray-800 min-w-[11rem] text-center">📅 Premiery: {MONTH_NAMES[m - 1].toLowerCase()} {y}</h2>
          <button onClick={() => setMonth((cur) => shiftMonth(cur, 1))} aria-label="Następny miesiąc" className="w-7 h-7 rounded-full hover:bg-gray-100 text-gray-600 font-bold">›</button>
        </div>
        <button onClick={() => void checkNow()} disabled={checking} className="text-xs text-gray-600 hover:text-gray-900 disabled:opacity-50">
          {checking ? "Sprawdzam…" : "Sprawdź nowe sezony"}
        </button>
      </div>
      {items === null ? (
        <p className="text-sm text-gray-400 py-2">Ładowanie…</p>
      ) : days.length === 0 ? (
        <p className="text-sm text-gray-400 py-2">Brak zapowiedzianych premier seriali, które śledzisz.</p>
      ) : (
        <ol className="space-y-3">
          {days.map(({ date, items: dayItems }) => (
            <li key={date} className="flex gap-3">
              <span className="w-24 shrink-0 text-xs font-semibold text-gray-500 pt-1">{formatDate(date)}</span>
              <ul className="flex-1 space-y-1.5 min-w-0">
                {dayItems.map((item) => (
                  <li key={item.season_id}>
                    <Link href={`/media/${item.media_id}`} className="flex items-center gap-3 rounded-lg p-1 hover:bg-gray-50">
                      <MediaCoverThumb coverUrl={item.cover_url} title={item.title} mediaType={item.media_type} className="w-8 h-11" sizes="32px" />
                      <span className="min-w-0">
                        <span className="block text-sm font-medium text-gray-900 truncate">{item.title}</span>
                        <span className="block text-xs text-gray-500">
                          {item.season_number != null ? `Sezon ${item.season_number}` : (item.season_title ?? "Nowy sezon")}
                        </span>
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ol>
      )}
      <NewSeriesList month={month} onAdded={onChecked} />
      <p className="text-[11px] text-gray-400 mt-3">Nowe seriale: produkcje z Polski, USA i Wielkiej Brytanii od stacji i platform dostępnych w Polsce. Daty z TMDB (zwykle premiera w USA); polska platforma może pokazać serial lub sezon później.</p>
    </section>
  );
}
