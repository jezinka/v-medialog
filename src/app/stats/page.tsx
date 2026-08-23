"use client";

import { useEffect, useState, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import PageContainer from "@/components/PageContainer";
import Statistics from "@/components/Statistics";
import { mapSession } from "@/lib/types";
import { sessionToCalendarItem } from "@/lib/session-items";

function StatsContent() {
  const searchParams = useSearchParams();
  const yearParam = searchParams.get("year");
  const year = yearParam ? parseInt(yearParam) : new Date().getFullYear();

  const [items, setItems] = useState<ReturnType<typeof sessionToCalendarItem>[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/sessions?year=${year}`);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const data: any[] = await res.json();
      setItems(data.map((raw) => sessionToCalendarItem(mapSession(raw))));
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
    <PageContainer>
      {loading ? (
        <div className="flex items-center justify-center py-16">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-400"></div>
        </div>
      ) : (
        <Statistics items={items} year={year} />
      )}
    </PageContainer>
  );
}

import { Suspense } from "react";
export default function StatsPage() { return <Suspense><StatsContent /></Suspense>; }
