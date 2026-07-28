/**
 * ComparisonReport — reproduction fidèle du rapport de comparaison Python
 * (`narria/m5_reporting/reporter.py`, `generate_html` + `_render_llm_metadata`),
 * recolorée au thème sombre de l'app.
 */
import { Fragment } from "react";
import { Download, TriangleAlert } from "lucide-react";
import { Badge, type BadgeProps } from "@/components/ui/badge";
import { isTropeCoincidence } from "@/lib/engine/comparison/content-similarity";
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
  /** Contenu réel des nœuds appariés (P0-3) — absent des comparaisons antérieures au 28/07/2026. */
  refExcerpt?: string;
  candExcerpt?: string;
  refActants?: string[];
  candActants?: string[];
  contentSimilarity?: number;
}

/** Couverture d'appariement (P1-6) — absente des comparaisons antérieures au 28/07/2026. */
export interface ComparisonCoverage {
  refNodes: number;
  candNodes: number;
  refMatched: number;
  candMatched: number;
  refOrphans: number;
  candOrphans: number;
  ratio: number;
}

export interface ComparisonGenre {
  refGenre: string;
  candGenre: string;
  sameGenre: boolean | null;
  crossGenre: boolean;
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
  coverage?: ComparisonCoverage;
  /** Confinement d'une œuvre dans l'autre (extrait, version tronquée). */
  inclusion?: {
    structural: number;
    textual: number | null;
    direction: "cand_in_ref" | "ref_in_cand" | null;
    detected: boolean;
  };
  genre?: ComparisonGenre;
  normalizationApplied?: boolean;
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

/**
 * Contenu réel d'un nœud apparié (P0-3) : extrait cité et actants. Sans lui,
 * une ligne du tableau des correspondances est invérifiable — les deux nœuds
 * peuvent porter la même fonction sans raconter la même chose.
 */
function NodeContent({ excerpt, actants }: { excerpt?: string; actants?: string[] }) {
  if (!excerpt && !actants?.length) return null;
  return (
    <div className="space-y-1 text-xs text-foreground/80">
      {excerpt ? <p className="italic">« {excerpt} »</p> : null}
      {actants?.length ? <p className="text-muted">Actants : {actants.join(", ")}</p> : null}
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
  { code: "S_FUNC", description: "Similarité des séquences de fonctions narratives (LCS pondérée par spécificité)", key: "sFunc" },
  { code: "S_ACT", description: "Similarité des chaînes actantielles", key: "sAct" },
  { code: "S_TENS", description: "Corrélation des signatures tensives", key: "sTens" },
];

export function ComparisonReport({ data }: { data: ComparisonReportData }) {
  const { refWork, candWork } = data;

  if (!refWork || !candWork) {
    return (
      <p className="text-sm text-muted">
        Données de comparaison incomplètes — relancez la comparaison pour afficher le rapport détaillé.
      </p>
    );
  }

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
          <ScoreCard
            label="SNS_N"
            value={data.snsNormalized}
            caption={data.normalizationApplied === false ? "Normalisation neutralisée" : "Normalisé / genre"}
          />
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
        {data.genre?.crossGenre ? (
          <div className="flex items-start gap-2 rounded-xl border border-yellow/30 bg-yellow/10 px-4 py-3">
            <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0 text-yellow" />
            <p className="text-xs text-foreground/90">
              <strong>Comparaison inter-genres</strong> — « {data.genre.refGenre} » vs « {data.genre.candGenre} ».
              La normalisation par genre (SNS_N) a été neutralisée : NARR&apos;IA ne dispose d&apos;aucune référence
              permettant d&apos;interpréter un score entre genres distincts.
            </p>
          </div>
        ) : null}
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
            Le <strong>graphe narratif lui-même</strong> est le produit d&apos;une extraction par
            modèle de langue : son découpage en nœuds varie d&apos;une exécution à l&apos;autre.{" "}
            <em>Tous</em> les sous-scores en héritent — S_ISO, S_GED et S_FUNC compris, et non les
            seuls S_ACT et ST. Des écarts de quelques centièmes entre deux analyses des mêmes textes
            sont attendus.
          </p>
          <p className="mb-2">
            L&apos;interprétation doit s&apos;appuyer d&apos;abord sur le <strong>SNS</strong>, le{" "}
            <strong>S_ISO</strong> (isomorphisme structural, pondéré par la spécificité des fonctions
            appariées) et le <strong>taux de couverture</strong>, qui indique quelle proportion des
            deux récits les correspondances expliquent réellement. Un score composite élevé sur une
            couverture faible ne signale rien de narrativement consistant.
          </p>
          <p className="mb-2">
            Le <strong>S_TENS</strong> mesure la ressemblance des courbes dramatiques. La courbe
            exposition-montée-climax-résolution étant commune à la quasi-totalité des récits, un
            S_TENS élevé indique une convention de genre partagée bien plus souvent qu&apos;un
            emprunt : il ne doit jamais être lu isolément. <strong>S_ACT</strong> et{" "}
            <strong>ST</strong> restent particulièrement sensibles à la formulation des actants
            extraits et demeurent en cours de calibration empirique.
          </p>
          <p>
            Pour toute analyse rigoureuse, il convient de vérifier les correspondances une à une —
            leur contenu est cité dans le tableau ci-dessous — et de privilégier l&apos;expertise
            humaine du narratologue pour qualifier la nature exacte des rapports entre œuvres.
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
                  <Fragment key={i}>
                    <tr className="border-t border-border">
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
                    {c.refExcerpt || c.candExcerpt || c.refActants?.length || c.candActants?.length ? (
                      <tr className="bg-surface-2/40">
                        <td />
                        <td className="px-4 pb-3 align-top">
                          <NodeContent excerpt={c.refExcerpt} actants={c.refActants} />
                        </td>
                        <td className="px-4 pb-3 align-top">
                          <NodeContent excerpt={c.candExcerpt} actants={c.candActants} />
                        </td>
                        <td className="px-4 pb-3 align-top text-[11px] text-muted">
                          {typeof c.contentSimilarity === "number"
                            ? `contenu ${(c.contentSimilarity * 100).toFixed(0)} %`
                            : null}
                          {isTropeCoincidence(c.similarity ?? 0, c.contentSimilarity) ? (
                            <span
                              className="mt-1.5 flex items-start gap-1 rounded-md border border-yellow/40 bg-yellow/10 px-1.5 py-1 text-[10px] leading-3.5 text-[#8a5a10] dark:text-yellow"
                              title="La fonction narrative coïncide, mais les deux épisodes ne racontent pas la même chose : ce rapprochement relève probablement du procédé commun, non de l'emprunt."
                            >
                              <TriangleAlert className="mt-px h-3 w-3 shrink-0" />
                              coïncidence de trope — la fonction concorde, pas le fond
                            </span>
                          ) : null}
                        </td>
                      </tr>
                    ) : null}
                  </Fragment>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* 7 bis-a. Confinement : une œuvre contenue dans l'autre.
          Signalé AVANT la couverture, car dans ce cas les orphelins de l'œuvre
          longue sont attendus et ne traduisent aucune divergence. */}
      {data.inclusion?.detected ? (
        <section className="space-y-3">
          <SectionTitle>Une œuvre paraît contenue dans l&apos;autre</SectionTitle>
          <div className="rounded-xl border border-yellow/50 bg-yellow/10 p-4 text-sm text-foreground/90">
            <p className="flex items-start gap-2 font-semibold text-[#8a5a10] dark:text-yellow">
              <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" />
              {data.inclusion.direction === "ref_in_cand"
                ? "L'œuvre de référence se retrouve dans l'œuvre candidate."
                : "L'œuvre candidate se retrouve dans l'œuvre de référence."}
            </p>
            <ul className="ml-5 mt-2 list-disc space-y-0.5 text-[0.9em]">
              <li>
                Nœuds narratifs de la plus courte retrouvés dans l&apos;autre :{" "}
                <strong>{(data.inclusion.structural * 100).toFixed(0)} %</strong>
              </li>
              {typeof data.inclusion.textual === "number" ? (
                <li>
                  Reprise littérale (suites de cinq mots) :{" "}
                  <strong>{(data.inclusion.textual * 100).toFixed(0)} %</strong>
                </li>
              ) : null}
            </ul>
            <p className="mt-2 text-[0.9em] text-muted">
              Dans ce cas de figure, l&apos;indice de similarité global est mécaniquement abaissé par
              l&apos;écart de taille entre les deux œuvres : il ne doit pas être lu comme une absence de
              correspondance. Extrait, version tronquée ou chapitre repris — un examen prioritaire est
              recommandé.
            </p>
          </div>
        </section>
      ) : null}

      {/* 7 bis. Couverture de l'appariement (P1-6) */}
      {data.coverage ? (
        <section className="space-y-3">
          <SectionTitle>Couverture de l&apos;appariement</SectionTitle>
          <div className="rounded-xl border border-border bg-surface-2 p-4 text-sm text-foreground/90">
            <div className="mb-3 h-2 w-full overflow-hidden rounded-full bg-surface">
              <div
                className="h-full rounded-full"
                style={{
                  width: `${Math.round(data.coverage.ratio * 100)}%`,
                  background: data.coverage.ratio < 0.35 ? "var(--color-yellow)" : ACCENT_PURPLE,
                }}
              />
            </div>
            <p className="mb-1">
              Taux de couverture global : <strong>{(data.coverage.ratio * 100).toFixed(0)} %</strong>
            </p>
            <ul className="ml-5 list-disc space-y-0.5 text-[0.9em]">
              <li>
                Œuvre de référence : <strong>{data.coverage.refMatched}/{data.coverage.refNodes}</strong> nœuds
                appariés — {data.coverage.refOrphans} orphelins
              </li>
              <li>
                Œuvre candidate : <strong>{data.coverage.candMatched}/{data.coverage.candNodes}</strong> nœuds
                appariés — {data.coverage.candOrphans} orphelins
              </li>
            </ul>
            {data.coverage.ratio < 0.35 ? (
              <p className="mt-2 text-xs text-yellow">
                <strong>Couverture faible</strong> — les scores ne portent que sur une portion minoritaire des
                deux récits : l&apos;essentiel des deux œuvres n&apos;est expliqué par aucune correspondance.
              </p>
            ) : null}
          </div>
        </section>
      ) : null}

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

      {/* 9. Téléchargements */}
      {data.id ? (
        <div className="flex flex-wrap justify-end gap-2">
          {(["pdf", "html", "md", "json"] as const).map((fmt) => (
            <a
              key={fmt}
              href={`/api/compare/${data.id}/export?format=${fmt}`}
              download
              className="inline-flex h-9 items-center gap-2 rounded-full border border-border bg-surface px-4 text-sm text-foreground hover:bg-surface-2"
            >
              <Download className="h-4 w-4" /> {fmt.toUpperCase()}
            </a>
          ))}
        </div>
      ) : null}
    </div>
  );
}
