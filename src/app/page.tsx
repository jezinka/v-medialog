"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Calendar from "@/components/Calendar";
import AddMediaModal from "@/components/AddMediaModal";
import { BOOK_TYPES, SCREEN_TYPES } from "@/lib/utils";
import { type SessionRow, mapSession } from "@/lib/types";
import { toast } from "@/components/Toast";

function LogContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const yearParam = searchParams.get("year");
  const year = yearParam ? parseInt(yearParam) : new Date().getFullYear();

  const [items, setItems] = useState<SessionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [pickerState, setPickerState] = useState<{ startDate: string; itemIds: number[] } | null>(null);
  const [addModal, setAddModal] = useState<{ startDate?: string; endDate?: string } | null>(null);

  const openMedia = useCallback((mediaId: number) => router.push(`/media/${mediaId}`), [router]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/sessions?year=${year}`);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const data: any[] = await res.json();
      setItems(data.map(mapSession));
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [year]);

  useEffect(() => { void fetchData(); }, [fetchData]);

  const calendarItems = items.map((s) => ({
    id: s.id,
    title: s.mediaTitle,
    author: s.author,
    mediaType: s.mediaType,
    startDate: s.startDate,
    endDate: s.endDate,
    volumeEpisode: s.seasonNumber != null ? String(s.seasonNumber) : null,
    discontinued: s.discontinued ? true : null,
    cinema: s.cinema,
    tagList: s.tagList,
    additionalSessions: null,
  }));

  const bookItems = calendarItems.filter((i) => BOOK_TYPES.includes(i.mediaType));
  const screenItems = calendarItems.filter((i) => SCREEN_TYPES.includes(i.mediaType));

  const createSessionAndOpen = useCallback(async (mediaId: number, startDate: string, endDate: string) => {
    try {
      const seasonsRes = await fetch(`/api/seasons?media_id=${mediaId}`);
      if (!seasonsRes.ok) throw new Error("Nie udało się pobrać sezonów");
      const seasons: { id: number }[] = await seasonsRes.json();
      let seasonId: number;
      if (seasons.length === 0) {
        const r = await fetch("/api/seasons", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ media_id: mediaId, season_number: 1, title: null }),
        });
        const s = await r.json() as { id?: number; error?: string };
        if (!r.ok) throw new Error(s.error ?? "Nie udało się utworzyć sezonu");
        if (!s.id) throw new Error("Nieprawidłowa odpowiedź serwera (brak id sezonu)");
        seasonId = s.id;
      } else {
        seasonId = seasons[0].id;
      }
      // Remove year-placeholder before adding a real session
      await fetch(`/api/seasons/${seasonId}/placeholders`, { method: "DELETE" });
      const sessRes = await fetch("/api/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ season_id: seasonId, start_date: startDate, end_date: endDate !== startDate ? endDate : null }),
      });
      if (!sessRes.ok) {
        const e = await sessRes.json() as { error?: string };
        throw new Error(e.error ?? "Nie udało się utworzyć sesji");
      }
      toast("Sesja dodana ✓", "success");
    } catch (e) {
      toast(e instanceof Error ? e.message : "Błąd tworzenia sesji", "error");
    }
    openMedia(mediaId);
  }, [openMedia]);

  const handleDayClick = useCallback((startDate: string, endDate: string, _mediaType: "book" | "movie", itemIds: number[]) => {
    if (itemIds.length === 1) {
      const session = items.find((s) => s.id === itemIds[0]);
      if (session) { openMedia(session.mediaId); return; }
    }
    if (itemIds.length > 1) {
      const sd = items.find((s) => s.id === itemIds[0])?.startDate ?? startDate;
      setPickerState({ startDate: sd, itemIds });
      return;
    }
    // Empty day — open add modal with pre-filled dates
    setAddModal({ startDate, endDate });
  }, [items, openMedia]);

  return (
    <main className="max-w-7xl mx-auto px-4 py-6 space-y-6">
      {loading ? (
        <div className="flex items-center justify-center py-16">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-400"></div>
        </div>
      ) : (
        <>
          <div className="grid lg:grid-cols-2 gap-6">
            <Calendar
              year={year}
              items={bookItems}
              title="📚 Książki i Komiksy"
              calendarType="book"
              onDayClick={handleDayClick}
            />
            <Calendar
              year={year}
              items={screenItems}
              title="🎬 Filmy, Seriale, Anime"
              calendarType="movie"
              onDayClick={handleDayClick}
            />
          </div>
        </>
      )}

      {pickerState && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setPickerState(null)}>
          <div className="bg-white rounded-2xl shadow-xl p-4 max-w-sm w-full" onClick={(e) => e.stopPropagation()}>
            <h3 className="font-semibold text-gray-900 mb-3 text-sm">Którą sesję edytować?</h3>
            <p className="text-xs text-gray-400 mb-2">{pickerState.startDate}</p>
            <div className="space-y-2">
              {pickerState.itemIds.map((id) => {
                const session = items.find((s) => s.id === id);
                return session ? (
                  <button key={id} onClick={() => { setPickerState(null); openMedia(session.mediaId); }}
                    className="w-full text-left px-3 py-2 hover:bg-gray-50 rounded-lg border border-gray-100 text-sm transition-colors">
                    {session.mediaTitle}
                    {session.seasonNumber != null && <span className="text-gray-400 ml-1">S{session.seasonNumber}</span>}
                  </button>
                ) : null;
              })}
            </div>
          </div>
        </div>
      )}

      {addModal && (
        <AddMediaModal
          onClose={() => setAddModal(null)}
          initialStartDate={addModal.startDate}
          initialEndDate={addModal.endDate}
          onSelect={(mediaId, startDate, endDate) => {
            setAddModal(null);
            if (startDate && endDate) void createSessionAndOpen(mediaId, startDate, endDate);
          }}
        />
      )}
    </main>
  );
}

import { Suspense } from "react";
export const dynamic = "force-dynamic";
export default function LogPage() { return <Suspense><LogContent /></Suspense>; }
