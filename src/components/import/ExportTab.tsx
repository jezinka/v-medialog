"use client";
import React from "react";

export default function ExportTab() {
  const [wiping, setWiping] = React.useState(false);
  const [wiped, setWiped] = React.useState(false);

  const MEDIA_TYPE_OPTIONS = [
    { value: "book",    label: "Książki" },
    { value: "comic",   label: "Komiksy" },
    { value: "movie",   label: "Filmy" },
    { value: "series",  label: "Seriale" },
    { value: "anime",   label: "Anime" },
    { value: "cartoon", label: "Kreskówki" },
  ];
  const ALL_VALUES = MEDIA_TYPE_OPTIONS.map((o) => o.value);

  const [selectedTypes, setSelectedTypes] = React.useState<string[]>(ALL_VALUES);

  const toggleType = (value: string) => {
    setSelectedTypes((prev) =>
      prev.includes(value) ? prev.filter((v) => v !== value) : [...prev, value]
    );
  };

  const handleExportMedia = () => {
    const types = selectedTypes.length === ALL_VALUES.length ? "" : `?types=${selectedTypes.join(",")}`;
    window.location.href = `/api/export/media${types}`;
  };

  const handleWipe = async () => {
    if (!confirm("⚠️ Czy na pewno chcesz usunąć WSZYSTKIE dane?\n\nUsunięte zostanie:\n• Wszystkie media, sezony, sesje\n• Wszystkie okładki\n• Osoby, tagi, wszechświaty\n\nTej operacji NIE MOŻNA cofnąć!")) return;
    if (!confirm("Ostatnie ostrzeżenie — czy pobrałeś kopię bazy danych?\nKliknij OK żeby usunąć wszystko.")) return;
    setWiping(true);
    try {
      const res = await fetch("/api/wipe", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setWiped(true);
    } catch (e) {
      alert("Błąd podczas czyszczenia: " + (e instanceof Error ? e.message : String(e)));
    } finally {
      setWiping(false);
    }
  };

  return (
    <div className="space-y-4">
      <p className="text-sm text-gray-600">
        Eksportuj swoje dane do pliku CSV. Plik można otworzyć w Excelu, LibreOffice Calc lub zaimportować ponownie.
      </p>

      {/* Media type filter */}
      <div className="border border-gray-200 rounded-xl p-4 space-y-3 bg-gray-50">
        <p className="text-sm font-medium text-gray-700">Filtr kategorii — dziennik mediów</p>
        <div className="flex flex-wrap gap-2">
          {MEDIA_TYPE_OPTIONS.map((opt) => (
            <label key={opt.value} className="flex items-center gap-1.5 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={selectedTypes.includes(opt.value)}
                onChange={() => toggleType(opt.value)}
                className="w-4 h-4 rounded border-gray-300 accent-purple-600"
              />
              <span className="text-sm text-gray-700">{opt.label}</span>
            </label>
          ))}
          <button
            onClick={() => setSelectedTypes(selectedTypes.length === ALL_VALUES.length ? [] : ALL_VALUES)}
            className="text-xs text-gray-400 hover:text-gray-600 underline ml-1"
          >
            {selectedTypes.length === ALL_VALUES.length ? "Odznacz wszystkie" : "Zaznacz wszystkie"}
          </button>
        </div>
        <button
          onClick={handleExportMedia}
          disabled={selectedTypes.length === 0}
          className="flex items-center gap-2 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white px-5 py-2.5 rounded-lg text-sm font-medium transition-colors"
        >
          ⬇ Eksportuj dziennik (CSV)
        </button>
      </div>

      <div className="flex flex-col sm:flex-row gap-3 flex-wrap">
        <button
          onClick={() => { window.location.href = "/api/export/wishlist"; }}
          className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2.5 rounded-lg text-sm font-medium transition-colors"
        >
          ⬇ Eksportuj listę życzeń (CSV)
        </button>
        <button
          onClick={() => { window.location.href = "/api/export/db"; }}
          className="flex items-center gap-2 bg-gray-700 hover:bg-gray-800 text-white px-5 py-2.5 rounded-lg text-sm font-medium transition-colors"
        >
          🗄️ Pobierz bazę danych (.db)
        </button>
      </div>
      <div className="mt-4 p-4 bg-gray-50 rounded-lg text-xs text-gray-600 space-y-1">
        <p className="font-medium text-gray-700">Format CSV — dziennik mediów:</p>
        <code className="block font-mono">title,original_title,author,media_type,start_date,end_date,volume_episode,tags,notes,discontinued,cover_url,cinema,season,tmdb_id,release_year</code>
        <p className="font-medium text-gray-700 mt-2">Format CSV — lista życzeń:</p>
        <code className="block font-mono">title,author,media_type,priority,notes,cover_url,release_year</code>
        <p className="mt-2">Dozwolone typy mediów: book, comic, movie, series, anime, cartoon</p>
        <p>Priorytety: high, normal, low</p>
      </div>

      <div className="mt-6 border border-red-200 rounded-lg p-4 bg-red-50">
        <p className="text-sm font-semibold text-red-700 mb-1">⚠️ Niebezpieczna strefa</p>
        <p className="text-xs text-red-600 mb-3">Operacje nieodwracalne.</p>
        <div className="space-y-2">
          {wiped ? (
            <p className="text-sm text-green-700 font-medium">✅ Baza wyczyszczona. Odśwież stronę.</p>
          ) : (
            <button
              onClick={handleWipe}
              disabled={wiping}
              className="flex items-center gap-2 bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
            >
              {wiping ? "Czyszczę..." : "🗑️ Wyczyść całą bazę danych"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
