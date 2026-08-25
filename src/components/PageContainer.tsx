import type { ReactNode } from "react";

interface PageContainerProps {
  children: ReactNode;
  className?: string;
}

export default function PageContainer({ children, className = "" }: PageContainerProps) {
  return <main className={`max-w-7xl mx-auto px-4 py-6 ${className}`.trim()}>{children}</main>;
}
