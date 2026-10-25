"use client";
import type { ImportResult } from "./types";

export default function ResultStep({ result, onReset }: { result: ImportResult; onReset: () => void }) {
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

// ─── BulkSyncTab ─────────────────────────────────────────────────────────────
