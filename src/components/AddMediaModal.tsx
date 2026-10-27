"use client";
import { useState } from "react";
import CoverImg from "./CoverImg";
import { MEDIA_TYPE_LABELS, MEDIA_TYPE_COLORS } from "@/lib/utils";
import Modal from "./Modal";
import { useMediaSearch } from "@/lib/hooks/useMediaSearch";
import CreateMediaForm, { EMPTY_MEDIA_FORM } from "./add-media/CreateMediaForm";
import QuickFill from "./add-media/QuickFill";

interface Props {
  onClose: () => void;
  onSelect: (mediaId: number, startDate?: string, endDate?: string) => void;
  initialStartDate?: string;
  initialEndDate?: string;
}

export default function AddMediaModal({ onClose, onSelect, initialStartDate, initialEndDate }: Props) {
  const { mediaSearch, filteredMedia, handleSearchChange, dropdownRef } = useMediaSearch();
  const [showCreate, setShowCreate] = useState(false);
  const [createForm, setCreateForm] = useState(EMPTY_MEDIA_FORM);
  const [lcFilled, setLcFilled] = useState(false);

  return (
    <Modal onClose={onClose} label={initialStartDate ? "Dodaj sesję" : "Przejdź do medium"} closeOnBackdrop z="z-50" className="rounded-2xl shadow-2xl w-full max-w-md">
          <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
            <div>
              <h2 className="font-semibold text-gray-900">
                {initialStartDate ? "Dodaj sesję" : "Przejdź do medium"}
              </h2>
              {initialStartDate && (
                <p className="text-xs text-gray-400 mt-0.5">
                  {initialStartDate}{initialEndDate && initialEndDate !== initialStartDate ? ` – ${initialEndDate}` : ""}
                </p>
              )}
            </div>
            <button
              onClick={onClose}
              className="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <div className="p-5 space-y-4">
            {!showCreate ? (
              <>
                <div ref={dropdownRef} className="relative">
                  <input
                    type="text"
                    value={mediaSearch}
                    onChange={(e) => handleSearchChange(e.target.value)}
                    className="input w-full px-3 py-1.5 text-sm"
                    placeholder="Szukaj po tytule..."
                    autoFocus
                  />
                  {filteredMedia.length > 0 && (
                    <div className="absolute top-full left-0 right-0 bg-white border border-gray-200 rounded-xl shadow-lg mt-1 max-h-64 overflow-y-auto z-50">
                      {filteredMedia.map((m) => (
                        <button
                          key={m.id}
                          type="button"
                          onClick={() => onSelect(m.id, initialStartDate, initialEndDate)}
                          className="w-full flex items-center gap-3 px-3 py-2 hover:bg-blue-50 text-left transition-colors"
                        >
                          {m.cover_url && (
                            <div className="relative w-8 h-12 shrink-0 rounded overflow-hidden">
                              <CoverImg src={m.cover_url} alt={m.title} fill className="object-cover" sizes="32px" />
                            </div>
                          )}
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-medium text-gray-900 truncate">{m.title}</p>
                            <span className={`text-xs px-1.5 py-0.5 rounded-full ${MEDIA_TYPE_COLORS[m.media_type] ?? "bg-gray-100 text-gray-600"}`}>
                              {MEDIA_TYPE_LABELS[m.media_type] ?? m.media_type}
                            </span>
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setCreateForm((f) => ({ ...f, title: mediaSearch.trim() }));
                    setShowCreate(true);
                  }}
                  className="text-xs text-blue-600 hover:text-blue-800"
                >
                  + Utwórz nowe medium
                </button>
                <QuickFill
                  onFilled={(update, source) => {
                    setCreateForm(update);
                    setLcFilled(source === "lubimyczytac");
                    setShowCreate(true);
                  }}
                />
              </>
            ) : (
              <CreateMediaForm
                form={createForm}
                setForm={setCreateForm}
                showLcLink={!lcFilled}
                onBack={() => setShowCreate(false)}
                onCreated={(id) => onSelect(id, initialStartDate, initialEndDate)}
              />
            )}
          </div>
    </Modal>
  );
}
