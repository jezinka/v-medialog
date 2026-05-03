"use client";
import { useEffect, useState, useCallback } from "react";
import CoverImg from "./CoverImg";
import { MEDIA_TYPE_LABELS, MEDIA_TYPE_COLORS, MEDIA_TYPES } from "@/lib/utils";
import { toast } from "./Toast";

interface Universe {
  id: number;
  name: string;
  description: string | null;
  cover_url: string | null;
  media_count: number;
}

interface MediaItem {
  id: number;
  title: string;
  original_title: string | null;
  author: string | null;
  media_type: string;
  cover_url: string | null;
  universe_id: number | null;
  season_count: number;
  first_session_date: string | null;
}

interface Props {
  onItemClick: (mediaId: number) => void;
}

export default function UniverseView({ onItemClick }: Props) {
  const [universes, setUniverses] = useState<Universe[]>([]);
  const [selectedUniverseId, setSelectedUniverseId] = useState<number | null | "none">(null);
  const [mediaItems, setMediaItems] = useState<MediaItem[]>([]);
  const [loadingUniverses, setLoadingUniverses] = useState(true);
  const [loadingMedia, setLoadingMedia] = useState(false);

  // Create universe form
  const [showCreateUniverse, setShowCreateUniverse] = useState(false);
  const [newUniverseName, setNewUniverseName] = useState("");
  const [newUniverseDesc, setNewUniverseDesc] = useState("");
  const [savingUniverse, setSavingUniverse] = useState(false);

  // Create media form
  const [showCreateMedia, setShowCreateMedia] = useState(false);
  const [newMediaTitle, setNewMediaTitle] = useState("");
  const [newMediaType, setNewMediaType] = useState("movie");
  const [savingMedia, setSavingMedia] = useState(false);

  // Assign existing media form
  const [showAssignExisting, setShowAssignExisting] = useState(false);
  const [existingSearch, setExistingSearch] = useState("");
  const [allMedia, setAllMedia] = useState<MediaItem[]>([]);
  const [loadingAll, setLoadingAll] = useState(false);

  // Assign universe form (for orphan media)
  const [assigningMediaId, setAssigningMediaId] = useState<number | null>(null);
  const [assignUniverseId, setAssignUniverseId] = useState("");
  const fetchUniverses = useCallback(async () => {
    setLoadingUniverses(true);
    try {
      const res = await fetch("/api/universes");
      const data = await res.json();
      setUniverses(data);
    } catch {
      toast("Błąd pobierania uniwersów", "error");
    } finally {
      setLoadingUniverses(false);
    }
  }, []);

  const fetchMedia = useCallback(async (universeId: number | null | "none") => {
    setLoadingMedia(true);
    try {
      let url: string;
      if (universeId === "none") {
        url = "/api/media?no_universe=true";
      } else if (universeId != null) {
        url = `/api/media?universe_id=${universeId}`;
      } else {
        url = "/api/media?all=true";
      }
      const res = await fetch(url);
      const data = await res.json();
      setMediaItems(data);
    } catch {
      toast("Błąd pobierania mediów", "error");
    } finally {
      setLoadingMedia(false);
    }
  }, []);

  useEffect(() => { fetchUniverses(); }, [fetchUniverses]);

  useEffect(() => {
    if (selectedUniverseId !== null) {
      fetchMedia(selectedUniverseId);
    }
  }, [selectedUniverseId, fetchMedia]);

  const handleCreateUniverse = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUniverseName.trim()) return;
    setSavingUniverse(true);
    try {
      const res = await fetch("/api/universes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newUniverseName.trim(), description: newUniverseDesc.trim() || null }),
      });
      if (!res.ok) throw new Error();
      toast("Uniwersum utworzone!", "success");
      setNewUniverseName("");
      setNewUniverseDesc("");
      setShowCreateUniverse(false);
      fetchUniverses();
    } catch {
      toast("Błąd tworzenia", "error");
    } finally {
      setSavingUniverse(false);
    }
  };

  const handleCreateMedia = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMediaTitle.trim()) return;
    setSavingMedia(true);
    try {
      const universeId = selectedUniverseId !== null && selectedUniverseId !== "none"
        ? selectedUniverseId
        : null;
      const res = await fetch("/api/media", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: newMediaTitle.trim(),
          media_type: newMediaType,
          universe_id: universeId,
        }),
      });
      if (!res.ok) throw new Error();
      toast("Medium utworzone!", "success");
      setNewMediaTitle("");
      setShowCreateMedia(false);
      if (selectedUniverseId !== null) fetchMedia(selectedUniverseId);
      fetchUniverses();
    } catch {
      toast("Błąd tworzenia", "error");
    } finally {
      setSavingMedia(false);
    }
  };

  const handleAssignUniverse = async (mediaId: number) => {
    const uid = assignUniverseId ? parseInt(assignUniverseId) : null;
    try {
      const media = mediaItems.find((m) => m.id === mediaId);
      if (!media) return;
      const res = await fetch(`/api/media/${mediaId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: media.title,
          original_title: media.original_title ?? null,
          author: media.author ?? null,
          media_type: media.media_type,
          universe_id: uid,
        }),
      });
      if (!res.ok) throw new Error();
      toast("Przypisano do uniwersum!", "success");
      setAssigningMediaId(null);
      setAssignUniverseId("");
      if (selectedUniverseId !== null) fetchMedia(selectedUniverseId);
      fetchUniverses();
    } catch {
      toast("Błąd przypisywania", "error");
    }
  };

  const fetchAllMedia = async () => {
    setLoadingAll(true);
    try {
      const res = await fetch("/api/media?all=true");
      setAllMedia(await res.json());
    } finally {
      setLoadingAll(false);
    }
  };

  const handleOpenAssignExisting = () => {
    setShowAssignExisting(true);
    setExistingSearch("");
    fetchAllMedia();
  };

  const handleAssignExisting = async (mediaId: number) => {
    const media = allMedia.find((m) => m.id === mediaId);
    if (!media || typeof selectedUniverseId !== "number") return;
    const res = await fetch(`/api/media/${mediaId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: media.title,
        original_title: media.original_title ?? null,
        author: media.author ?? null,
        media_type: media.media_type,
        universe_id: selectedUniverseId,
      }),
    });
    if (res.ok) {
      toast("Przypisano!", "success");
      fetchMedia(selectedUniverseId);
      fetchUniverses();
      setAllMedia((prev) => prev.filter((m) => m.id !== mediaId));
    } else {
      toast("Błąd", "error");
    }
  };

  const handleRemoveFromUniverse = async (mediaId: number) => {    if (typeof selectedUniverseId !== "number") return;
    const res = await fetch(`/api/media/${mediaId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ universe_id: null }),
    });
    if (res.ok) {
      toast("Odłączono od uniwersum", "success");
      fetchMedia(selectedUniverseId);
      fetchUniverses();
    } else {
      toast("Błąd", "error");
    }
  };

  if (loadingUniverses) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-400" />
      </div>
    );
  }

  return (
    <div className="flex gap-6 min-h-[calc(100vh-160px)]">
      {/* Left panel: universes list */}
      <div className="w-64 shrink-0 space-y-2">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-gray-700">Uniwersa</h2>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowCreateUniverse(!showCreateUniverse)}
              className="text-xs text-blue-600 hover:text-blue-800 font-medium"
            >
              + Nowe
            </button>
          </div>
        </div>

        {/* Create universe form */}
        {showCreateUniverse && (
          <form onSubmit={handleCreateUniverse} className="bg-blue-50 rounded-xl p-3 space-y-2 mb-2">
            <input
              type="text"
              value={newUniverseName}
              onChange={(e) => setNewUniverseName(e.target.value)}
              placeholder="Nazwa *"
              className="w-full border border-blue-200 rounded-lg px-2 py-1.5 text-sm"
              required
            />
            <input
              type="text"
              value={newUniverseDesc}
              onChange={(e) => setNewUniverseDesc(e.target.value)}
              placeholder="Opis (opcjonalnie)"
              className="w-full border border-blue-200 rounded-lg px-2 py-1.5 text-sm"
            />
            <div className="flex gap-2">
              <button
                type="submit"
                disabled={savingUniverse}
                className="flex-1 bg-blue-600 text-white rounded-lg py-1.5 text-xs font-medium hover:bg-blue-700 disabled:opacity-50"
              >
                {savingUniverse ? "Tworzę..." : "Utwórz"}
              </button>
              <button
                type="button"
                onClick={() => setShowCreateUniverse(false)}
                className="px-3 py-1.5 bg-white border border-gray-200 rounded-lg text-xs text-gray-500 hover:bg-gray-50"
              >
                Anuluj
              </button>
            </div>
          </form>
        )}

        {/* "Wszystkie" entry */}
        <button
          onClick={() => { setSelectedUniverseId("none"); }}
          className={`w-full text-left px-3 py-2 rounded-xl text-sm transition-colors ${
            selectedUniverseId === "none" ? "bg-gray-900 text-white" : "bg-white hover:bg-gray-50 border border-gray-100 text-gray-700"
          }`}
        >
          <span className="font-medium">Bez przynależności</span>
        </button>

        {/* Universe items */}
        {universes.map((u) => (
          <button
            key={u.id}
            onClick={() => setSelectedUniverseId(u.id)}
            className={`w-full text-left px-3 py-2 rounded-xl text-sm transition-colors ${
              selectedUniverseId === u.id ? "bg-gray-900 text-white" : "bg-white hover:bg-gray-50 border border-gray-100 text-gray-700"
            }`}
          >
            <div className="font-medium truncate">{u.name}</div>
            <div className={`text-xs ${selectedUniverseId === u.id ? "text-gray-300" : "text-gray-400"}`}>
              {u.media_count} mediów
            </div>
          </button>
        ))}
      </div>

      {/* Right panel: media grid */}
      <div className="flex-1 min-w-0">
        {selectedUniverseId === null ? (
          <div className="flex items-center justify-center h-full text-gray-400 text-sm">
            Wybierz uniwersum z listy po lewej
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-semibold text-gray-700">
                {selectedUniverseId === "none"
                  ? "Bez przynależności"
                  : universes.find((u) => u.id === selectedUniverseId)?.name ?? ""}
                <span className="ml-2 text-gray-400 font-normal">({mediaItems.length})</span>
              </h2>
              {typeof selectedUniverseId === "number" && (
                <div className="flex gap-2">
                  <button
                    onClick={handleOpenAssignExisting}
                    className="text-xs text-gray-500 hover:text-gray-700 font-medium"
                  >
                    + Dodaj istniejące
                  </button>
                  <button
                    onClick={() => setShowCreateMedia(!showCreateMedia)}
                    className="text-xs text-blue-600 hover:text-blue-800 font-medium"
                  >
                    + Nowe medium
                  </button>
                </div>
              )}
              {selectedUniverseId === "none" && (
                <button
                  onClick={() => setShowCreateMedia(!showCreateMedia)}
                  className="text-xs text-blue-600 hover:text-blue-800 font-medium"
                >
                  + Nowe medium
                </button>
              )}
            </div>

            {/* Assign existing media panel */}
            {showAssignExisting && typeof selectedUniverseId === "number" && (
              <div className="bg-amber-50 rounded-xl p-3 space-y-2 mb-4 border border-amber-200">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-medium text-amber-800">Dodaj istniejące medium</p>
                  <button onClick={() => setShowAssignExisting(false)} className="text-amber-400 hover:text-amber-600 text-sm">✕</button>
                </div>
                <input
                  type="text"
                  value={existingSearch}
                  onChange={(e) => setExistingSearch(e.target.value)}
                  placeholder="Szukaj po tytule..."
                  className="w-full border border-amber-200 rounded-lg px-2 py-1.5 text-sm bg-white"
                  autoFocus
                />
                <div className="max-h-48 overflow-y-auto space-y-1">
                  {loadingAll ? (
                    <p className="text-xs text-amber-600 text-center py-2">Wczytywanie...</p>
                  ) : allMedia
                    .filter((m) => m.universe_id !== selectedUniverseId &&
                      (m.title.toLowerCase().includes(existingSearch.toLowerCase()) ||
                       (m.original_title?.toLowerCase().includes(existingSearch.toLowerCase()) ?? false)))
                    .slice(0, 20)
                    .map((m) => (
                      <button
                        key={m.id}
                        onClick={() => handleAssignExisting(m.id)}
                        className="w-full text-left flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-amber-100 transition-colors"
                      >
                        <span className="text-xs font-medium text-gray-800 truncate flex-1">{m.title}</span>
                        <span className="text-[10px] text-gray-400 shrink-0">{m.media_type}</span>
                        <span className="text-[10px] text-amber-600 shrink-0">+ Dodaj</span>
                      </button>
                    ))
                  }
                </div>
              </div>
            )}

            {/* Create media form */}
            {showCreateMedia && (
              <form onSubmit={handleCreateMedia} className="bg-green-50 rounded-xl p-3 space-y-2 mb-4">
                <input
                  type="text"
                  value={newMediaTitle}
                  onChange={(e) => setNewMediaTitle(e.target.value)}
                  placeholder="Tytuł *"
                  className="w-full border border-green-200 rounded-lg px-2 py-1.5 text-sm"
                  required
                />
                <select
                  value={newMediaType}
                  onChange={(e) => setNewMediaType(e.target.value)}
                  className="w-full border border-green-200 rounded-lg px-2 py-1.5 text-sm"
                >
                  {MEDIA_TYPES.map((t) => (
                    <option key={t} value={t}>{MEDIA_TYPE_LABELS[t] ?? t}</option>
                  ))}
                </select>
                <div className="flex gap-2">
                  <button
                    type="submit"
                    disabled={savingMedia}
                    className="flex-1 bg-green-600 text-white rounded-lg py-1.5 text-xs font-medium hover:bg-green-700 disabled:opacity-50"
                  >
                    {savingMedia ? "Tworzę..." : "Utwórz"}
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowCreateMedia(false)}
                    className="px-3 py-1.5 bg-white border border-gray-200 rounded-lg text-xs text-gray-500 hover:bg-gray-50"
                  >
                    Anuluj
                  </button>
                </div>
              </form>
            )}

            {loadingMedia ? (
              <div className="flex items-center justify-center py-12">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-gray-400" />
              </div>
            ) : mediaItems.length === 0 ? (
              <div className="flex items-center justify-center py-12 text-gray-400 text-sm">
                Brak mediów w tej grupie
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
                {mediaItems.map((media) => {
                  const typeColor = MEDIA_TYPE_COLORS[media.media_type] || "bg-gray-100 text-gray-700";
                  return (
                    <div key={media.id} className="bg-white rounded-xl border border-gray-100 shadow-sm hover:shadow-md transition-shadow overflow-hidden group">
                      {/* Cover */}
                      <a
                        className="aspect-[2/3] bg-gray-100 relative cursor-pointer overflow-hidden block"
                        href={`/media/${media.id}`}
                      >
                        {media.cover_url ? (
                          <CoverImg
                            src={media.cover_url}
                            alt={media.title}
                            fill
                            className="object-cover group-hover:scale-105 transition-transform duration-200"
                            sizes="(max-width: 640px) 50vw, (max-width: 768px) 33vw, 20vw"
                          />
                        ) : (
                          <div className="absolute inset-0 flex items-center justify-center text-gray-300 text-4xl">📄</div>
                        )}
                      </a>
                      {/* Info */}
                      <div className="p-2 space-y-1">
                        <a
                          href={`/media/${media.id}`}
                          className="text-xs font-medium text-gray-900 leading-tight line-clamp-2 text-left w-full hover:text-blue-600 block"
                        >
                          {media.title}
                        </a>
                        <span className={`inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-medium ${typeColor}`}>
                          {MEDIA_TYPE_LABELS[media.media_type] || media.media_type}
                        </span>
                        {media.author && (
                          <div className="text-[10px] text-gray-400 truncate">{media.author}</div>
                        )}
                        <div className="text-[10px] text-gray-400">
                          {media.season_count} sez.
                          {media.first_session_date && ` · ${media.first_session_date.slice(0, 4)}`}
                        </div>
                        {/* Assign to universe (shown for media without universe) */}
                        {selectedUniverseId === "none" && (
                          <>
                            {assigningMediaId === media.id ? (
                              <div className="flex gap-1 mt-1">
                                <select
                                  value={assignUniverseId}
                                  onChange={(e) => setAssignUniverseId(e.target.value)}
                                  className="flex-1 border border-gray-200 rounded text-[10px] px-1 py-0.5"
                                >
                                  <option value="">— wybierz —</option>
                                  {universes.map((u) => (
                                        <option key={u.id} value={u.id}>{u.name}</option>
                                  ))}
                                </select>
                                <button
                                  onClick={() => handleAssignUniverse(media.id)}
                                  disabled={!assignUniverseId}
                                  className="px-1.5 py-0.5 bg-blue-600 text-white rounded text-[10px] disabled:opacity-40"
                                >
                                  ✓
                                </button>
                                <button
                                  onClick={() => { setAssigningMediaId(null); setAssignUniverseId(""); }}
                                  className="px-1.5 py-0.5 bg-gray-100 rounded text-[10px]"
                                >
                                  ✕
                                </button>
                              </div>
                            ) : (
                              <button
                                onClick={() => setAssigningMediaId(media.id)}
                                className="text-[10px] text-blue-500 hover:text-blue-700 mt-0.5"
                              >
                                + Przypisz do Uniwersum
                              </button>
                            )}
                          </>
                        )}
                        {/* Remove from universe button */}
                        {typeof selectedUniverseId === "number" && (
                          <button
                            onClick={() => handleRemoveFromUniverse(media.id)}
                            className="text-[10px] text-red-400 hover:text-red-600 mt-0.5 block"
                          >
                            ✕ Odłącz od uniwersum
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
