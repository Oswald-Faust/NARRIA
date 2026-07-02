/**
 * ComparisonReport — reproduction fidèle du rapport de comparaison Python
 * (`narria/m5_reporting/reporter.py`, `generate_html` + `_render_llm_metadata`),
 * recolorée au thème sombre de l'app.
 */
import { TriangleAlert } from "lucide-react";
import { Badge, type BadgeProps } from "@/components/ui/badge";
import { TensionSparkline } from "./tension-sparkline";

export interface ComparisonWork {
  title: string;
  author: string;
  graphId: string;
  nNodes: number;
  nEdges: number;
  tensionProfile: number[];
  summary?: string;
  genre?: string;
  tradition?: string;
  thematicKeywords?: string[];
  mainActants?: {
    protagoniste: string;
    objet: string;
    destinateur: string;
    destinataire: string;
    adjuvant: string;
    opposant: string;
  } | null;
  costUsd?: number;
}

export interface ComparisonCorrespondence {
  refNode: string;
  refFunction: string;
  candNode: string;
  candFunction: string;
  similarity: number;
}

export interface ComparisonReportData {
  id?: string;
  refWork: ComparisonWork;
  candWork: ComparisonWork;
  sns: number;
  snsNormalized: number;
  ss: number;
  st: number;
  srj: number;
  srjLevel: string;
  sIso: number;
  sGed: number;
  sFunc: number;
  sAct: number;
  sTens: number;
  detectedModality: string;
  verdict: string;
  correspondences: ComparisonCorrespondence[];
  warnings: string[];
}

const ACCENT_PURPLE = "var(--color-soft-purple)";
const ACCENT_PINK = "var(--color-soft-pink)";

const srjTone = (level: string): BadgeProps["tone"] =>
  level === "Critique"
    ? "danger"
    : level === "Élevé"
      ? "pink"
      : level === "Modéré"
        ? "neutral"
        : "success";

const ACTANT_ROLES: Array<keyof NonNullable<ComparisonWork["mainActants"]>> = [
  "protagoniste",
  "objet",
  "destinateur",
  "destinataire",
  "adjuvant",
  "opposant",
];

const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="border-b border-border pb-2 font-heading text-lg font-bold text-foreground">
      {children}
    </h2>
  );
}

function WorkHeader({ work, accent, label }: { work: ComparisonWork; accent: string; label: string }) {
  return (
    <div
      className="rounded-xl border border-border bg-surface-2 p-4"
      style={{ borderLeft: `4px solid ${accent}` }}
    >
      <p className="mb-2 text-xs uppercase tracking-wide text-muted">{label}</p>
      <p className="font-bold text-foreground">{work.title}</p>
      <p className="italic text-muted">{work.author}</p>
      <p className="mt-2 text-sm text-foreground/90">
        Graphe narratif :{" "}
        <code className="rounded bg-surface px-1.5 py-0.5 text-[0.85em] font-semibold" style={{ color: accent }}>
          {work.graphId}
        </code>{" "}
        — {work.nNodes} nœuds, {work.nEdges} transitions
      </p>
      <TensionSparkline profile={work.tensionProfile} color={accent} />
    </div>
  );
}

function LlmWorkBlock({ work, accent, label }: { work: ComparisonWork; accent: string; label: string }) {
  const actants = work.mainActants ?? null;
  const actantItems = actants
    ? ACTANT_ROLES.filter((k) => actants[k]).map((k) => ({ role: k, value: actants[k] }))
    : [];

  return (
    <div
      className="rounded-xl border border-border bg-surface-2 p-4"
      style={{ borderLeft: `4px solid ${accent}` }}
    >
      <p className="mb-2 text-xs uppercase tracking-wide text-muted">{label}</p>
      {work.summary ? (
        <p className="mb-2 text-sm text-foreground/90">
          <strong>Résumé :</strong> {work.summary}
        </p>
      ) : null}
      {work.genre ? (
        <p className="mb-1 text-sm text-foreground/90">
          <strong>Genre :</strong> {work.genre}
        </p>
      ) : null}
      {work.tradition ? (
        <p className="mb-1 text-sm text-foreground/90">
          <strong>Tradition :</strong> {work.tradition}
        </p>
      ) : null}
      {work.thematicKeywords && work.thematicKeywords.length > 0 ? (
        <p className="mb-1 text-sm text-foreground/90">
          <strong>Thématiques :</strong> {work.thematicKeywords.join(", ")}
        </p>
      ) : null}
      {actantItems.length > 0 ? (
        <div className="mb-1 text-sm text-foreground/90">
          <p className="mb-1">
            <strong>Schéma actantiel :</strong>
          </p>
          <ul className="ml-5 list-disc space-y-0.5 text-[0.9em]">
            {actantItems.map(({ role, value }) => (
              <li key={role}>
                <strong>{capitalize(role)} :</strong> {value}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      {typeof work.costUsd === "number" ? (
        <p className="mt-2 text-xs italic text-muted">
          Analyse LLM : {work.costUsd.toFixed(4)} USD consommés
        </p>
      ) : null}
    </div>
  );
}

function ScoreCard({
  label,
  value,
  caption,
  highlight,
  children,
}: {
  label: string;
  value: number;
  caption?: React.ReactNode;
  highlight?: boolean;
  children?: React.ReactNode;
}) {
  return (
    <div
      className="rounded-xl border bg-surface-2 p-4 text-center"
      style={highlight ? { borderColor: ACCENT_PINK, borderWidth: 2 } : { borderColor: "var(--color-border)" }}
    >
      <p className="text-[11px] uppercase tracking-wide text-muted">{label}</p>
      <p
        className="my-1 font-heading text-3xl font-bold"
        style={{ color: highlight ? ACCENT_PINK : "var(--color-foreground)" }}
      >
        {value.toFixed(3)}
      </p>
      {caption ? <div className="text-xs text-muted">{caption}</div> : null}
      {children}
    </div>
  );
}

const SNS_COMPONENTS: Array<{ code: string; description: string; key: keyof ComparisonReportData }> = [
  { code: "S_ISO", description: "Isomorphisme de sous-graphes narratifs (NARR'IA-VF2)", key: "sIso" },
  { code: "S_GED", description: "Distance d'édition de graphes narratifs (GED narrative)", key: "sGed" },
  { code: "S_FUNC", description: "Similarité des séquences de fonctions narratives (DTW)", key: "sFunc" },
  { code: "S_ACT", description: "Similarité des chaînes actantielles", key: "sAct" },
  { code: "S_TENS", description: "Corrélation des signatures tensives", key: "sTens" },
];

export function ComparisonReport({ data }: { data: ComparisonReportData }) {
  const { refWork, candWork } = data;
  const hasLlmMeta =
    !!(refWork.summary || refWork.genre || refWork.mainActants) ||
    !!(candWork.summary || candWork.genre || candWork.mainActants);
  const correspondences = data.correspondences ?? [];
  const warnings = data.warnings ?? [];

  return (
    <div className="space-y-8">
      {/* 1. Œuvres comparées */}
      <section className="space-y-3">
        <SectionTitle>Œuvres comparées</SectionTitle>
        <div className="grid gap-4 md:grid-cols-2">
          <WorkHeader work={refWork} accent={ACCENT_PURPLE} label="Œuvre de référence" />
          <WorkHeader work={candWork} accent={ACCENT_PINK} label="Œuvre candidate" />
        </div>
      </section>

      {/* 2. Analyse sémantique (mode LLM) */}
      {hasLlmMeta ? (
        <section className="space-y-3">
          <SectionTitle>Analyse sémantique (mode LLM)</SectionTitle>
          <div className="grid gap-4 md:grid-cols-2">
            <LlmWorkBlock work={refWork} accent={ACCENT_PURPLE} label="Œuvre de référence" />
            <LlmWorkBlock work={candWork} accent={ACCENT_PINK} label="Œuvre candidate" />
          </div>
        </section>
      ) : null}

      {/* 3. Scores composites */}
      <section className="space-y-3">
        <SectionTitle>Scores composites</SectionTitle>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          <ScoreCard label="SNS" value={data.sns} caption="Similarité narrative" highlight />
          <ScoreCard label="SNS_N" value={data.snsNormalized} caption="Normalisé / genre" />
          <ScoreCard label="SS" value={data.ss} caption="Spécificité" />
          <ScoreCard label="ST" value={data.st} caption="Transformation" />
          <ScoreCard label="SRJ" value={data.srj}>
            <div className="mt-1">
              <Badge tone={srjTone(data.srjLevel)}>{data.srjLevel}</Badge>
            </div>
          </ScoreCard>
        </div>
      </section>

      {/* 4. Verdict interprétatif */}
      <section className="space-y-3">
        <SectionTitle>Verdict interprétatif</SectionTitle>
        <div
          className="rounded-xl border border-border p-4"
          style={{
            borderLeft: `4px solid ${data.sns > 0.5 ? ACCENT_PINK : ACCENT_PURPLE}`,
            background: data.sns > 0.5 ? "color-mix(in srgb, var(--color-soft-pink) 12%, transparent)" : "var(--color-surface-2)",
          }}
        >
          <p className="mb-1 text-sm text-foreground">
            <strong>Modalité détectée :</strong> {data.detectedModality}
          </p>
          <p className="text-sm text-foreground/90">{data.verdict}</p>
        </div>
      </section>

      {/* 5. Détail des composantes du SNS */}
      <section className="space-y-3">
        <SectionTitle>Détail des composantes du SNS</SectionTitle>
        <div className="overflow-hidden rounded-xl border border-border">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-surface-2 text-left text-muted">
                <th className="px-4 py-2 font-semibold">Composante</th>
                <th className="px-4 py-2 font-semibold">Description</th>
                <th className="px-4 py-2 font-semibold">Score</th>
              </tr>
            </thead>
            <tbody>
              {SNS_COMPONENTS.map((c) => (
                <tr key={c.code} className="border-t border-border">
                  <td className="px-4 py-2 font-semibold text-foreground">{c.code}</td>
                  <td className="px-4 py-2 text-foreground/90">{c.description}</td>
                  <td className="px-4 py-2 text-foreground">{(data[c.key] as number).toFixed(3)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* 6. Note méthodologique */}
      <section>
        <div className="rounded-xl border border-border bg-surface-2 p-4 text-sm text-foreground/90">
          <h3 className="mb-2 font-heading text-base font-bold text-foreground">
            Note méthodologique sur la lecture des scores
          </h3>
          <p className="mb-2">
            Les indicateurs primaires de NARR&apos;IA, sur lesquels l&apos;interprétation doit
            principalement s&apos;appuyer, sont le <strong>SNS</strong> (similarité narrative
            composite), le <strong>S_ISO</strong> (isomorphisme structural) et le{" "}
            <strong>S_TENS</strong> (signature tensive), ainsi que le <strong>verdict modal</strong>.
            Ces indicateurs reposent sur des algorithmes structurellement stables.
          </p>
          <p className="mb-2">
            Les sous-scores <strong>S_ACT</strong> (chaînes actantielles) et <strong>ST</strong>{" "}
            (transformations) relèvent d&apos;algorithmes sensibles à la formulation des actants
            extraits par le LLM et aux métadonnées formelles fournies. Ils constituent des{" "}
            <em>indicateurs secondaires</em> en cours de calibration empirique. Une certaine
            variabilité de ces deux scores entre exécutions est attendue et ne remet pas en cause la
            fiabilité du verdict global.
          </p>
          <p>
            Pour toute analyse rigoureuse, il convient d&apos;interpréter ces deux sous-scores avec
            prudence et de privilégier l&apos;expertise humaine du narratologue pour qualifier la
            nature exacte des transformations entre œuvres.
          </p>
        </div>
      </section>

      {/* 7. Correspondances structurales principales */}
      <section className="space-y-3">
        <SectionTitle>Correspondances structurales principales</SectionTitle>
        <div className="overflow-hidden rounded-xl border border-border">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-surface-2 text-left text-muted">
                <th className="px-4 py-2 font-semibold">#</th>
                <th className="px-4 py-2 font-semibold">Nœud de référence</th>
                <th className="px-4 py-2 font-semibold">Nœud candidat</th>
                <th className="px-4 py-2 font-semibold">Similarité</th>
              </tr>
            </thead>
            <tbody>
              {correspondences.length === 0 ? (
                <tr className="border-t border-border">
                  <td className="px-4 py-3 text-muted italic" colSpan={4}>
                    Aucune correspondance forte détectée.
                  </td>
                </tr>
              ) : (
                correspondences.slice(0, 15).map((c, i) => (
                  <tr key={i} className="border-t border-border">
                    <td className="px-4 py-2 text-foreground/90">{i + 1}</td>
                    <td className="px-4 py-2 text-foreground/90">
                      <code className="rounded bg-surface-2 px-1 py-0.5 text-[0.85em] font-semibold text-soft-purple">
                        {c.refNode || "—"}
                      </code>{" "}
                      ({c.refFunction || "—"})
                    </td>
                    <td className="px-4 py-2 text-foreground/90">
                      <code className="rounded bg-surface-2 px-1 py-0.5 text-[0.85em] font-semibold text-soft-pink">
                        {c.candNode || "—"}
                      </code>{" "}
                      ({c.candFunction || "—"})
                    </td>
                    <td className="px-4 py-2 text-foreground">{((c.similarity ?? 0) * 100).toFixed(1)}%</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* 8. Limites et avertissements */}
      <section className="space-y-3">
        <SectionTitle>Limites et avertissements</SectionTitle>
        <div className="rounded-xl border border-yellow/30 bg-yellow/10 p-4">
          <div className="mb-2 flex items-center gap-2">
            <TriangleAlert className="h-4 w-4 text-yellow" />
            <h3 className="font-heading text-base font-bold text-foreground">À retenir impérativement</h3>
          </div>
          <ul className="ml-5 list-disc space-y-1 text-sm text-foreground/90">
            <li>
              Les scores NARR&apos;IA sont des <strong>estimations probabilistes</strong>, jamais des
              verdicts définitifs de plagiat.
            </li>
            <li>
              L&apos;interprétation des résultats exige une <strong>expertise humaine</strong>{" "}
              (narratologue, juriste selon le contexte).
            </li>
            <li>
              Un SNS élevé peut refléter une <strong>convergence indépendante</strong> due à des
              conventions génériques communes, sans emprunt réel.
            </li>
            <li>
              Une accusation publique de plagiat <strong>ne peut en aucun cas</strong> se fonder sur
              ces seuls scores.
            </li>
            <li>
              Ce rapport ne constitue <strong>pas un avis juridique</strong>. Pour toute suite
              judiciaire, consulter un avocat spécialisé en propriété intellectuelle.
            </li>
          </ul>
        </div>

        {warnings.length > 0 ? (
          <div className="space-y-2">
            {warnings.map((w, i) => (
              <div
                key={i}
                className="flex items-start gap-2 rounded-xl border border-yellow/30 bg-yellow/10 px-4 py-3"
              >
                <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0 text-yellow" />
                <p className="text-xs text-foreground/90">{w}</p>
              </div>
            ))}
          </div>
        ) : null}
      </section>
    </div>
  );
}
