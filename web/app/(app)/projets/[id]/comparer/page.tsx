import { ComparerTool } from "@/components/comparer/comparer-tool";

/** Outil de comparaison monté à l'intérieur du projet : la comparaison y est rattachée. */
export default async function ProjectComparerPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <ComparerTool projectId={id} />;
}
