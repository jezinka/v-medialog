"use client";
import { useEffect, useRef, type ReactNode } from "react";

// Open modals, newest last: Escape closes only the topmost one. Safe because each modal pushes here and
// adds its keydown listener in the same effect, so listener order matches stack order.
// ponytail: no focus trap yet (Tab can leave the dialog); add one if keyboard users need it
const openModals: object[] = [];

/**
 * Dimmed overlay with a centered dialog panel. Escape closes it; a backdrop click closes it
 * only with `closeOnBackdrop`, so forms don't lose input to a stray click.
 * Focus moves into the panel on open and back to where it was on close.
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
  const panel = useRef<HTMLDivElement>(null);
  const close = useRef(onClose);
  useEffect(() => { close.current = onClose; });

  useEffect(() => {
    const self = {};
    openModals.push(self);
    const previousFocus = document.activeElement as HTMLElement | null;
    if (!panel.current?.contains(document.activeElement)) panel.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && openModals.at(-1) === self) close.current();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      openModals.splice(openModals.indexOf(self), 1);
      previousFocus?.focus();
    };
  }, []);

  return (
    <div
      className={`fixed inset-0 ${z} bg-black/50 flex items-center justify-center p-4`}
      onClick={closeOnBackdrop ? (e) => { if (e.target === e.currentTarget) onClose(); } : undefined}
    >
      <div ref={panel} tabIndex={-1} role="dialog" aria-modal="true" aria-label={label} className={`bg-white outline-none ${className}`}>
        {children}
      </div>
    </div>
  );
}
