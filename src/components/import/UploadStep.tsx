"use client";
import React from "react";
import type { ImportType } from "./types";

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

export default function UploadStep({ importType, setImportType, csvText, setCsvText, fileRef, onFileChange, onPreview, loading }: UploadStepProps) {
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
