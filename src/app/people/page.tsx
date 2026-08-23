"use client";

import { useRouter } from "next/navigation";
import PageContainer from "@/components/PageContainer";
import PeopleView from "@/components/PeopleView";

export default function PeoplePage() {
  const router = useRouter();

  return (
    <PageContainer>
      <PeopleView onOpenPerson={(id) => router.push(`/people/${id}`)} />
    </PageContainer>
  );
}
