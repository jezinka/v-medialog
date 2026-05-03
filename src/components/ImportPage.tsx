"use client";
import React, { useState, useRef, useCallback } from "react";

type ImportType = "media" | "wishlist";
type TabType = "import" | "export" | "sync";
type Step = "upload" | "preview" | "result";

interface MediaPreviewRow {
  title: string;
  original_title: string;
  author: string;
  media_type: string;
  start_date: string;
  end_date: string;
  volume_episode: string;
  tags: string;
  notes: string;
  discontinued: string;
  cover_url: string;
  cinema: string;
  additional_sessions: string;
}

function isYearPlaceholder(item: ValidItem): boolean {
  const d = item.data as MediaPreviewRow;
  if (!d.start_date || !d.end_date) return false;
  return /^\d{4}-01-01$/.test(d.start_date) && /^\d{4}-12-31$/.test(d.end_date) && d.start_date.slice(0, 4) === d.end_date.slice(0, 4);
}

interface WishlistPreviewRow {
  title: string;
  author: string;
  media_type: string;
  priority: string;
  notes: string;
  cover_url: string;
}

type PreviewRow = MediaPreviewRow | WishlistPreviewRow;

interface ValidItem {
  row: number;
  data: PreviewRow;
}

interface InvalidItem {
  row: number;
  error: string;
  raw: string;
}

interface PreviewResponse {
  valid: ValidItem[];
  invalid: InvalidItem[];
  total: number;
}

interface ImportResult {
  inserted: number;
  failed: number;
  message: string;
}

interface TmdbCandidate {
  tmdb_id: number;
  name: string;
  first_air_date: string;
  poster_path: string | null;
}

type TmdbFetchState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "candidates"; candidates: TmdbCandidate[] }
  | { status: "done"; start_date: string; end_date: string; show_name: string; episode_count: number; episode_dates: string[] }
  | { status: "error"; message: string };

const MEDIA_TYPE_LABELS: Record<string, string> = {
  book: "Książka",
  comic: "Komiks",
  movie: "Film",
  series: "Serial",
  anime: "Anime",
  cartoon: "Kreskówka",
};

export default function ImportPage() {
  const [activeTab, setActiveTab] = useState<TabType>("import");
  const [importType, setImportType] = useState<ImportType>("media");
  const [csvText, setCsvText] = useState("");
  const [step, setStep] = useState<Step>("upload");
  const [preview, setPreview] = useState<PreviewResponse | null>(null);
  const [editedItems, setEditedItems] = useState<ValidItem[]>([]);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [showOnlyYearPlaceholders, setShowOnlyYearPlaceholders] = useState(false);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => setCsvText((ev.target?.result as string) ?? "");
    reader.readAsText(file, "utf-8");
  };

  const handlePreview = async () => {
    if (!csvText.trim()) return;
    setLoading(true);
    try {
      const res = await fetch("/api/import/preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ csv: csvText, type: importType }),
      });
      const data: PreviewResponse = await res.json();
      if (!res.ok) {
        alert((data as { error?: string }).error ?? "Błąd podglądu");
        return;
      }
      setPreview(data);
      setEditedItems(data.valid.map((v) => ({ ...v, data: { ...v.data } })));
      setSelected(new Set(data.valid.map((v) => v.row)));
      setStep("preview");
    } catch (err) {
      alert("Błąd: " + (err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const handleImport = async () => {
    const toImport = editedItems.filter((item) => selected.has(item.row)).map((item) => item.data);
    if (toImport.length === 0) return;
    setLoading(true);
    try {
      const res = await fetch("/api/import/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items: toImport, type: importType }),
      });
      const data: ImportResult = await res.json();
      setResult(data);
      setStep("result");
    } catch (err) {
      alert("Błąd importu: " + (err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => {
    setStep("upload");
    setCsvText("");
    setPreview(null);
    setEditedItems([]);
    setSelected(new Set());
    setResult(null);
    if (fileRef.current) fileRef.current.value = "";
  };

  const updateField = (rowNum: number, field: string, value: string) => {
    setEditedItems((items) =>
      items.map((item) =>
        item.row === rowNum
          ? { ...item, data: { ...item.data, [field]: value } }
          : item
      )
    );
  };

  const toggleSelect = (rowNum: number) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(rowNum)) next.delete(rowNum);
      else next.add(rowNum);
      return next;
    });
  };

  const toggleAll = () => {
    if (selected.size === editedItems.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(editedItems.map((i) => i.row)));
    }
  };

  const selectedCount = selected.size;
  const yearPlaceholderCount = editedItems.filter(isYearPlaceholder).length;

  const [tmdbStates, setTmdbStates] = useState<Record<number, TmdbFetchState>>({});

  const fetchTmdbDates = useCallback(async (row: number, title: string, season: string, tmdbId?: number, originalTitle?: string) => {
    setTmdbStates((prev) => ({ ...prev, [row]: { status: "loading" } }));
    try {
      const params = new URLSearchParams({ title, season: season || "1" });
      if (originalTitle) params.set("original_title", originalTitle);
      if (tmdbId) params.set("tmdb_id", String(tmdbId));
      const res = await fetch(`/api/tmdb/season?${params}`);
      const data = await res.json();
      if (!res.ok) {
        setTmdbStates((prev) => ({ ...prev, [row]: { status: "error", message: data.error ?? "Błąd" } }));
        return;
      }
      if (data.candidates) {
        setTmdbStates((prev) => ({ ...prev, [row]: { status: "candidates", candidates: data.candidates } }));
        return;
      }
      // Apply dates — use first episode as main date, rest as additional sessions
      const episodeDates: string[] = data.episode_dates ?? [];
      if (episodeDates.length > 0) {
        updateField(row, "start_date", episodeDates[0]);
        updateField(row, "end_date", episodeDates[0]);
        if (episodeDates.length > 1) {
          const sessions = episodeDates.slice(1).map((d: string) => ({ start_date: d, end_date: d }));
          updateField(row, "additional_sessions", JSON.stringify(sessions));
        }
      } else {
        updateField(row, "start_date", data.start_date);
        updateField(row, "end_date", data.end_date);
      }
      setTmdbStates((prev) => ({ ...prev, [row]: { status: "done", start_date: data.start_date, end_date: data.end_date, show_name: data.show_name, episode_count: data.episode_count, episode_dates: episodeDates } }));
    } catch {
      setTmdbStates((prev) => ({ ...prev, [row]: { status: "error", message: "Błąd sieci" } }));
    }
  }, [updateField]);

  const pickTmdbCandidate = useCallback((row: number, title: string, season: string, tmdbId: number, originalTitle?: string) => {
    setTmdbStates((prev) => ({ ...prev, [row]: { status: "idle" } }));
    fetchTmdbDates(row, title, season, tmdbId, originalTitle);
  }, [fetchTmdbDates]);

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
      {/* Tabs */}
      <div className="flex border-b border-gray-200">
        {(["import", "export", "sync"] as TabType[]).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`flex-1 py-3 px-4 text-sm font-medium transition-colors ${
              activeTab === tab
                ? "bg-purple-50 text-purple-700 border-b-2 border-purple-600"
                : "text-gray-600 hover:text-gray-800 hover:bg-gray-50"
            }`}
          >
            {tab === "import" ? "📥 Importuj CSV" : tab === "sync" ? "🔄 Synchronizuj" : "📤 Eksportuj"}
          </button>
        ))}
      </div>

      <div className="p-6">
        {activeTab === "export" ? (
          <ExportTab />
        ) : activeTab === "sync" ? (
          <BulkSyncTab />
        ) : step === "upload" ? (
          <UploadStep
            importType={importType}
            setImportType={setImportType}
            csvText={csvText}
            setCsvText={setCsvText}
            fileRef={fileRef}
            onFileChange={handleFileChange}
            onPreview={handlePreview}
            loading={loading}
          />
        ) : step === "preview" && preview ? (
          <PreviewStep
            preview={preview}
            editedItems={editedItems}
            selected={selected}
            importType={importType}
            onToggleSelect={toggleSelect}
            onToggleAll={toggleAll}
            onUpdateField={updateField}
            onImport={handleImport}
            onBack={handleReset}
            selectedCount={selectedCount}
            loading={loading}
            yearPlaceholderCount={yearPlaceholderCount}
            showOnlyYearPlaceholders={showOnlyYearPlaceholders}
            onToggleYearFilter={() => setShowOnlyYearPlaceholders((v) => !v)}
            tmdbStates={tmdbStates}
            onFetchTmdb={fetchTmdbDates}
            onPickTmdbCandidate={pickTmdbCandidate}
          />
        ) : step === "result" && result ? (
          <ResultStep result={result} onReset={handleReset} />
        ) : null}
      </div>
    </div>
  );
}

function ExportTab() {
  const [wiping, setWiping] = React.useState(false);
  const [wiped, setWiped] = React.useState(false);

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
      <div className="flex flex-col sm:flex-row gap-3 flex-wrap">
        <button
          onClick={() => { window.location.href = "/api/export/media"; }}
          className="flex items-center gap-2 bg-purple-600 hover:bg-purple-700 text-white px-5 py-2.5 rounded-lg text-sm font-medium transition-colors"
        >
          ⬇ Eksportuj dziennik (CSV)
        </button>
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
        <code className="block font-mono">title,original_title,author,media_type,start_date,end_date,volume_episode,tags,notes,discontinued,cover_url,cinema,season</code>
        <p className="font-medium text-gray-700 mt-2">Format CSV — lista życzeń:</p>
        <code className="block font-mono">title,author,media_type,priority,notes,cover_url</code>
        <p className="mt-2">Dozwolone typy mediów: book, comic, movie, series, anime, cartoon</p>
        <p>Priorytety: high, normal, low</p>
      </div>

      <div className="mt-6 border border-red-200 rounded-lg p-4 bg-red-50">
        <p className="text-sm font-semibold text-red-700 mb-1">⚠️ Niebezpieczna strefa</p>
        <p className="text-xs text-red-600 mb-3">Usuwa wszystkie dane z bazy oraz wszystkie pliki okładek. Operacja jest nieodwracalna.</p>
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
  );
}

interface UploadStepProps {
  importType: ImportType;
  setImportType: (t: ImportType) => void;
  csvText: string;
  setCsvText: (v: string) => void;
  fileRef: React.RefObject<HTMLInputElement | null>;
  onFileChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onPreview: () => void;
  loading: boolean;
}

function UploadStep({ importType, setImportType, csvText, setCsvText, fileRef, onFileChange, onPreview, loading }: UploadStepProps) {
  return (
    <div className="space-y-4">
      <div>
        <p className="text-sm font-medium text-gray-700 mb-2">Co importujesz?</p>
        <div className="flex gap-4">
          {(["media", "wishlist"] as ImportType[]).map((t) => (
            <label key={t} className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                name="importType"
                value={t}
                checked={importType === t}
                onChange={() => setImportType(t)}
                className="text-purple-600 focus:ring-purple-500"
              />
              <span className="text-sm text-gray-700">
                {t === "media" ? "📅 Dziennik mediów" : "📋 Lista życzeń"}
              </span>
            </label>
          ))}
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Plik CSV</label>
        <input
          ref={fileRef}
          type="file"
          accept=".csv"
          onChange={onFileChange}
          className="block text-sm text-gray-600 file:mr-3 file:py-1.5 file:px-3 file:rounded file:border file:border-gray-300 file:text-sm file:bg-white file:text-gray-700 hover:file:bg-gray-50 cursor-pointer"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">lub wklej tekst CSV</label>
        <textarea
          value={csvText}
          onChange={(e) => setCsvText(e.target.value)}
          rows={6}
          placeholder={importType === "media"
            ? 'title,author,media_type,start_date\n"Dune","Frank Herbert","book","2024-01-15"'
            : 'title,author,media_type,priority\n"Dune Messiah","Frank Herbert","book","high"'
          }
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm font-mono focus:ring-2 focus:ring-purple-500 focus:border-transparent"
        />
      </div>

      <button
        onClick={onPreview}
        disabled={loading || !csvText.trim()}
        className="bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white px-6 py-2 rounded-lg text-sm font-medium transition-colors"
      >
        {loading ? "Analizuję..." : "Podgląd"}
      </button>
    </div>
  );
}

interface PreviewStepProps {
  preview: PreviewResponse;
  editedItems: ValidItem[];
  selected: Set<number>;
  importType: ImportType;
  onToggleSelect: (row: number) => void;
  onToggleAll: () => void;
  onUpdateField: (row: number, field: string, value: string) => void;
  onImport: () => void;
  onBack: () => void;
  selectedCount: number;
  loading: boolean;
  yearPlaceholderCount: number;
  showOnlyYearPlaceholders: boolean;
  onToggleYearFilter: () => void;
  tmdbStates: Record<number, TmdbFetchState>;
  onFetchTmdb: (row: number, title: string, season: string, tmdbId?: number, originalTitle?: string) => void;
  onPickTmdbCandidate: (row: number, title: string, season: string, tmdbId: number, originalTitle?: string) => void;
}

function PreviewStep({
  preview, editedItems, selected, importType,
  onToggleSelect, onToggleAll, onUpdateField, onImport, onBack, selectedCount, loading,
  yearPlaceholderCount, showOnlyYearPlaceholders, onToggleYearFilter,
  tmdbStates, onFetchTmdb, onPickTmdbCandidate,
}: PreviewStepProps) {
  const visibleItems = showOnlyYearPlaceholders ? editedItems.filter(isYearPlaceholder) : editedItems;
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <p className="text-sm text-gray-700">
          <span className="font-medium">{preview.total} wierszy</span> —{" "}
          <span className="text-green-600 font-medium">{preview.valid.length} poprawnych</span>
          {preview.invalid.length > 0 && (
            <span className="text-red-500 font-medium">, {preview.invalid.length} błędnych</span>
          )}
          {yearPlaceholderCount > 0 && importType === "media" && (
            <span className="text-amber-600 font-medium">, {yearPlaceholderCount} z rokiem zamiast datą ⚠️</span>
          )}
        </p>
        <div className="flex items-center gap-2">
          {yearPlaceholderCount > 0 && importType === "media" && (
            <button
              onClick={onToggleYearFilter}
              className={`text-xs px-3 py-1 rounded-full border font-medium transition-colors ${showOnlyYearPlaceholders ? "bg-amber-100 border-amber-400 text-amber-800" : "bg-white border-gray-300 text-gray-600 hover:border-amber-400"}`}
            >
              ⚠️ {showOnlyYearPlaceholders ? `Pokaż wszystkie` : `Pokaż tylko rok-placeholdery (${yearPlaceholderCount})`}
            </button>
          )}
          <button onClick={onBack} className="text-sm text-gray-500 hover:text-gray-700 underline">
            ← Wróć
          </button>
        </div>
      </div>

      {/* Valid rows table */}
      {editedItems.length > 0 && (
        <div className="overflow-x-auto rounded-lg border border-gray-200">
          <table className="w-full text-xs">
            <thead className="bg-gray-50">
              <tr>
                <th className="p-2 text-left">
                  <input type="checkbox" checked={selected.size === editedItems.length} onChange={onToggleAll} className="rounded text-purple-600" />
                </th>
                <th className="p-2 text-left font-medium text-gray-700">Tytuł</th>
                <th className="p-2 text-left font-medium text-gray-700">Autor</th>
                <th className="p-2 text-left font-medium text-gray-700">Typ</th>
                {importType === "media" && (
                  <>
                    <th className="p-2 text-left font-medium text-gray-700">Data pocz.</th>
                    <th className="p-2 text-left font-medium text-gray-700">Data końc.</th>
                    <th className="p-2 text-left font-medium text-gray-700">Sezon</th>
                    <th className="p-2 text-left font-medium text-gray-700">TMDB</th>
                  </>
                )}
                {importType === "wishlist" && (
                  <th className="p-2 text-left font-medium text-gray-700">Priorytet</th>
                )}
              </tr>
            </thead>
            <tbody>
              {visibleItems.map((item) => {
                const placeholder = isYearPlaceholder(item);
                return (
                <tr key={item.row} className={`border-t border-gray-100 ${placeholder ? "bg-amber-50" : selected.has(item.row) ? "bg-white" : "bg-gray-50 opacity-60"}`}>
                  <td className="p-2">
                    <input type="checkbox" checked={selected.has(item.row)} onChange={() => onToggleSelect(item.row)} className="rounded text-purple-600" />
                  </td>
                  <td className="p-1">
                    <input
                      type="text"
                      value={(item.data as MediaPreviewRow | WishlistPreviewRow).title}
                      onChange={(e) => onUpdateField(item.row, "title", e.target.value)}
                      className="w-full border border-gray-200 rounded px-1.5 py-0.5 text-xs min-w-[120px]"
                    />
                  </td>
                  <td className="p-1">
                    <input
                      type="text"
                      value={(item.data as MediaPreviewRow | WishlistPreviewRow).author}
                      onChange={(e) => onUpdateField(item.row, "author", e.target.value)}
                      className="w-full border border-gray-200 rounded px-1.5 py-0.5 text-xs min-w-[100px]"
                    />
                  </td>
                  <td className="p-2 text-gray-700">
                    {MEDIA_TYPE_LABELS[(item.data as MediaPreviewRow).media_type] ?? (item.data as MediaPreviewRow).media_type}
                  </td>
                  {importType === "media" && (() => {
                    const mediaData = item.data as MediaPreviewRow;
                    const isSeries = mediaData.media_type === "series" || mediaData.media_type === "anime";
                    const tmdbState = tmdbStates[item.row] ?? { status: "idle" };
                    return (
                    <>
                      <td className="p-1">
                        <input
                          type="date"
                          value={mediaData.start_date}
                          onChange={(e) => onUpdateField(item.row, "start_date", e.target.value)}
                          className={`border rounded px-1.5 py-0.5 text-xs ${placeholder ? "border-amber-400 bg-amber-50" : "border-gray-200"}`}
                        />
                      </td>
                      <td className="p-1">
                        <div className="flex items-center gap-1">
                          {placeholder && <span title="Rok zamiast daty">⚠️</span>}
                          <input
                            type="date"
                            value={mediaData.end_date}
                            onChange={(e) => onUpdateField(item.row, "end_date", e.target.value)}
                            className={`border rounded px-1.5 py-0.5 text-xs ${placeholder ? "border-amber-400 bg-amber-50" : "border-gray-200"}`}
                          />
                        </div>
                      </td>
                      <td className="p-1">
                        <input
                          type="text"
                          value={mediaData.volume_episode ?? ""}
                          onChange={(e) => onUpdateField(item.row, "volume_episode", e.target.value)}
                          placeholder="np. 2"
                          className="border border-gray-200 rounded px-1.5 py-0.5 text-xs w-14"
                        />
                      </td>
                      <td className="p-1 min-w-[120px]">
                        {isSeries && (
                          <div className="space-y-1">
                            {tmdbState.status === "idle" && (
                              <button
                                onClick={() => onFetchTmdb(item.row, mediaData.title, mediaData.volume_episode || "1", undefined, mediaData.original_title || undefined)}
                                className="text-xs bg-blue-50 hover:bg-blue-100 border border-blue-200 text-blue-700 px-2 py-0.5 rounded transition-colors"
                                title="Pobierz daty emisji z TMDB"
                              >
                                🎬 Pobierz daty
                              </button>
                            )}
                            {tmdbState.status === "loading" && (
                              <span className="text-xs text-gray-500 animate-pulse">⏳ Szukam…</span>
                            )}
                            {tmdbState.status === "done" && (
                              <div className="flex items-center gap-1">
                                <span className="text-xs text-green-600" title={`${tmdbState.show_name} — ${tmdbState.episode_count} odc.`}>✅ {tmdbState.episode_count} odc.</span>
                                <button onClick={() => onFetchTmdb(item.row, mediaData.title, mediaData.volume_episode || "1", undefined, mediaData.original_title || undefined)} className="text-xs text-gray-400 hover:text-gray-600">↺</button>
                              </div>
                            )}
                            {tmdbState.status === "error" && (
                              <div className="flex items-center gap-1">
                                <span className="text-xs text-red-500" title={tmdbState.message}>❌</span>
                                <button onClick={() => onFetchTmdb(item.row, mediaData.title, mediaData.volume_episode || "1", undefined, mediaData.original_title || undefined)} className="text-xs text-gray-400 hover:text-gray-600">↺</button>
                              </div>
                            )}
                            {tmdbState.status === "candidates" && (
                              <div className="space-y-1">
                                <p className="text-xs text-gray-500">Wybierz serial:</p>
                                {tmdbState.candidates.map((c) => (
                                  <button
                                    key={c.tmdb_id}
                                    onClick={() => onPickTmdbCandidate(item.row, mediaData.title, mediaData.volume_episode || "1", c.tmdb_id, mediaData.original_title || undefined)}
                                    className="flex items-center gap-1 text-left text-xs bg-white hover:bg-blue-50 border border-gray-200 rounded px-1.5 py-0.5 w-full transition-colors"
                                  >
                                    {c.poster_path && <img src={c.poster_path} alt="" className="w-5 h-7 object-cover rounded flex-shrink-0" />}
                                    <span className="truncate">{c.name} <span className="text-gray-400">{c.first_air_date?.slice(0, 4)}</span></span>
                                  </button>
                                ))}
                              </div>
                            )}
                          </div>
                        )}
                      </td>
                    </>
                    );
                  })()}
                  {importType === "wishlist" && (
                    <td className="p-2 text-gray-700">
                      {(item.data as WishlistPreviewRow).priority}
                    </td>
                  )}
                </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Invalid rows */}
      {preview.invalid.length > 0 && (
        <div className="space-y-2">
          <p className="text-sm font-medium text-red-600">Błędne wiersze (pominięte):</p>
          {preview.invalid.map((inv) => (
            <div key={inv.row} className="bg-red-50 border border-red-200 rounded-lg p-3 text-xs">
              <span className="font-medium text-red-700">Wiersz {inv.row}:</span>{" "}
              <span className="text-red-600">{inv.error}</span>
              <div className="font-mono text-gray-500 mt-1 truncate">{inv.raw}</div>
            </div>
          ))}
        </div>
      )}

      <div className="flex gap-3 pt-2">
        <button
          onClick={onImport}
          disabled={loading || selectedCount === 0}
          className="bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white px-6 py-2 rounded-lg text-sm font-medium transition-colors"
        >
          {loading ? "Importuję..." : `Importuj zaznaczone (${selectedCount})`}
        </button>
        <button onClick={onBack} className="bg-gray-200 hover:bg-gray-300 text-gray-700 px-6 py-2 rounded-lg text-sm font-medium transition-colors">
          Anuluj
        </button>
      </div>
    </div>
  );
}

function ResultStep({ result, onReset }: { result: ImportResult; onReset: () => void }) {
  return (
    <div className="space-y-4 text-center py-6">
      <div className="text-4xl">✅</div>
      <p className="text-lg font-semibold text-gray-800">{result.message}</p>
      {result.failed > 0 && (
        <p className="text-sm text-red-500">{result.failed} pozycji nie udało się zaimportować</p>
      )}
      <button
        onClick={onReset}
        className="mt-4 bg-purple-600 hover:bg-purple-700 text-white px-6 py-2 rounded-lg text-sm font-medium transition-colors"
      >
        Importuj kolejne
      </button>
    </div>
  );
}

interface NetflixPreviewGroup {
  series: string;
  seasonNumber: number | null;
  seasonTitle: string | null;
  isMovie: boolean;
  dates: string[];
  episodes: string[];
  episodeCount: number;
}

interface NetflixPreviewResponse {
  total: number;
  groups: number;
  preview: NetflixPreviewGroup[];
}

interface NetflixImportResult {
  total: number;
  createdMedia: number;
  createdSeasons: number;
  createdSessions: number;
  skippedSessions: number;
  removedPlaceholders: number;
  message: string;
}

function NetflixImportTab() {
  const [csvText, setCsvText] = useState("");
  const [loading, setLoading] = useState(false);
  const [preview, setPreview] = useState<NetflixPreviewResponse | null>(null);
  const [result, setResult] = useState<NetflixImportResult | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => setCsvText((ev.target?.result as string) ?? "");
    reader.readAsText(file, "utf-8");
  };

  const handlePreview = async () => {
    if (!csvText.trim()) return;
    setLoading(true);
    try {
      const res = await fetch("/api/import/netflix", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ csv: csvText, preview: true }),
      });
      const data = await res.json() as NetflixPreviewResponse;
      setPreview(data);
    } catch {
      alert("Błąd podglądu");
    } finally {
      setLoading(false);
    }
  };

  const [error, setError] = useState<string | null>(null);

  const handleImport = async () => {
    if (!csvText.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/import/netflix", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ csv: csvText }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError((data as { error?: string }).error ?? `Błąd serwera (${res.status})`);
        return;
      }
      setResult(data as NetflixImportResult);
      setPreview(null);
    } catch {
      setError("Błąd połączenia z serwerem");
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => {
    setCsvText("");
    setPreview(null);
    setResult(null);
    setError(null);
    if (fileRef.current) fileRef.current.value = "";
  };

  if (result) {
    return (
      <div className="space-y-4 text-center py-6">
        <div className="text-4xl">✅</div>
        <p className="text-lg font-semibold text-gray-800">{result.message}</p>
        <div className="grid grid-cols-2 gap-3 max-w-sm mx-auto text-sm">
          <div className="bg-purple-50 rounded-lg p-3 text-left">
            <div className="text-2xl font-bold text-purple-700">{result.createdMedia}</div>
            <div className="text-gray-600">nowych mediów</div>
          </div>
          <div className="bg-blue-50 rounded-lg p-3 text-left">
            <div className="text-2xl font-bold text-blue-700">{result.createdSeasons}</div>
            <div className="text-gray-600">nowych sezonów</div>
          </div>
          <div className="bg-green-50 rounded-lg p-3 text-left">
            <div className="text-2xl font-bold text-green-700">{result.createdSessions}</div>
            <div className="text-gray-600">nowych sesji</div>
          </div>
          <div className="bg-gray-50 rounded-lg p-3 text-left">
            <div className="text-2xl font-bold text-gray-500">{result.skippedSessions}</div>
            <div className="text-gray-600">duplikatów pominięto</div>
          </div>
          {result.removedPlaceholders > 0 && (
            <div className="col-span-2 bg-amber-50 rounded-lg p-3 text-left">
              <div className="text-2xl font-bold text-amber-600">{result.removedPlaceholders}</div>
              <div className="text-gray-600">placeholderów zastąpiono</div>
            </div>
          )}
        </div>
        <button onClick={handleReset} className="mt-4 bg-purple-600 hover:bg-purple-700 text-white px-6 py-2 rounded-lg text-sm font-medium transition-colors">
          Importuj kolejne
        </button>
      </div>
    );
  }

  if (preview) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="font-medium text-gray-800">Podgląd importu Netflix</p>
            <p className="text-sm text-gray-500">{preview.total} wierszy → {preview.groups} unikalnych (tytuł + sezon). Pokazuję pierwsze 50.</p>
          </div>
          <button onClick={() => setPreview(null)} className="text-sm text-gray-400 hover:text-gray-600">← Wróć</button>
        </div>
        <div className="max-h-96 overflow-y-auto space-y-1 border border-gray-200 rounded-lg p-2">
          {preview.preview.map((g, i) => (
            <div key={i} className="flex items-start gap-2 text-xs py-1 px-2 rounded hover:bg-gray-50">
              <span className="text-lg">{g.isMovie ? "🎬" : "📺"}</span>
              <div className="min-w-0 flex-1">
                <span className="font-medium text-gray-800">{g.series}</span>
                {!g.isMovie && (
                  <span className="text-gray-500 ml-1">
                    {g.seasonTitle ? `(${g.seasonTitle})` : g.seasonNumber != null ? `Sezon ${g.seasonNumber}` : ""}
                  </span>
                )}
              </div>
              <span className="text-gray-400 shrink-0">{g.episodeCount} odcinków / {g.dates.length} dni</span>
            </div>
          ))}
        </div>
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700">
            ❌ {error}
          </div>
        )}
        <div className="flex gap-3">
          <button
            onClick={handleImport}
            disabled={loading}
            className="bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white px-6 py-2 rounded-lg text-sm font-medium transition-colors"
          >
            {loading ? "Importuję..." : `Importuj ${preview.total} wpisów (${preview.groups} grup)`}
          </button>
          <button onClick={handleReset} className="bg-gray-200 hover:bg-gray-300 text-gray-700 px-6 py-2 rounded-lg text-sm font-medium transition-colors">
            Anuluj
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <p className="text-sm font-medium text-gray-700 mb-1">Historia oglądania Netflix (CSV)</p>
        <p className="text-xs text-gray-500 mb-3">
          Pobierz z <strong>netflix.com → Konto → Historia oglądania → Pobierz</strong>.
          Format: <code className="bg-gray-100 px-1 rounded">Title,Date</code>.
          Duplikaty (ta sama seria, sezon, data) są automatycznie pomijane.
        </p>
        <input
          ref={fileRef}
          type="file"
          accept=".csv,text/csv"
          onChange={handleFileChange}
          className="block text-sm text-gray-500 file:mr-3 file:py-2 file:px-4 file:rounded-lg file:border-0 file:bg-purple-50 file:text-purple-700 hover:file:bg-purple-100"
        />
        {csvText && (
          <p className="text-xs text-green-600 mt-1">✓ Wczytano plik ({csvText.split("\n").length - 1} wierszy)</p>
        )}
      </div>
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700">
          ❌ {error}
        </div>
      )}
      <button
        onClick={handlePreview}
        disabled={!csvText.trim() || loading}
        className="bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white px-6 py-2 rounded-lg text-sm font-medium transition-colors"
      >
        {loading ? "Ładuję..." : "Podgląd"}
      </button>
    </div>
  );
}

// ─── BulkSyncTab ─────────────────────────────────────────────────────────────

type TmdbSyncCandidate = { tmdb_id: number; name: string; first_air_date: string; poster_path: string | null };
type BookSyncCandidate = { ol_key: string; title: string; author: string; year: number | null; cover_url: string | null };
type ItunesSyncCandidate = { itunes_id: number; title: string; artist: string; year: number | null; cover_url: string | null };

type SyncedItem = { id: number; title: string; media_type: string };
type FailedItem = { id: number; title: string; media_type: string; error: string };
type NeedsReviewItem = {
  id: number;
  title: string;
  media_type: string;
  source: "tmdb" | "books" | "itunes";
  candidates: TmdbSyncCandidate[] | BookSyncCandidate[] | ItunesSyncCandidate[];
};

type BulkSyncResult = {
  synced: SyncedItem[];
  needs_review: NeedsReviewItem[];
  failed: FailedItem[];
  total: number;
};

type TmdbInfoResponse = {
  tmdb_id: number;
  overview: string;
  poster_url: string | null;
  genres: string[];
  vote_average: number;
  cast: { name: string; character: string; profile_path: string | null }[];
  status?: string;
  first_air_date?: string;
  release_date?: string;
  number_of_seasons?: number;
  runtime?: number;
  created_by?: { name: string }[];
  director?: string;
};

type BookInfoResponse = {
  ol_key: string | null;
  description: string;
  subjects: string[];
  first_publish_year: number | null;
  cover_url: string | null;
  authors: string[];
};

type ItunesInfoResponse = {
  itunes_id: number;
  description: string | null;
  genres: string[];
  release_year: number | null;
  cover_url: string | null;
  tracks: Array<{ number: number; title: string; duration_ms: number | null }> | null;
};

function BulkSyncTab() {
  const [skipSynced, setSkipSynced] = React.useState(true);
  const [loading, setLoading] = React.useState(false);
  const [result, setResult] = React.useState<BulkSyncResult | null>(null);
  const [needsReview, setNeedsReview] = React.useState<NeedsReviewItem[]>([]);
  const [applyingId, setApplyingId] = React.useState<number | null>(null);

  const handleSync = async () => {
    setLoading(true);
    setResult(null);
    setNeedsReview([]);
    try {
      const res = await fetch("/api/media/bulk-sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ skip_synced: skipSynced }),
      });
      if (!res.ok) throw new Error("Błąd synchronizacji");
      const data = await res.json() as BulkSyncResult;
      setResult(data);
      setNeedsReview(data.needs_review);
    } catch (err) {
      alert("Błąd: " + (err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const applyCandidate = async (item: NeedsReviewItem, candidateId: number | string) => {
    setApplyingId(item.id);
    try {
      let infoData: TmdbInfoResponse | BookInfoResponse | ItunesInfoResponse | null = null;

      if (item.source === "tmdb") {
        const type = ["series", "anime"].includes(item.media_type) ? "series" : "movie";
        const res = await fetch(`/api/tmdb/info?tmdb_id=${candidateId}&type=${type}`);
        if (!res.ok) throw new Error("Błąd TMDB");
        infoData = await res.json() as TmdbInfoResponse;
      } else if (item.source === "books") {
        const res = await fetch(`/api/books/info?ol_key=${encodeURIComponent(String(candidateId))}`);
        if (!res.ok) throw new Error("Błąd Google Books");
        infoData = await res.json() as BookInfoResponse;
      } else if (item.source === "itunes") {
        const type = item.media_type === "podcast" ? "podcast" : "record";
        const res = await fetch(`/api/itunes/info?itunes_id=${candidateId}&type=${type}`);
        if (!res.ok) throw new Error("Błąd iTunes");
        infoData = await res.json() as ItunesInfoResponse;
      }
      if (!infoData) throw new Error("Brak danych");

      let body: Record<string, unknown> = {};
      if (item.source === "tmdb") {
        const d = infoData as TmdbInfoResponse;
        const isTv = ["series", "anime"].includes(item.media_type);
        const dateStr = isTv ? d.first_air_date : d.release_date;
        const releaseYear = dateStr ? parseInt(dateStr.slice(0, 4)) || null : null;
        body = {
          tmdb_id: d.tmdb_id,
          description: d.overview,
          genres: d.genres,
          vote_average: d.vote_average,
          runtime: isTv ? null : (d.runtime ?? null),
          release_year: releaseYear,
          series_status: isTv ? (d.status ?? null) : null,
          tmdb_seasons_count: isTv ? (d.number_of_seasons ?? null) : null,
          persons: [
            ...d.cast.map((c, i) => ({ name: c.name, role: "actor", character_name: c.character, display_order: i, photo_url: c.profile_path })),
            ...(d.director ? [{ name: d.director, role: "director", display_order: 0 }] : []),
            ...(d.created_by ?? []).map((c, i) => ({ name: c.name, role: "creator", display_order: i })),
          ],
        };
      } else if (item.source === "books") {
        const d = infoData as BookInfoResponse;
        body = {
          ol_key: d.ol_key,
          description: d.description,
          genres: d.subjects?.slice(0, 8) ?? [],
          release_year: d.first_publish_year ?? null,
          persons: (d.authors ?? []).map((a, i) => ({ name: a, role: "author", display_order: i })),
        };
      } else if (item.source === "itunes") {
        const d = infoData as ItunesInfoResponse;
        body = {
          ol_key: `itunes:${d.itunes_id}`,
          description: d.description,
          genres: d.genres,
          release_year: d.release_year ?? null,
          track_list: d.tracks ?? null,
          persons: [],
        };
      }

      await fetch(`/api/media/${item.id}/external`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      const posterUrl = item.source === "tmdb"
        ? (infoData as TmdbInfoResponse).poster_url
        : item.source === "books"
        ? (infoData as BookInfoResponse).cover_url
        : (infoData as ItunesInfoResponse).cover_url;

      if (posterUrl) {
        const dlRes = await fetch("/api/cover/download", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ url: posterUrl }),
        });
        if (dlRes.ok) {
          const { path } = await dlRes.json() as { path: string };
          await fetch(`/api/media/${item.id}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ cover_url: path }),
          });
        }
      }

      setNeedsReview((prev) => prev.filter((i) => i.id !== item.id));
      setResult((prev) =>
        prev ? { ...prev, synced: [...prev.synced, { id: item.id, title: item.title, media_type: item.media_type }] } : prev
      );
    } catch (err) {
      alert("Błąd: " + (err as Error).message);
    } finally {
      setApplyingId(null);
    }
  };

  return (
    <div className="space-y-5">
      <div>
        <h3 className="text-sm font-semibold text-gray-800 mb-1">Masowe pobieranie opisów i okładek</h3>
        <p className="text-xs text-gray-500 mb-4">
          Automatycznie pobiera opisy, gatunki i okładki z TMDB (filmy/seriale), Google Books (książki/komiksy) i iTunes (muzyka/podcasty).
          Jeśli jest tylko jedno dopasowanie — zostaje zastosowane od razu.
        </p>
        <label className="flex items-center gap-2 text-sm text-gray-700 mb-4 cursor-pointer">
          <input
            type="checkbox"
            checked={skipSynced}
            onChange={(e) => setSkipSynced(e.target.checked)}
            className="rounded"
          />
          Pomiń już zsynchronizowane
        </label>
        <button
          onClick={handleSync}
          disabled={loading}
          className="bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white px-5 py-2 rounded-lg text-sm font-medium transition-colors"
        >
          {loading ? "⏳ Synchronizuję..." : "🔄 Rozpocznij synchronizację"}
        </button>
      </div>

      {loading && (
        <div className="text-sm text-gray-500 animate-pulse">Pobieranie danych z zewnętrznych źródeł — może potrwać chwilę…</div>
      )}

      {result && (
        <div className="space-y-4">
          <div className="flex gap-3 flex-wrap text-sm">
            <span className="bg-green-100 text-green-800 px-3 py-1 rounded-full font-medium">✅ {result.synced.length} zsynchronizowanych</span>
            {needsReview.length > 0 && (
              <span className="bg-yellow-100 text-yellow-800 px-3 py-1 rounded-full font-medium">🔍 {needsReview.length} do przeglądu</span>
            )}
            {result.failed.length > 0 && (
              <span className="bg-red-100 text-red-800 px-3 py-1 rounded-full font-medium">❌ {result.failed.length} błędów</span>
            )}
            <span className="text-gray-500">z {result.total} łącznie</span>
          </div>

          {needsReview.length > 0 && (
            <div className="space-y-3">
              <h4 className="text-sm font-semibold text-gray-700">🔍 Wymagają ręcznego wyboru:</h4>
              {needsReview.map((item) => (
                <div key={item.id} className="border border-yellow-200 rounded-lg p-3 bg-yellow-50 space-y-2">
                  <p className="text-sm font-medium text-gray-800">
                    {item.title} <span className="text-xs text-gray-500">({item.media_type})</span>
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {(item.candidates as (TmdbSyncCandidate & BookSyncCandidate & ItunesSyncCandidate)[]).map((c) => {
                      const id = c.tmdb_id ?? c.itunes_id ?? c.ol_key;
                      const name = c.name ?? c.title ?? "";
                      const sub = c.author ?? c.artist ?? "";
                      const year = c.year ?? (c.first_air_date ? c.first_air_date.slice(0, 4) : null);
                      const img = c.poster_path ?? c.cover_url ?? null;
                      return (
                        <button
                          key={String(id)}
                          disabled={applyingId === item.id}
                          onClick={() => applyCandidate(item, id!)}
                          className="flex items-center gap-2 px-3 py-1.5 bg-white border border-yellow-300 rounded-lg text-xs hover:bg-yellow-100 transition-colors disabled:opacity-50"
                        >
                          {img && <img src={img} alt="" className="w-5 h-7 object-cover rounded" />}
                          <span className="font-medium">{name}</span>
                          {sub && <span className="text-gray-500">{sub}</span>}
                          {year && <span className="text-gray-400">{year}</span>}
                        </button>
                      );
                    })}
                  </div>
                  {applyingId === item.id && <p className="text-xs text-yellow-700 animate-pulse">Zapisuję…</p>}
                </div>
              ))}
            </div>
          )}

          {result.failed.length > 0 && (
            <details className="text-sm">
              <summary className="cursor-pointer font-medium text-red-700">❌ Błędy ({result.failed.length})</summary>
              <ul className="mt-2 space-y-1 pl-3">
                {result.failed.map((f) => (
                  <li key={f.id} className="text-gray-700">
                    <span className="font-medium">{f.title}</span>
                    <span className="text-gray-400 ml-2 text-xs">{f.error}</span>
                  </li>
                ))}
              </ul>
            </details>
          )}

          {result.synced.length > 0 && (
            <details className="text-sm">
              <summary className="cursor-pointer font-medium text-green-700">✅ Zsynchronizowane ({result.synced.length})</summary>
              <ul className="mt-2 space-y-1 pl-3 columns-2">
                {result.synced.map((s) => (
                  <li key={s.id} className="text-gray-700 text-xs">{s.title}</li>
                ))}
              </ul>
            </details>
          )}
        </div>
      )}
    </div>
  );
}
