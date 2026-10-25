"use client";
import { useEffect, useState, useCallback, useMemo } from "react";
import { buildSessionDaysMap } from "@/lib/calendar-days";
import EditMediaModal from "./item-detail/EditMediaModal";
import EditSeasonModal from "./item-detail/EditSeasonModal";
import ItemHeader from "./item-detail/ItemHeader";
import ItemHero from "./item-detail/ItemHero";
import UniversePanel from "./item-detail/UniversePanel";
import AirDatesPanel from "./item-detail/AirDatesPanel";
import PodcastEpisodesPanel from "./item-detail/PodcastEpisodesPanel";
import SeasonsSection from "./item-detail/SeasonsSection";
import CastSection from "./item-detail/CastSection";
import VodSection from "./item-detail/VodSection";
import SessionCalendarSection from "./item-detail/SessionCalendarSection";
import { SyncButtons, SyncCandidates } from "./item-detail/ExternalSync";
import { useExternalData } from "./item-detail/useExternalData";
import { partLabels } from "./item-detail/part-labels";
import type { MediaData, SessionApiRow, SeasonRow } from "./item-detail/types";
import { toast } from "./Toast";

interface Props {
  mediaId: number;
  onClose?: () => void;
  onRefresh?: () => void;
  onOpenPerson?: (personId: number) => void;
  onOpenDetail?: (mediaId: number) => void;
}

export default function ItemDetailPage({ mediaId, onClose, onRefresh, onOpenPerson, onOpenDetail }: Props) {
  const [media, setMedia] = useState<MediaData | null>(null);
  const [sessions, setSessions] = useState<SessionApiRow[]>([]);
  const [seasons, setSeasons] = useState<SeasonRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [isEditingMedia, setIsEditingMedia] = useState(false);
  const [editingSeason, setEditingSeason] = useState<SeasonRow | null>(null);

  const loadData = useCallback(async () => {
    try {
      const [mediaRes, sessionsRes, seasonsRes] = await Promise.all([
        fetch(`/api/media/${mediaId}`),
        fetch(`/api/sessions?media_id=${mediaId}`),
        fetch(`/api/seasons?media_id=${mediaId}`),
      ]);
      const [mediaData, sessionsData, seasonsData] = await Promise.all([
        mediaRes.ok ? mediaRes.json() : null,
        sessionsRes.ok ? sessionsRes.json() : [],
        seasonsRes.ok ? seasonsRes.json() : [],
      ]);
      if (mediaData) setMedia(mediaData as MediaData);
      if (Array.isArray(sessionsData)) setSessions(sessionsData as SessionApiRow[]);
      if (Array.isArray(seasonsData)) setSeasons(seasonsData as SeasonRow[]);
    } catch {
      toast("Błąd ładowania danych", "error");
    } finally {
      setLoading(false);
    }
  }, [mediaId]);

  // After an edit: refresh this page and whatever list opened it
  const reload = useCallback(async () => {
    await loadData();
    onRefresh?.();
  }, [loadData, onRefresh]);

  const onCoverChange = useCallback((path: string) => {
    setMedia((prev) => prev ? { ...prev, cover_url: path } : prev);
    onRefresh?.();
  }, [onRefresh]);
  const sync = useExternalData(mediaId, media, onCoverChange);
  const cachedData = sync.cachedData;

  useEffect(() => {
    const init = async () => {
      await loadData();
      // Pass media via ref to avoid stale closure
    };
    init();
  }, [loadData]);

  const sessionDaysMap = useMemo(
    () => buildSessionDaysMap(sessions, seasons),
    [sessions, seasons]
  );

  const handleDeleteMedia = async () => {
    if (!media) return;
    if (!confirm(`Usunąć "${media.title}"? Operacja jest nieodwracalna.`)) return;
    const res = await fetch(`/api/media/${media.id}`, { method: "DELETE" });
    if (res.ok) {
      toast("Medium usunięte ✓", "success");
      onRefresh?.();
      onClose?.();
    } else {
      toast("Błąd usuwania", "error");
    }
  };

  const actors = cachedData?.persons.filter((p) => p.role === "actor") ?? [];

  if (loading) {
    return (
      <div className="fixed inset-0 z-50 overflow-y-auto bg-white flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-sm text-gray-500">Ładowanie...</p>
        </div>
      </div>
    );
  }

  if (!media) {
    return (
      <div className="fixed inset-0 z-50 overflow-y-auto bg-white flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-500 mb-4">Nie znaleziono pozycji</p>
          <button onClick={() => onClose?.()} className="text-sm text-blue-600 hover:underline">
            Wróć
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-white">
      {/* Edit media modal */}
      {isEditingMedia && (
        <EditMediaModal media={media} onClose={() => setIsEditingMedia(false)} onSaved={reload} />
      )}

      {/* Edit season modal */}
      {editingSeason && (
        <EditSeasonModal season={editingSeason} partLabel={partLabels(media.media_type).partLabel} onClose={() => setEditingSeason(null)} onSaved={reload} />
      )}

      <ItemHeader media={media} onClose={onClose} onEdit={() => setIsEditingMedia(true)} onDelete={() => void handleDeleteMedia()} />

      <div className="max-w-3xl mx-auto px-4 py-6 space-y-8">
        <ItemHero media={media} cachedData={cachedData} onOpenPerson={onOpenPerson}>
          <UniversePanel media={media} onOpenDetail={onOpenDetail} onChanged={loadData} />
        </ItemHero>

        {/* Episodic types only (a movie's tmdb_id is not a TV id) */}
        {["series", "anime"].includes(media.media_type) && (
          <AirDatesPanel media={media} seasons={seasons} sessionDaysMap={sessionDaysMap} onChanged={reload} />
        )}

        {media.media_type === "podcast" && (
          <PodcastEpisodesPanel mediaId={media.id} seasons={seasons} sessionDaysMap={sessionDaysMap} onImported={reload} />
        )}

        <SeasonsSection media={media} seasons={seasons} onEditSeason={setEditingSeason} onChanged={reload} onWantToWatchChanged={loadData} />

        <CastSection actors={actors} onOpenPerson={onOpenPerson} />

        {["movie", "series", "anime", "cartoon"].includes(media.media_type) && <VodSection media={media} />}

        <SessionCalendarSection
          media={media}
          sessions={sessions}
          seasons={seasons}
          sessionDaysMap={sessionDaysMap}
          loadData={loadData}
          onChanged={reload}
          actions={<SyncButtons media={media} sync={sync} />}
        >
          <SyncCandidates sync={sync} />
        </SessionCalendarSection>
      </div>
    </div>
  );
}
