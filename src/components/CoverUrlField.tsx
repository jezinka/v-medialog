"use client";
import { toast } from "./Toast";

/** Cover URL input with an image upload button (to /api/cover/upload) and a small preview. */
export default function CoverUrlField({
  value, onChange, placeholder, uploading, onUploadingChange,
}: {
  value: string;
  onChange: (url: string) => void;
  placeholder: string;
  uploading: boolean;
  onUploadingChange: (uploading: boolean) => void;
}) {
  return (
    <>
      <div className="flex gap-2 items-center">
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="input flex-1 px-3 py-1.5 text-sm"
        />
        <label className={`shrink-0 cursor-pointer px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${uploading ? "bg-gray-200 text-gray-400 cursor-not-allowed" : "bg-gray-100 hover:bg-gray-200"}`}>
          {uploading ? "Wgrywam…" : "Wgraj"}
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="hidden"
            disabled={uploading}
            onChange={async (e) => {
              const file = e.target.files?.[0];
              if (!file) return;
              onUploadingChange(true);
              try {
                const buffer = await file.arrayBuffer();
                const base64 = btoa(new Uint8Array(buffer).reduce((s, b) => s + String.fromCharCode(b), ""));
                const res = await fetch("/api/cover/upload", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ data: base64, type: file.type }),
                });
                const data = await res.json();
                if (data.path) {
                  onChange(data.path);
                  toast("Okładka wgrana ✓", "success");
                } else {
                  toast(data.error ?? "Błąd uploadu", "error");
                }
              } catch {
                toast("Błąd połączenia podczas uploadu", "error");
              } finally {
                onUploadingChange(false);
                e.target.value = "";
              }
            }}
          />
        </label>
      </div>
      {value && (
        <div className="mt-1.5">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={value} alt="podgląd" className="w-8 h-12 object-cover rounded border border-gray-200" />
        </div>
      )}
    </>
  );
}
