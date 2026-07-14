"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { GitCompareArrows } from "lucide-react";
import { GradientHeader } from "@/components/ui/gradient-header";
import { ComparerTool } from "@/components/comparer/comparer-tool";
import { LoadingBlock } from "@/components/ui/spinner";

function ComparerPageInner() {
  const projectId = useSearchParams().get("projectId");
  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <GradientHeader
        title="Comparer deux textes"
        subtitle="Analysez d'abord chaque œuvre, puis confrontez la référence à la candidate pour obtenir les scores SNS, SS, ST et SRJ."
        icon={<GitCompareArrows className="h-6 w-6" />}
      />
      <ComparerTool projectId={projectId} />
    </div>
  );
}

export default function ComparerPage() {
  return (
    <Suspense fallback={<LoadingBlock />}>
      <ComparerPageInner />
    </Suspense>
  );
}
