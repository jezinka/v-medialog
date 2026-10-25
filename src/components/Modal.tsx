"use client";
import { useEffect, type ReactNode } from "react";

/**
 * Dimmed overlay with a centered dialog panel. Escape closes it; a backdrop click closes it
 * only with `closeOnBackdrop`, so forms don't lose input to a stray click.
 */
export default function Modal({
  onClose,
  label,
  className,
  closeOnBackdrop = false,
  z = "z-[60]",
  children,
}: {
  onClose: () => void;
  label: string; // accessible dialog name
  className: string; // panel classes (width, padding, spacing)
  closeOnBackdrop?: boolean;
  z?: string;
  children: ReactNode;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      className={`fixed inset-0 ${z} bg-black/50 flex items-center justify-center p-4`}
      onClick={closeOnBackdrop ? (e) => { if (e.target === e.currentTarget) onClose(); } : undefined}
    >
      <div role="dialog" aria-modal="true" aria-label={label} className={`bg-white ${className}`}>
        {children}
      </div>
    </div>
  );
}
