import { AnalyserTool } from "@/components/analyse/analyser-tool";

/** Outil d'analyse monté à l'intérieur du projet : l'analyse produite y est rattachée. */
export default async function ProjectAnalyserPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <AnalyserTool projectId={id} />;
}
