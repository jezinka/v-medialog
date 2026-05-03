"use client";

import { useRouter } from "next/navigation";
import PeopleView from "@/components/PeopleView";

export default function PeoplePage() {
  const router = useRouter();

  return (
    <main className="max-w-7xl mx-auto px-4 py-6">
      <PeopleView onOpenPerson={(id) => router.push(`/people/${id}`)} />
    </main>
  );
}
