"use client";
import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import Calendar from "./Calendar";
import Statistics from "./Statistics";
import AddMediaModal from "./AddMediaModal";
import WishlistPage from "./WishlistPage";
import ImportPage from "./ImportPage";
import CoverGallery from "./CoverGallery";
import UniverseView from "./UniverseView";
import MergeMediaModal from "./MergeMediaModal";
import MediaLibraryView from "./MediaLibraryView";
import PeopleView from "./PeopleView";
import PersonDetailPage from "./PersonDetailPage";
import { BOOK_TYPES, SCREEN_TYPES } from "@/lib/utils";
import { toast } from "./Toast";

type Tab = "log" | "wishlist" | "gallery" | "stats" | "import" | "library" | "media" | "people";

export interface SessionRow {
  id: number;
  seasonId: number;
  startDate: string;
  endDate: string | null;
  cinema: boolean | number;
  seasonNumber: number | null;
  seasonTitle: string | null;
  seasonCoverUrl: string | null;
  mediaId: number;
  mediaTitle: string;
  mediaOriginalTitle: string | null;
  mediaType: string;
  mediaCoverUrl: string | null;
  author: string | null;
  notes: string | null;
  tags: string | null;
  discontinued: boolean | number;
  universeId: number | null;
  universeName: string | null;
  tagList?: { id: number; name: string }[];
}

// Shape expected by Calendar and Statistics components
interface CalendarItem {
  id: number;
  mediaId?: number;
  title: string;
  author: string | null;
  mediaType: string;
  startDate: string;
  endDate: string | null;
  volumeEpisode: string | null;
  discontinued: boolean | null;
  cinema?: boolean | number | null;
  tagList?: { id: number; name: string }[];
  additionalSessions?: string | null;
}

function sessionToCalendarItem(s: SessionRow): CalendarItem {
  return {
    id: s.id,
    mediaId: s.mediaId,
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
  };
}

// Map raw snake_case API response to SessionRow
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapSession(raw: any): SessionRow {
  return {
    id: raw.id,
    seasonId: raw.season_id,
    startDate: raw.start_date,
    endDate: raw.end_date ?? null,
    cinema: raw.cinema,
    seasonNumber: raw.season_number ?? null,
    seasonTitle: raw.season_title ?? null,
    seasonCoverUrl: raw.season_cover_url ?? null,
    mediaId: raw.media_id,
    mediaTitle: raw.media_title,
    mediaOriginalTitle: raw.media_original_title ?? null,
    mediaType: raw.media_type,
    mediaCoverUrl: raw.media_cover_url ?? null,
    author: raw.author ?? null,
    notes: raw.notes ?? null,
    tags: raw.tags ?? null,
    discontinued: raw.discontinued,
    universeId: raw.universe_id ?? null,
    universeName: raw.universe_name ?? null,
    tagList: raw.tagList,
  };
}

type DrawerState = null | { type: "add"; startDate?: string; endDate?: string };

interface Props {
  initialYear: number;
}

const TAB_BUTTONS: { id: Tab; icon: string; tooltip: string }[] = [
  { id: "log", icon: "/icons/icons8-library-96.png", tooltip: "Dziennik" },
  { id: "library", icon: "/icons/icons8-books-96.png", tooltip: "Biblioteka" },
  { id: "media", icon: "/icons/icons8-tv-show-96.png", tooltip: "Media" },
  { id: "people", icon: "/icons/icons8-person-96.png", tooltip: "Ludzie" },
  { id: "wishlist", icon: "/icons/icons8-planner-96.png", tooltip: "Do obejrzenia" },
  { id: "gallery", icon: "/icons/icons8-movie-96.png", tooltip: "Galeria" },
  { id: "stats", icon: "/icons/icons8-combo-chart-96.png", tooltip: "Statystyki" },
  { id: "import", icon: "/icons/icons8-gear-96.png", tooltip: "Import / Eksport" },
];

export default function MainPage({ initialYear }: Props) {
  const router = useRouter();
  const openMedia = useCallback((mediaId: number) => router.push(`/media/${mediaId}`), [router]);

  const createSessionAndOpen = useCallback(async (mediaId: number, startDate: string, endDate: string) => {
    try {
      // Get or create first season
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

      const sessRes = await fetch("/api/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          season_id: seasonId,
          start_date: startDate,
          end_date: endDate !== startDate ? endDate : null,
        }),
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
  const [year, setYear] = useState(initialYear);
  const [items, setItems] = useState<SessionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [drawer, setDrawer] = useState<DrawerState>(null);
  const [pickerState, setPickerState] = useState<{ startDate: string; itemIds: number[] } | null>(null);
  const [activeTab, setActiveTab] = useState<Tab>("log");
  const [showMerge, setShowMerge] = useState(false);
  const [selectedPersonId, setSelectedPersonId] = useState<number | null>(null);

  const openPerson = useCallback((personId: number) => {
    setSelectedPersonId(personId);
    setActiveTab("people");
  }, []);

  const fetchData = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
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

  useEffect(() => { fetchData(); }, [fetchData]);

  const calendarItems = items.map(sessionToCalendarItem);
  const bookItems = calendarItems.filter((i) => BOOK_TYPES.includes(i.mediaType));
  const screenItems = calendarItems.filter((i) => SCREEN_TYPES.includes(i.mediaType));

  const handleDayClick = useCallback((startDate: string, endDate: string, _mediaType: "book" | "movie", itemIds: number[]) => {
    if (itemIds.length === 1) {
      const session = items.find((s) => s.id === itemIds[0]);
      if (session) { openMedia(session.mediaId); return; }
    }
    if (itemIds.length > 1) {
      setPickerState({ startDate, itemIds });
      return;
    }
    // Empty day — open add modal with selected dates
    setDrawer({ type: "add", startDate, endDate });
  }, [items, openMedia]);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between gap-4">
          {/* Logo + title */}
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 relative shrink-0">
              <Image src="/icons/icons8-home-144.png" alt="MediaLog" fill className="object-contain" sizes="36px" />
            </div>
            <h1 className="text-lg font-bold text-gray-900 hidden sm:block">MediaLog</h1>
          </div>

          {/* Tab icon buttons */}
          <nav className="flex items-center gap-1.5">
            {TAB_BUTTONS.map(({ id, icon, tooltip }) => (
              <div key={id} className="relative group">
                <button
                  onClick={() => { setActiveTab(id); if (id !== "people") setSelectedPersonId(null); }}
                  className={`w-10 h-10 flex items-center justify-center rounded-2xl border transition-all ${
                    activeTab === id
                      ? "bg-gray-100 border-gray-300 shadow-inner"
                      : "bg-white border-gray-100 shadow hover:shadow-md"
                  }`}
                  aria-label={tooltip}
                >
                  <Image src={icon} alt={tooltip} width={22} height={22} className="object-contain" />
                </button>
                <span className="absolute top-full left-1/2 -translate-x-1/2 mt-1.5 px-2 py-1 bg-gray-900 text-white text-xs rounded-lg whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50">
                  {tooltip}
                </span>
              </div>
            ))}
          </nav>

          {/* Right side controls */}
          <div className="flex items-center gap-2">
            {(activeTab === "log" || activeTab === "stats") && (
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setYear((y) => y - 1)}
                  className="w-8 h-8 flex items-center justify-center bg-white border border-gray-100 shadow rounded-xl hover:shadow-md transition-all text-gray-600"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                  </svg>
                </button>
                <span className="text-gray-900 font-semibold text-sm min-w-[3.5rem] text-center">{year}</span>
                <button
                  onClick={() => setYear((y) => y + 1)}
                  className="w-8 h-8 flex items-center justify-center bg-white border border-gray-100 shadow rounded-xl hover:shadow-md transition-all text-gray-600"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </button>
              </div>
            )}
            {/* Add button */}
            <div className="relative group">
              <button
                onClick={() => setDrawer({ type: "add" })}
                className="w-10 h-10 bg-gray-900 hover:bg-gray-700 rounded-2xl flex items-center justify-center shadow transition-all"
                aria-label="Dodaj wpis"
              >
                <Image src="/icons/icons8-plus-100.png" alt="Dodaj" width={20} height={20} className="object-contain brightness-0 invert" />
              </button>
              <span className="absolute top-full left-1/2 -translate-x-1/2 mt-1.5 px-2 py-1 bg-gray-900 text-white text-xs rounded-lg whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50">
                Dodaj wpis
              </span>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-6 space-y-6">
        {activeTab === "library" ? (
          <>
            <div className="flex justify-end">
              <button
                onClick={() => setShowMerge(true)}
                className="text-sm px-3 py-1.5 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 transition-colors"
              >
                🔗 Połącz tomy / odcinki
              </button>
            </div>
            <UniverseView onItemClick={openMedia} />
          </>
        ) : activeTab === "media" ? (
          <>
            <div className="flex justify-end">
              <button
                onClick={() => setShowMerge(true)}
                className="text-sm px-3 py-1.5 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 transition-colors"
              >
                🔗 Połącz / zgrupuj media
              </button>
            </div>
            <MediaLibraryView onOpenDetail={openMedia} />
          </>
        ) : activeTab === "people" ? (
          selectedPersonId ? (
            <PersonDetailPage
              personId={selectedPersonId}
              onBack={() => setSelectedPersonId(null)}
              onOpenMedia={openMedia}
            />
          ) : (
            <PeopleView onOpenPerson={(id) => setSelectedPersonId(id)} />
          )
        ) : activeTab === "wishlist" ? (
          <WishlistPage />
        ) : activeTab === "gallery" ? (
          <CoverGallery onItemClick={openMedia} />
        ) : activeTab === "stats" ? (
          <Statistics items={calendarItems} year={year} />
        ) : activeTab === "import" ? (
          <ImportPage />
        ) : (
          <>
            {loading ? (
              <div className="flex items-center justify-center py-16">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-400"></div>
              </div>
            ) : (
              <>
                <div>
                  <h2 className="text-base font-semibold text-gray-700 mb-3">🖼️ Okładki {year}</h2>
                  <CoverGallery
                    year={year}
                    onItemClick={openMedia}
                  />
                </div>
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
          </>
        )}
      </main>

      {drawer && drawer.type === "add" && (
        <AddMediaModal
          onClose={() => setDrawer(null)}
          initialStartDate={drawer.startDate}
          initialEndDate={drawer.endDate}
          onSelect={(mediaId, startDate, endDate) => {
            setDrawer(null);
            if (startDate && endDate) {
              void createSessionAndOpen(mediaId, startDate, endDate);
            } else {
              openMedia(mediaId);
            }
          }}
        />
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
      {showMerge && (
        <MergeMediaModal
          onClose={() => setShowMerge(false)}
          onSuccess={() => fetchData(true)}
        />
      )}
    </div>
  );
}
