"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import Image from "next/image";
import AddMediaModal from "./AddMediaModal";
import { toast } from "./Toast";

type VodNotification = {
  id: number;
  item_type: string;
  item_id: number;
  item_title: string;
  event_type: "added" | "leaving";
  provider_name: string;
  provider_logo: string | null;
  url: string | null;
  created_at: string;
};

const TAB_BUTTONS = [
  { path: "/", icon: "/icons/icons8-library-96.png", tooltip: "Dziennik" },
  { path: "/media", icon: "/icons/icons8-tv-show-96.png", tooltip: "Media" },
  { path: "/people", icon: "/icons/icons8-person-96.png", tooltip: "Ludzie" },
  { path: "/wishlist", icon: "/icons/icons8-planner-96.png", tooltip: "Do obejrzenia" },
  { path: "/calendar", icon: "/icons/icons8-calendar-96.png", tooltip: "Kalendarz" },
  { path: "/stats", icon: "/icons/icons8-combo-chart-96.png", tooltip: "Statystyki" },
  { path: "/import", icon: "/icons/icons8-gear-96.png", tooltip: "Import / Eksport" },
];

const YEAR_TABS = ["/", "/stats"];

export default function NavHeader() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const yearParam = searchParams.get("year");
  const year = yearParam ? parseInt(yearParam) : new Date().getFullYear();

  const [showAdd, setShowAdd] = useState(false);
  const [notifications, setNotifications] = useState<VodNotification[]>([]);
  const [showBell, setShowBell] = useState(false);
  const bellRef = useRef<HTMLDivElement>(null);

  const fetchNotifications = useCallback(async () => {
    try {
      const res = await fetch("/api/vod/notifications");
      if (res.ok) setNotifications(await res.json() as VodNotification[]);
    } catch { /* silent */ }
  }, []);

  useEffect(() => {
    void fetchNotifications();
    const id = setInterval(() => void fetchNotifications(), 60_000);
    return () => clearInterval(id);
  }, [fetchNotifications]);

  // Close panel on outside click
  useEffect(() => {
    if (!showBell) return;
    const handler = (e: MouseEvent) => {
      if (bellRef.current && !bellRef.current.contains(e.target as Node)) {
        setShowBell(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [showBell]);

  const markAllSeen = async () => {
    const ids = notifications.map((n) => n.id);
    if (ids.length === 0) return;
    await fetch("/api/vod/notifications/seen", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids }),
    });
    setNotifications([]);
  };

  const isActive = (path: string) => {
    if (path === "/") return pathname === "/";
    return pathname === path || pathname.startsWith(path + "/");
  };

  const openMedia = useCallback((mediaId: number) => router.push(`/media/${mediaId}`), [router]);

  const setYear = (newYear: number) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("year", String(newYear));
    router.push(`${pathname}?${params}`);
  };

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

  const showYearSelector = YEAR_TABS.includes(pathname);

  return (
    <>
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
            {TAB_BUTTONS.map(({ path, icon, tooltip }) => (
              <div key={path} className="relative group">
                <button
                  onClick={() => router.push(path)}
                  className={`w-10 h-10 flex items-center justify-center rounded-2xl border transition-all ${
                    isActive(path)
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
            {showYearSelector && (
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setYear(year - 1)}
                  className="w-8 h-8 flex items-center justify-center bg-white border border-gray-100 shadow rounded-xl hover:shadow-md transition-all text-gray-600"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                  </svg>
                </button>
                <span className="text-gray-900 font-semibold text-sm min-w-[3.5rem] text-center">{year}</span>
                <button
                  onClick={() => setYear(year + 1)}
                  className="w-8 h-8 flex items-center justify-center bg-white border border-gray-100 shadow rounded-xl hover:shadow-md transition-all text-gray-600"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </button>
              </div>
            )}
            {/* VOD notifications bell */}
            <div ref={bellRef} className="relative">
              <div onClick={() => setShowBell((v) => !v)}>
                <div className="relative group">
                  <button
                    className="w-10 h-10 flex items-center justify-center bg-white border border-gray-100 shadow rounded-2xl hover:shadow-md transition-all relative"
                    aria-label="Powiadomienia VOD"
                  >
                    <svg className="w-5 h-5 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                        d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                    </svg>
                    {notifications.length > 0 && (
                      <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] font-bold rounded-full min-w-[16px] h-4 flex items-center justify-center px-1">
                        {notifications.length > 99 ? "99+" : notifications.length}
                      </span>
                    )}
                  </button>
                  <span className="absolute top-full left-1/2 -translate-x-1/2 mt-1.5 px-2 py-1 bg-gray-900 text-white text-xs rounded-lg whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50">
                    Powiadomienia VOD
                  </span>
                </div>
              </div>

              {showBell && (
                <div className="absolute right-0 top-full mt-2 w-80 bg-white rounded-2xl shadow-xl border border-gray-200 z-50 overflow-hidden">
                  <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
                    <span className="font-semibold text-gray-900 text-sm">Powiadomienia VOD</span>
                    {notifications.length > 0 && (
                      <button onClick={markAllSeen} className="text-xs text-blue-600 hover:underline">
                        Oznacz wszystkie
                      </button>
                    )}
                  </div>
                  <div className="max-h-96 overflow-y-auto divide-y divide-gray-50">
                    {notifications.length === 0 ? (
                      <p className="text-sm text-gray-500 text-center py-6">Brak nowych powiadomień</p>
                    ) : (
                      notifications.map((n) => (
                        <div key={n.id} className="flex items-start gap-3 px-4 py-3 hover:bg-gray-50">
                          {n.provider_logo && (
                            <img src={n.provider_logo} alt={n.provider_name} className="w-8 h-8 rounded object-contain shrink-0 mt-0.5" />
                          )}
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-semibold text-gray-900 truncate">{n.item_title}</p>
                            <p className="text-xs text-gray-500 mt-0.5">
                              {n.event_type === "added"
                                ? `Dostępne na ${n.provider_name}`
                                : `Znika z ${n.provider_name}`}
                            </p>
                          </div>
                          <div className="flex flex-col items-end gap-1 shrink-0">
                            {n.url && (
                              <a href={n.url} target="_blank" rel="noopener noreferrer"
                                className="text-[10px] text-blue-600 hover:underline">
                                Otwórz
                              </a>
                            )}
                            <button
                              onClick={async () => {
                                await fetch("/api/vod/notifications/seen", {
                                  method: "POST",
                                  headers: { "Content-Type": "application/json" },
                                  body: JSON.stringify({ ids: [n.id] }),
                                });
                                setNotifications((prev) => prev.filter((x) => x.id !== n.id));
                              }}
                              className="text-[10px] text-gray-400 hover:text-gray-600"
                            >
                              ✕
                            </button>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Add button */}
            <div className="relative group">
              <button
                onClick={() => setShowAdd(true)}
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

      {showAdd && (
        <AddMediaModal
          onClose={() => setShowAdd(false)}
          onSelect={(mediaId, startDate, endDate) => {
            setShowAdd(false);
            if (startDate && endDate) {
              void createSessionAndOpen(mediaId, startDate, endDate);
            } else {
              openMedia(mediaId);
            }
          }}
        />
      )}
    </>
  );
}
