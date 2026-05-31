"use client";

import { useEffect, useState, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import Statistics from "@/components/Statistics";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapToCalendarItem(raw: any) {
  return {
    id: raw.id,
    seasonId: raw.season_id ?? null,
    title: raw.media_title,
    author: raw.author ?? null,
    mediaType: raw.media_type,
    startDate: raw.start_date,
    endDate: raw.end_date ?? null,
    volumeEpisode: raw.season_number != null ? String(raw.season_number) : null,
    discontinued: raw.discontinued ? true : null,
    cinema: raw.cinema,
    tagList: raw.tagList,
    additionalSessions: null,
  };
}

function StatsContent() {
  const searchParams = useSearchParams();
  const yearParam = searchParams.get("year");
  const year = yearParam ? parseInt(yearParam) : new Date().getFullYear();

  const [items, setItems] = useState<ReturnType<typeof mapToCalendarItem>[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/sessions?year=${year}`);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const data: any[] = await res.json();
      setItems(data.map(mapToCalendarItem));
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [year]);

  useEffect(() => {
    void fetchData();

    const handlePageShow = (e: PageTransitionEvent) => {
      if (e.persisted) void fetchData();
    };
    window.addEventListener('pageshow', handlePageShow);
    return () => window.removeEventListener('pageshow', handlePageShow);
  }, [fetchData]);

  return (
    <main className="max-w-7xl mx-auto px-4 py-6">
      {loading ? (
        <div className="flex items-center justify-center py-16">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-400"></div>
        </div>
      ) : (
        <Statistics items={items} year={year} />
      )}
    </main>
  );
}

import { Suspense } from "react";
export default function StatsPage() { return <Suspense><StatsContent /></Suspense>; }
