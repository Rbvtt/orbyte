import type { Metadata } from "next";
import { Suspense } from "react";
import { MisRescates } from "@/features/rescates/MisRescates";

export const metadata: Metadata = { title: "Mis rescates asignados" };

export default function PaginaMisRescates() {
  return (
    <Suspense>
      <MisRescates />
    </Suspense>
  );
}
