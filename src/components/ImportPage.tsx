"use client";
import React, { useState, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import MediaLibraryView from "./MediaLibraryView";
import PeopleView from "./PeopleView";
import UniversesView from "./UniversesView";
import MergeMediaModal from "./MergeMediaModal";
import ExportTab from "./import/ExportTab";
import UploadStep from "./import/UploadStep";
import PreviewStep from "./import/PreviewStep";
import ResultStep from "./import/ResultStep";
import BulkSyncTab from "./import/BulkSyncTab";
import { isYearPlaceholder } from "./import/types";
import type { ImportType, ImportResult, PreviewResponse, TmdbFetchState, ValidItem } from "./import/types";

type TabType = "media" | "people" | "universes" | "import" | "export" | "sync";
type Step = "upload" | "preview" | "result";

export default function ImportPage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<TabType>("media");
  const [showMerge, setShowMerge] = useState(false);
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

  const updateField = useCallback((rowNum: number, field: string, value: string) => {
    setEditedItems((items) =>
      items.map((item) =>
        item.row === rowNum
          ? { ...item, data: { ...item.data, [field]: value } }
          : item
      )
    );
  }, []);

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
        {(["media", "people", "universes", "import", "export", "sync"] as TabType[]).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`flex-1 py-3 px-4 text-sm font-medium transition-colors ${
              activeTab === tab
                ? "bg-purple-50 text-purple-700 border-b-2 border-purple-600"
                : "text-gray-600 hover:text-gray-800 hover:bg-gray-50"
            }`}
          >
            {tab === "media" ? "🎬 Media" : tab === "people" ? "👤 Ludzie" : tab === "universes" ? "🌌 Uniwersa" : tab === "import" ? "📥 Importuj CSV" : tab === "sync" ? "🔄 Synchronizuj" : "📤 Eksportuj"}
          </button>
        ))}
      </div>

      <div className="p-6">
        {activeTab === "media" ? (
          <div className="space-y-6">
            <div className="flex justify-end">
              <button
                onClick={() => setShowMerge(true)}
                className="text-sm px-3 py-1.5 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 transition-colors"
              >
                🔗 Połącz / zgrupuj media
              </button>
            </div>
            <MediaLibraryView />
            {showMerge && <MergeMediaModal onClose={() => setShowMerge(false)} onSuccess={() => {}} />}
          </div>
        ) : activeTab === "people" ? (
          <PeopleView onOpenPerson={(id) => router.push(`/people/${id}`)} />
        ) : activeTab === "universes" ? (
          <UniversesView />
        ) : activeTab === "export" ? (
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
