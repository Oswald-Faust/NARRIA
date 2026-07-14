"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { ScanText } from "lucide-react";
import { GradientHeader } from "@/components/ui/gradient-header";
import { AnalyserTool } from "@/components/analyse/analyser-tool";
import { LoadingBlock } from "@/components/ui/spinner";

function AnalyserPageInner() {
  const projectId = useSearchParams().get("projectId");
  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <GradientHeader
        title="Analyser un texte"
        subtitle="Soumettez une œuvre : NARR'IA en extrait la structure narrative profonde et le graphe de fonctions."
        icon={<ScanText className="h-6 w-6" />}
      />
      <AnalyserTool projectId={projectId} />
    </div>
  );
}

export default function AnalyserPage() {
  return (
    <Suspense fallback={<LoadingBlock />}>
      <AnalyserPageInner />
    </Suspense>
  );
}
