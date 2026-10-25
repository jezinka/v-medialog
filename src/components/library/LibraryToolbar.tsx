import type { Dispatch, SetStateAction } from "react";
import { MEDIA_TYPE_EMOJI, MEDIA_TYPE_LABELS } from "@/lib/utils";
import { TYPE_FILTERS } from "./types";
import type { SortBy, TypeFilter } from "./types";

type BoolSetter = Dispatch<SetStateAction<boolean>>;

interface LibraryToolbarProps {
  search: string;
  setSearch: (v: string) => void;
  typeFilter: TypeFilter;
  setTypeFilter: (t: TypeFilter) => void;
  noCoverOnly: boolean;
  setNoCoverOnly: BoolSetter;
  ongoingOnly: boolean;
  setOngoingOnly: BoolSetter;
  behindOnly: boolean;
  setBehindOnly: BoolSetter;
  hideDiscontinued: boolean;
  setHideDiscontinued: BoolSetter;
  withChildOnly: boolean;
  setWithChildOnly: BoolSetter;
  cinemaOnly: boolean;
  setCinemaOnly: BoolSetter;
  sortBy: SortBy;
  setSortBy: (s: SortBy) => void;
  total: number;
  showSuggestions: boolean;
  handleToggleSuggestions: () => void;
  checkingUpcoming: boolean;
  handleCheckUpcoming: () => void;
  selectedCount: number;
  deleting: boolean;
  deleteSelected: () => void;
}

export default function LibraryToolbar({
  search, setSearch, typeFilter, setTypeFilter,
  noCoverOnly, setNoCoverOnly, ongoingOnly, setOngoingOnly, behindOnly, setBehindOnly,
  hideDiscontinued, setHideDiscontinued, withChildOnly, setWithChildOnly, cinemaOnly, setCinemaOnly,
  sortBy, setSortBy, total, showSuggestions, handleToggleSuggestions,
  checkingUpcoming, handleCheckUpcoming, selectedCount, deleting, deleteSelected,
}: LibraryToolbarProps) {
  return (
  <div className="flex flex-wrap items-center gap-3">
    <input
      type="search"
      value={search}
      onChange={(e) => setSearch(e.target.value)}
      placeholder="Szukaj…"
      className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm w-56 focus:ring-2 focus:ring-purple-400 focus:outline-none"
    />
    <div className="flex gap-1 flex-wrap">
      {TYPE_FILTERS.map((t) => (
        <button
          key={t}
          onClick={() => setTypeFilter(t)}
          className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${
            typeFilter === t
              ? "bg-purple-600 text-white border-purple-600"
              : "border-gray-300 text-gray-600 hover:border-gray-400"
          }`}
        >
          {t === "all" ? "Wszystkie" : `${MEDIA_TYPE_EMOJI[t] ?? ""} ${MEDIA_TYPE_LABELS[t] ?? t}`}
        </button>
      ))}
      <button
        onClick={() => setNoCoverOnly((v) => !v)}
        className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${
          noCoverOnly
            ? "bg-orange-500 text-white border-orange-500"
            : "border-gray-300 text-gray-600 hover:border-gray-400"
        }`}
      >
        🖼️ Brak okładki
      </button>
      <button
        onClick={() => setOngoingOnly((v) => !v)}
        className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${
          ongoingOnly
            ? "bg-green-600 text-white border-green-600"
            : "border-gray-300 text-gray-600 hover:border-gray-400"
        }`}
      >
        📺 Trwające
      </button>
      <button
        onClick={() => setBehindOnly((v) => !v)}
        className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${
          behindOnly
            ? "bg-yellow-500 text-white border-yellow-500"
            : "border-gray-300 text-gray-600 hover:border-gray-400"
        }`}
      >
        ⏳ Niedokończone
      </button>
      <button
        onClick={() => setHideDiscontinued((v) => !v)}
        className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${
          hideDiscontinued
            ? "bg-red-600 text-white border-red-600"
            : "border-red-300 text-red-700 hover:border-red-400"
        }`}
      >
        🚫 Ukryj porzucone
      </button>
      <button
        onClick={() => setWithChildOnly((v) => !v)}
        className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${
          withChildOnly
            ? "bg-emerald-700 text-white border-emerald-700"
            : "border-emerald-300 text-emerald-700 hover:border-emerald-400"
        }`}
      >
        👶 Z dzieckiem
      </button>
      <button
        onClick={() => setCinemaOnly((v) => !v)}
        className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${
          cinemaOnly
            ? "bg-amber-600 text-white border-amber-600"
            : "border-amber-300 text-amber-700 hover:border-amber-400"
        }`}
      >
        🎟️ W kinie
      </button>
    </div>
    <span className="text-sm text-gray-500 ml-auto">{total} mediów</span>
    <div className="flex items-center gap-1 text-xs text-gray-500">
      <span>Sortuj:</span>
      <button
        onClick={() => setSortBy("title")}
        className={`px-2 py-1 rounded-full border transition-colors ${
          sortBy === "title"
            ? "bg-gray-700 text-white border-gray-700"
            : "border-gray-300 text-gray-600 hover:border-gray-400"
        }`}
      >
        A–Z
      </button>
      <button
        onClick={() => setSortBy("recently_added")}
        className={`px-2 py-1 rounded-full border transition-colors ${
          sortBy === "recently_added"
            ? "bg-gray-700 text-white border-gray-700"
            : "border-gray-300 text-gray-600 hover:border-gray-400"
        }`}
      >
        🆕 Ostatnio dodane
      </button>
      <button
        onClick={() => setSortBy("last_session")}
        className={`px-2 py-1 rounded-full border transition-colors ${
          sortBy === "last_session"
            ? "bg-gray-700 text-white border-gray-700"
            : "border-gray-300 text-gray-600 hover:border-gray-400"
        }`}
      >
        📅 Ostatnio oglądane/czytane
      </button>
    </div>
    <button
      onClick={handleToggleSuggestions}
      title="Sugestie scalania"
      className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${
        showSuggestions
          ? "bg-amber-500 text-white border-amber-500"
          : "border-amber-300 text-amber-600 hover:border-amber-400"
      }`}
    >
      💡 Sugestie scalania
    </button>
    <button
      onClick={handleCheckUpcoming}
      disabled={checkingUpcoming}
      title="Sprawdź nowe sezony w TMDB"
      className="text-xs px-2.5 py-1 rounded-full border border-blue-300 text-blue-600 hover:border-blue-400 transition-colors disabled:opacity-50"
    >
      {checkingUpcoming ? "⏳ Sprawdzam…" : "📡 Nowe sezony"}
    </button>
    {selectedCount > 0 && (
      <button
        onClick={deleteSelected}
        disabled={deleting}
        className="text-xs px-3 py-1.5 rounded bg-red-600 text-white hover:bg-red-700 disabled:opacity-50"
      >
        {deleting ? "Usuwanie…" : `🗑️ Usuń zaznaczone (${selectedCount})`}
      </button>
    )}
  </div>
  );
}
