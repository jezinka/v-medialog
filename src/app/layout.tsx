import type { Metadata } from "next";
import { Suspense } from "react";
import "./globals.css";
import Toast from "@/components/Toast";
import NavHeader from "@/components/NavHeader";

export const metadata: Metadata = {
  title: "MediaLog",
  description: "Dziennik mediów",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pl">
      <body className="bg-gray-50 min-h-screen font-sans">
        <Suspense>
          <NavHeader />
        </Suspense>
        {children}
        <Toast />
      </body>
    </html>
  );
}
