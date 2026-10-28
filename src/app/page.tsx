"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Calendar from "@/components/Calendar";
import GanttView from "@/components/GanttView";
import AddMediaModal from "@/components/AddMediaModal";
import Modal from "@/components/Modal";
import PageContainer from "@/components/PageContainer";
import { BOOK_TYPES, SCREEN_TYPES, hasSeasonNumbers } from "@/lib/utils";
import { type SessionRow, mapSession } from "@/lib/types";
import { toast } from "@/components/Toast";
import { createDefaultSeason, createSessionForMedia } from "@/lib/session-actions";
import { sessionToCalendarItem } from "@/lib/session-items";
import SeasonPickerModal from "@/components/item-detail/SeasonPickerModal";
import { partLabels } from "@/components/item-detail/part-labels";
import type { MediaData, SeasonRow } from "@/components/item-detail/types";

/** Series and anime: seasons that can be added from the log (games, podcasts etc. also have numbered seasons, but aren't logged here). */
const isSeries = (mediaType: string) => SCREEN_TYPES.includes(mediaType) && hasSeasonNumbers(mediaType);

interface SeasonPick { media: MediaData; seasons: SeasonRow[]; startDate: string; endDate: string }

function LogContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const yearParam = searchParams.get("year");
  const year = yearParam ? parseInt(yearParam) : new Date().getFullYear();
  // The timeline is the default; the calendar is for entering sessions
  const gantt = searchParams.get("view") !== "calendar";

  const setView = (view: "calendar" | "gantt") => {
    const params = new URLSearchParams(searchParams.toString());
    if (view === "calendar") params.set("view", "calendar"); else params.delete("view");
    router.replace(`?${params}`);
  };

  const [items, setItems] = useState<SessionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [pickerState, setPickerState] = useState<{ startDate: string; itemIds: number[] } | null>(null);
  const [addModal, setAddModal] = useState<{ startDate?: string; endDate?: string } | null>(null);
  const [seasonPick, setSeasonPick] = useState<SeasonPick | null>(null);

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

  const calendarItems = items.map(sessionToCalendarItem);

  const logItems = calendarItems.filter((i) => BOOK_TYPES.includes(i.mediaType) || SCREEN_TYPES.includes(i.mediaType));

  const createSessionAndOpen = useCallback(async (
    mediaId: number, startDate: string, endDate: string, pick?: Parameters<typeof createSessionForMedia>[3],
  ) => {
    try {
      await createSessionForMedia(mediaId, startDate, endDate, pick); // the server drops that year's placeholder
      toast("Sesja dodana ✓", "success");
    } catch (e) {
      toast(e instanceof Error ? e.message : "Błąd tworzenia sesji", "error");
    }
    openMedia(mediaId);
  }, [openMedia]);

  /**
   * Asks which season the session goes to for series (where a new season can also be added)
   * and for media with several parts; otherwise adds it to the only one.
   */
  const addSessionForMedia = useCallback(async (mediaId: number, startDate: string, endDate: string) => {
    try {
      const [mediaRes, seasonsRes] = await Promise.all([fetch(`/api/media/${mediaId}`), fetch(`/api/seasons?media_id=${mediaId}`)]);
      if (!mediaRes.ok || !seasonsRes.ok) throw new Error();
      const media = await mediaRes.json() as MediaData;
      const seasons = await seasonsRes.json() as SeasonRow[];
      if (seasons.length > 1 || isSeries(media.media_type)) {
        setSeasonPick({ media, seasons, startDate, endDate });
        return;
      }
    } catch {
      toast("Nie udało się pobrać sezonów", "error");
      openMedia(mediaId);
      return;
    }
    await createSessionAndOpen(mediaId, startDate, endDate);
  }, [createSessionAndOpen, openMedia]);

  const addSessionToNewSeason = useCallback(async (
    mediaId: number, seasonNumber: number, startDate: string, endDate: string, flags: { cinema: boolean; withChild: boolean },
  ) => {
    let seasonId: number;
    try {
      seasonId = await createDefaultSeason(mediaId, seasonNumber);
    } catch {
      toast("Nie udało się utworzyć sezonu", "error");
      return;
    }
    await createSessionAndOpen(mediaId, startDate, endDate, { seasonId, ...flags });
  }, [createSessionAndOpen]);

  const handleDayClick = useCallback((startDate: string, endDate: string, itemIds: number[]) => {
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
    <PageContainer className="space-y-6">
      {loading ? (
        <div className="flex items-center justify-center py-16">
          <div className="spinner" />
        </div>
      ) : (
        <>
          <div className="flex gap-1" role="group" aria-label="Widok dziennika">
            {([["gantt", "📊 Oś czasu"], ["calendar", "📅 Kalendarz"]] as const).map(([view, label]) => (
              <button
                key={view}
                onClick={() => setView(view)}
                aria-pressed={gantt === (view === "gantt")}
                className="px-3 py-1.5 rounded-lg text-sm border border-gray-200 aria-pressed:bg-gray-900 aria-pressed:text-white aria-pressed:border-gray-900 hover:bg-gray-50 aria-pressed:hover:bg-gray-900"
              >
                {label}
              </button>
            ))}
          </div>
          {gantt ? (
            <GanttView year={year} items={logItems} onOpen={openMedia} />
          ) : (
            <Calendar
              year={year}
              items={logItems}
              hint="Kliknij dzień albo przeciągnij po kilku, żeby dodać sesję"
              onDayClick={handleDayClick}
            />
          )}
        </>
      )}

      {pickerState && (
        <Modal onClose={() => setPickerState(null)} label="Którą sesję edytować?" closeOnBackdrop z="z-50" className="rounded-2xl shadow-xl p-4 max-w-sm w-full">
            <h3 className="font-semibold text-gray-900 mb-3 text-sm">Którą sesję edytować?</h3>
            <p className="text-xs text-gray-400 mb-2">{pickerState.startDate}</p>
            <div className="space-y-2">
              {pickerState.itemIds.map((id) => {
                const session = items.find((s) => s.id === id);
                return session ? (
                  <button key={id} onClick={() => { setPickerState(null); openMedia(session.mediaId); }}
                    className="w-full text-left px-3 py-2 hover:bg-gray-50 rounded-lg border border-gray-100 text-sm transition-colors">
                    {session.mediaTitle}
                    {session.seasonNumber != null && hasSeasonNumbers(session.mediaType) && <span className="text-gray-400 ml-1">S{session.seasonNumber}</span>}
                  </button>
                ) : null;
              })}
            </div>
        </Modal>
      )}

      {addModal && (
        <AddMediaModal
          onClose={() => setAddModal(null)}
          initialStartDate={addModal.startDate}
          initialEndDate={addModal.endDate}
          onSelect={(mediaId, startDate, endDate) => {
            setAddModal(null);
            if (startDate && endDate) void addSessionForMedia(mediaId, startDate, endDate);
          }}
        />
      )}

      {seasonPick && (
        <SeasonPickerModal
          date={seasonPick.endDate !== seasonPick.startDate ? `${seasonPick.startDate} – ${seasonPick.endDate}` : seasonPick.startDate}
          seasons={seasonPick.seasons}
          coverUrl={seasonPick.media.cover_url}
          mediaType={seasonPick.media.media_type}
          partLabel={partLabels(seasonPick.media.media_type).partLabel}
          hasSpecials={partLabels(seasonPick.media.media_type).hasSpecials}
          adding={false}
          onPick={(seasonId, flags) => {
            const { media, startDate, endDate } = seasonPick;
            setSeasonPick(null);
            void createSessionAndOpen(media.id, startDate, endDate, { seasonId, ...flags });
          }}
          onAddNew={isSeries(seasonPick.media.media_type) ? (seasonNumber, flags) => {
            const { media, startDate, endDate } = seasonPick;
            setSeasonPick(null);
            void addSessionToNewSeason(media.id, seasonNumber, startDate, endDate, flags);
          } : undefined}
          onClose={() => setSeasonPick(null)}
        />
      )}
    </PageContainer>
  );
}

import { Suspense } from "react";
export const dynamic = "force-dynamic";
export default function LogPage() { return <Suspense><LogContent /></Suspense>; }
