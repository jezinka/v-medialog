import { MEDIA_TYPE_LABELS, MEDIA_TYPE_COLORS } from "@/lib/utils";
import type { SuggestionGroup } from "@/app/api/universes/suggestions/route";

interface SuggestionsPanelProps {
  suggestions: SuggestionGroup[];
  loadingSuggestions: boolean;
  dismissedSuggestions: Set<string>;
  applyingSuggestion: string | null;
  onClose: () => void;
  dismissSuggestion: (baseName: string) => void;
  handleApplySuggestion: (suggestion: SuggestionGroup) => void;
}

export default function SuggestionsPanel({
  suggestions, loadingSuggestions, dismissedSuggestions, applyingSuggestion,
  onClose, dismissSuggestion, handleApplySuggestion,
}: SuggestionsPanelProps) {
  return (
      <div className="border border-amber-200 bg-amber-50 rounded-xl p-4 space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-amber-900">💡 Sugestie scalania</h2>
          <button onClick={onClose} className="text-xs text-amber-400 hover:text-amber-600">✕</button>
        </div>
        {loadingSuggestions ? (
          <div className="flex justify-center py-4">
            <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-amber-500" />
          </div>
        ) : suggestions.filter((s) => !dismissedSuggestions.has(s.base_name)).length === 0 ? (
          <div className="text-xs text-amber-700 text-center py-3">Brak sugestii — wszystko wygląda OK 🎉</div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {suggestions
              .filter((s) => !dismissedSuggestions.has(s.base_name))
              .map((suggestion) => (
                <div key={suggestion.base_name} className="bg-white border border-amber-200 rounded-xl p-3 space-y-2">
                  <div className="flex items-start justify-between gap-1">
                    <p className="text-xs font-semibold text-amber-900 capitalize">{suggestion.base_name}</p>
                    <button
                      onClick={() => dismissSuggestion(suggestion.base_name)}
                      className="text-amber-300 hover:text-amber-500 text-xs shrink-0"
                    >
                      ✕
                    </button>
                  </div>
                  <div className="space-y-1">
                    {suggestion.items.map((item) => (
                      <div key={item.id} className="flex items-center gap-1.5 text-xs">
                        <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-medium ${MEDIA_TYPE_COLORS[item.media_type] ?? "bg-gray-100 text-gray-600"}`}>
                          {MEDIA_TYPE_LABELS[item.media_type] ?? item.media_type}
                        </span>
                        <span className="text-gray-700 truncate flex-1">{item.title}</span>
                        <span className="text-[10px] text-gray-400 shrink-0">{item.season_count}s</span>
                      </div>
                    ))}
                  </div>
                  <button
                    onClick={() => handleApplySuggestion(suggestion)}
                    disabled={applyingSuggestion === suggestion.base_name}
                    className="w-full bg-amber-500 hover:bg-amber-600 text-white text-xs font-medium py-1.5 rounded-lg transition-colors disabled:opacity-50"
                  >
                    {applyingSuggestion === suggestion.base_name ? "Scalanie…" : "Scal w jedno medium"}
                  </button>
                </div>
              ))}
          </div>
        )}
      </div>
  );
}
