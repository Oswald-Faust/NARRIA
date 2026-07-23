import Link from "next/link";
import type { CSSProperties } from "react";
import {
  ArrowRight, BookMarked, FileText, GitCompareArrows,
  MessageSquareText, ScanText, Scale, GraduationCap, PenTool, Building2,
  Upload, Network, Gauge, Check, TriangleAlert, MailPlus, FolderKanban,
  Users, History,
} from "lucide-react";
import { koba } from "@/lib/fonts";
import { SUBSCRIPTION_PLANS } from "@/lib/subscriptions";
import { cn } from "@/lib/utils";
import { LogoFull } from "@/components/brand/logo";
import { Reveal } from "./reveal";
import {
  ChatMockup, CompareMockup, RingGauge, ScoreBar, ActantialDiagram, ProjectMockup,
} from "./mockups";

/* ── Mots en cascade au scroll (piloté par .is-visible d'un Reveal) ───── */
function ScrollWords({
  text,
  className,
  stagger = 0.06,
  startDelay = 0.1,
}: {
  text: string;
  className?: string;
  stagger?: number;
  startDelay?: number;
}) {
  const words = text.split(" ");
  return (
    <span className={className} aria-label={text}>
      {words.map((word, i) => (
        <span key={`${word}-${i}`} aria-hidden>
          <span className="lp-word-s" style={{ "--d": `${startDelay + i * stagger}s` } as CSSProperties}>
            {word}
          </span>
          {i < words.length - 1 ? " " : ""}
        </span>
      ))}
    </span>
  );
}

/* ── En-tête de section réutilisable ─────────────────────────────────── */
function SectionHeader({
  eyebrow,
  title,
  sub,
}: {
  eyebrow: string;
  title: string;
  sub?: string;
}) {
  return (
    <Reveal className="mx-auto max-w-2xl text-center">
      <div className="text-xs font-bold uppercase tracking-[0.25em] text-purple dark:text-soft-purple">
        {eyebrow}
      </div>
      <h2 className={`${koba.className} mt-3 text-balance text-3xl leading-tight tracking-wide text-lp-ink sm:text-4xl`}>
        <ScrollWords text={title} />
      </h2>
      {sub && <p className="mt-4 text-pretty text-[15px] leading-7 text-lp-ink/60">{sub}</p>}
    </Reveal>
  );
}

/* ── Séparateur animé entre sections ──────────────────────────────────── */
export function SectionDivider() {
  return (
    <Reveal className="mx-auto max-w-6xl px-4 sm:px-6">
      <div className="flex items-center gap-4" aria-hidden>
        <div className="lp-divider-line h-px flex-1 origin-right bg-gradient-to-l from-lp-ink/20 to-transparent" />
        <div className="lp-divider-gem h-2 w-2 bg-gradient-to-br from-purple to-pink" />
        <div className="lp-divider-line h-px flex-1 origin-left bg-gradient-to-r from-lp-ink/20 to-transparent" />
      </div>
    </Reveal>
  );
}

/* ── Bande défilante ──────────────────────────────────────────────────── */
const MARQUEE_ITEMS = [
  "Score SNS", "Graphes narratifs", "Schéma actantiel", "53 fonctions narratives",
  "7 familles", "Traditions africaines", "Isomorphisme", "Tension dramatique",
  "Exports PDF", "Agent conversationnel",
];

export function MarqueeStrip() {
  const items = [...MARQUEE_ITEMS, ...MARQUEE_ITEMS];
  return (
    <section className="lp-marquee relative overflow-hidden border-y border-lp-ink/8 bg-lp-ink/2 py-5">
      <div className="pointer-events-none absolute inset-y-0 left-0 z-10 w-32 bg-gradient-to-r from-lp-bg to-transparent" />
      <div className="pointer-events-none absolute inset-y-0 right-0 z-10 w-32 bg-gradient-to-l from-lp-bg to-transparent" />
      <div className="lp-marquee-track flex w-max items-center gap-8">
        {items.map((item, i) => (
          <span
            key={i}
            className="flex items-center gap-8 whitespace-nowrap text-sm font-medium text-lp-ink/40"
            aria-hidden={i >= MARQUEE_ITEMS.length}
          >
            <span className="text-purple/50 dark:text-soft-purple/60">✦</span>
            {item}
          </span>
        ))}
      </div>
    </section>
  );
}

/* ── Fonctionnement (3 étapes) ────────────────────────────────────────── */
const STEPS = [
  {
    icon: Upload,
    n: "01",
    title: "Déposez une œuvre",
    desc: "Manuscrit, scénario, conte — txt, docx, pdf, epub ou odt. NARR'IA en extrait automatiquement la matière narrative.",
    effect: "left" as const,
  },
  {
    icon: Network,
    n: "02",
    title: "L'IA structure le récit",
    desc: "Fonctions narratives, actants, séquences et courbe de tension : le squelette de l'intrigue, indépendant du style et des mots.",
    effect: "up" as const,
  },
  {
    icon: Gauge,
    n: "03",
    title: "Obtenez un verdict chiffré",
    desc: "Un score SNS explicable, ses cinq sous-scores et un rapport exportable — défendable devant un comité ou un tribunal.",
    effect: "right" as const,
  },
];

export function HowItWorks() {
  return (
    <section id="fonctionnement" className="scroll-mt-28 py-24 sm:py-32">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <SectionHeader
          eyebrow="Fonctionnement"
          title="De l'œuvre brute au verdict, en trois temps"
          sub="Aucune configuration, aucun balisage manuel. Vous déposez un texte, NARR'IA fait le reste."
        />
        <div className="relative mt-16 grid gap-6 md:grid-cols-3">
          <div className="pointer-events-none absolute left-[16%] right-[16%] top-10 hidden border-t border-dashed border-lp-ink/15 md:block" aria-hidden />
          {STEPS.map((s, i) => (
            <Reveal key={s.n} delay={i * 0.15} effect={s.effect}>
              <div className="group relative h-full rounded-3xl border border-lp-ink/10 bg-lp-ink/3 p-7 transition-all duration-500 hover:-translate-y-1.5 hover:border-purple/40 hover:bg-lp-ink/5 hover:shadow-[0_24px_60px_-24px_rgba(132,59,144,0.55)]">
                <div className="relative z-10 mb-5 inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-purple to-pink text-white shadow-lg shadow-pink/25 transition-transform duration-500 group-hover:scale-110 group-hover:rotate-3">
                  <s.icon className="h-6 w-6" />
                </div>
                <div className={`${koba.className} pointer-events-none absolute right-5 top-4 text-5xl text-lp-ink/6`}>{s.n}</div>
                <h3 className="font-heading text-lg font-bold text-lp-ink">{s.title}</h3>
                <p className="mt-2 text-sm leading-6 text-lp-ink/55">{s.desc}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ── Grille bento (produit) ───────────────────────────────────────────── */
function BentoCard({
  className,
  children,
  delay = 0,
}: {
  className?: string;
  children: React.ReactNode;
  delay?: number;
}) {
  return (
    <Reveal delay={delay} effect="zoom" className={className}>
      <div className="group relative h-full overflow-hidden rounded-3xl border border-lp-ink/10 bg-gradient-to-b from-lp-ink/5 to-lp-ink/2 p-6 transition-all duration-500 hover:-translate-y-1 hover:border-purple/35 hover:shadow-[0_30px_80px_-30px_rgba(132,59,144,0.6)] sm:p-7">
        <div
          className="pointer-events-none absolute -right-20 -top-20 h-48 w-48 rounded-full opacity-0 blur-3xl transition-opacity duration-700 group-hover:opacity-30"
          style={{ background: "#843b90" }}
          aria-hidden
        />
        {children}
      </div>
    </Reveal>
  );
}

function BentoTitle({ icon: Icon, title, desc }: { icon: React.ElementType; title: string; desc: string }) {
  return (
    <>
      <div className="mb-4 inline-flex h-11 w-11 items-center justify-center rounded-xl border border-lp-ink/10 bg-lp-ink/6 text-pink dark:text-soft-pink">
        <Icon className="h-5 w-5" />
      </div>
      <h3 className="font-heading text-[17px] font-bold text-lp-ink">{title}</h3>
      <p className="mt-1.5 text-sm leading-6 text-lp-ink/55">{desc}</p>
    </>
  );
}

const FN_FAMILIES = [
  "Préparation", "Complication", "Transférence", "Lutte", "Retour", "Reconnaissance", "Fonctions africaines",
];

export function BentoFeatures() {
  return (
    <section id="produit" className="scroll-mt-28 py-24 sm:py-32">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <SectionHeader
          eyebrow="Produit"
          title="Une suite complète d'analyse narrative"
          sub="Chaque outil travaille sur le même moteur narratologique : ce que vous voyez dans le chat, l'analyse ou la comparaison repose sur les mêmes graphes."
        />
        <div className="mt-16 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
          {/* Analyse — large */}
          <BentoCard className="lg:col-span-2">
            <BentoTitle
              icon={ScanText}
              title="Analyse narrative augmentée"
              desc="Genre, tradition, actants principaux, mots-clés thématiques et séquence de fonctions : un dossier complet extrait par IA, restitué dans un rapport visuel."
            />
            <div className="mt-5 rounded-2xl border border-white/10 bg-[#120a24] p-4">
              <ActantialDiagram className="max-w-md" />
            </div>
          </BentoCard>

          {/* Chat */}
          <BentoCard delay={0.1}>
            <BentoTitle
              icon={MessageSquareText}
              title="Un expert qui converse"
              desc="L'agent NARR'IA pilote lui-même les outils d'analyse et répond avec les scores à l'appui."
            />
            <div className="mt-5 rounded-2xl border border-white/10 bg-[#120a24] p-4">
              <ChatMockup />
            </div>
          </BentoCard>

          {/* Comparaison */}
          <BentoCard delay={0.05}>
            <BentoTitle
              icon={GitCompareArrows}
              title="Comparaison SNS"
              desc="Deux œuvres face à face : appariement fonction par fonction et score global pondéré."
            />
            <div className="mt-5 rounded-2xl border border-white/10 bg-[#120a24] p-4">
              <CompareMockup />
            </div>
          </BentoCard>

          {/* Répertoire */}
          <BentoCard delay={0.1}>
            <BentoTitle
              icon={BookMarked}
              title="53 fonctions, 7 familles"
              desc="Un répertoire de référence issu de Propp, enrichi de 7 fonctions propres aux traditions africaines."
            />
            <div className="mt-5 flex flex-wrap gap-1.5">
              {FN_FAMILIES.map((f, i) => (
                <span
                  key={f}
                  className={cn(
                    "rounded-full border px-3 py-1 text-[11px] font-medium transition-transform duration-300 hover:scale-105",
                    i === FN_FAMILIES.length - 1
                      ? "border-yellow/50 bg-yellow/12 text-[#8a5a10] dark:text-yellow"
                      : "border-lp-ink/12 bg-lp-ink/5 text-lp-ink/65",
                  )}
                >
                  {f}
                </span>
              ))}
            </div>
          </BentoCard>

          {/* Exports */}
          <BentoCard delay={0.15}>
            <BentoTitle
              icon={FileText}
              title="Rapports prêts à partager"
              desc="Exportez chaque analyse en PDF ou HTML mis en page — diagrammes, tableaux actantiels et scores inclus. Un dossier complet, prêt à joindre à une expertise."
            />
            <div className="mt-5 flex gap-2">
              {["PDF", "HTML", "Markdown"].map((f) => (
                <span key={f} className="rounded-lg border border-lp-ink/12 bg-lp-ink/5 px-3 py-1.5 text-[11px] font-bold tracking-wide text-lp-ink/70">
                  .{f.toLowerCase()}
                </span>
              ))}
            </div>
          </BentoCard>
        </div>
      </div>
    </section>
  );
}

/* ── Projets (section dédiée) ─────────────────────────────────────────── */
const PROJECT_FEATURES = [
  {
    icon: MailPlus,
    title: "Invitations par e-mail",
    desc: "Ajoutez un confrère, un doctorant ou un client en une adresse : il rejoint l'espace avec les bons droits.",
  },
  {
    icon: FolderKanban,
    title: "Tout rattaché à l'affaire",
    desc: "Analyses, comparaisons et conversations vivent dans le projet — plus de résultats éparpillés.",
  },
  {
    icon: Users,
    title: "Chat d'équipe contextualisé",
    desc: "L'agent connaît le corpus du projet : chacun l'interroge, tout le monde voit les réponses.",
  },
  {
    icon: History,
    title: "Historique et exports groupés",
    desc: "Chaque action est tracée ; exportez l'ensemble du dossier en un clic quand l'expertise est prête.",
  },
];

export function ProjectsSection() {
  return (
    <section id="projets" className="scroll-mt-28 py-24 sm:py-32">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <div className="grid items-center gap-12 lg:grid-cols-2 lg:gap-16">
          {/* Copie */}
          <Reveal effect="left">
            <div className="text-xs font-bold uppercase tracking-[0.25em] text-purple dark:text-soft-purple">
              Projets collaboratifs
            </div>
            <h2 className={`${koba.className} mt-3 text-balance text-3xl leading-tight tracking-wide text-lp-ink sm:text-4xl`}>
              <ScrollWords text="Une affaire, un corpus, une équipe — un seul espace" />
            </h2>
            <p className="mt-4 text-pretty text-[15px] leading-7 text-lp-ink/60">
              Un litige d&apos;intrigue ne s&apos;instruit jamais seul. Les projets NARR&apos;IA
              réunissent les textes, les analyses et les personnes autour du même dossier — avec
              l&apos;agent IA comme collaborateur permanent.
            </p>
            <div className="mt-8 space-y-5">
              {PROJECT_FEATURES.map((f, i) => (
                <Reveal key={f.title} delay={0.15 + i * 0.1}>
                  <div className="group flex gap-4">
                    <div className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-lp-ink/10 bg-lp-ink/5 text-purple transition-all duration-300 group-hover:scale-110 group-hover:border-pink/40 group-hover:text-pink dark:text-soft-purple dark:group-hover:text-soft-pink">
                      <f.icon className="h-4.5 w-4.5" />
                    </div>
                    <div>
                      <h3 className="font-heading text-[15px] font-bold text-lp-ink">{f.title}</h3>
                      <p className="mt-1 text-sm leading-6 text-lp-ink/55">{f.desc}</p>
                    </div>
                  </div>
                </Reveal>
              ))}
            </div>
          </Reveal>

          {/* Mockup + cartes flottantes */}
          <Reveal effect="right" delay={0.15}>
            <div className="relative">
              <div
                className="pointer-events-none absolute -inset-6 rounded-[40px] opacity-40 blur-3xl"
                style={{ background: "linear-gradient(140deg, rgba(132,59,144,0.45), rgba(218,56,97,0.3))" }}
                aria-hidden
              />
              <ProjectMockup className="relative" />

              {/* Invitation flottante */}
              <div className="lp-float absolute -right-4 -top-6 hidden w-56 rounded-2xl border border-white/12 bg-[#1d1233]/95 p-4 shadow-2xl backdrop-blur-xl sm:block">
                <div className="flex items-center gap-2 text-[12px] font-bold text-white">
                  <MailPlus className="h-4 w-4 text-soft-pink" />
                  Inviter un collaborateur
                </div>
                <div className="mt-2.5 flex h-8 items-center truncate rounded-lg border border-white/12 bg-white/5 px-2.5 text-[11px] text-white/50">
                  maitre.diallo@cabinet-ip.fr
                </div>
                <div className="mt-2.5 inline-flex h-7 items-center rounded-full bg-pink px-3 text-[11px] font-bold text-white">
                  Envoyer l&apos;invitation
                </div>
              </div>

              {/* Activité flottante */}
              <div className="lp-float-2 absolute -bottom-6 -left-4 hidden items-center gap-2.5 rounded-2xl border border-white/12 bg-[#1d1233]/95 px-4 py-3 shadow-2xl backdrop-blur-xl sm:flex">
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-yellow/15 text-yellow">
                  <GitCompareArrows className="h-4 w-4" />
                </span>
                <div>
                  <div className="text-[11.5px] font-bold text-white">AK a lancé une comparaison</div>
                  <div className="text-[10.5px] text-white/50">à l&apos;instant · visible par l&apos;équipe</div>
                </div>
              </div>
            </div>
          </Reveal>
        </div>
      </div>
    </section>
  );
}

/* ── Score SNS ────────────────────────────────────────────────────────── */
export function ScoreSection() {
  return (
    <section id="score" className="scroll-mt-28 py-24 sm:py-32">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <Reveal effect="zoom">
          <div className="relative overflow-hidden rounded-[36px] border border-white/10 bg-gradient-narria p-8 sm:p-14">
            <div
              className="pointer-events-none absolute -right-32 -top-32 h-96 w-96 rounded-full opacity-40 blur-[100px]"
              style={{ background: "#da3861" }}
              aria-hidden
            />
            <div className="lp-grain pointer-events-none absolute inset-0 opacity-[0.05]" aria-hidden />
            <div className="relative grid items-center gap-12 lg:grid-cols-2">
              <div>
                <div className="text-xs font-bold uppercase tracking-[0.25em] text-yellow">Score SNS</div>
                <h2 className={`${koba.className} mt-3 text-balance text-3xl leading-tight tracking-wide text-white sm:text-4xl`}>
                  <ScrollWords text="Un score que vous pouvez défendre" />
                </h2>
                <p className="mt-4 text-[15px] leading-7 text-white/70">
                  Le Score de Similarité Narrative n&apos;est pas une boîte noire : c&apos;est la
                  somme pondérée de cinq mesures structurelles, chacune consultable dans le
                  rapport. Au-delà du seuil de <strong className="text-white">0,40</strong>, deux
                  récits partagent la même intrigue.
                </p>
                <div className="mt-8 space-y-4">
                  <ScoreBar label="Isomorphisme de graphe" weight="0,25" value={0.91} color="#da3861" delay={0.1} />
                  <ScoreBar label="Distance d'édition" weight="0,20" value={0.82} color="#fc92a4" delay={0.2} />
                  <ScoreBar label="Fonctions narratives" weight="0,25" value={0.84} color="#c68cc4" delay={0.3} />
                  <ScoreBar label="Schéma actantiel" weight="0,15" value={0.88} color="#f4ad5c" delay={0.4} />
                  <ScoreBar label="Tension dramatique" weight="0,15" value={0.78} color="#ffffff" delay={0.5} />
                </div>
              </div>
              <div className="flex flex-col items-center gap-6">
                <div className="relative">
                  <div
                    className="pointer-events-none absolute inset-0 scale-125 rounded-full opacity-40 blur-2xl"
                    style={{ background: "radial-gradient(closest-side, rgba(218,56,97,0.8), transparent)" }}
                    aria-hidden
                  />
                  <RingGauge value={0.87} label="Score SNS" size={240} stroke={7} className="relative" />
                </div>
                <div className="flex items-center gap-2 rounded-full border border-yellow/35 bg-yellow/10 px-4 py-2 text-sm font-semibold text-yellow">
                  <TriangleAlert className="h-4 w-4" />
                  Similarité forte — seuil 0,40 dépassé
                </div>
                <p className="max-w-xs text-center text-xs leading-5 text-white/50">
                  Chaque sous-score est traçable jusqu&apos;aux fonctions narratives appariées qui
                  l&apos;ont produit.
                </p>
              </div>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}

/* ── Publics cibles ───────────────────────────────────────────────────── */
const AUDIENCES = [
  {
    icon: Building2,
    title: "Éditeurs",
    desc: "Vérifiez l'originalité structurelle d'un manuscrit avant de vous engager.",
  },
  {
    icon: Scale,
    title: "Avocats & experts PI",
    desc: "Objectivez un dossier de contrefaçon avec des indices chiffrés et reproductibles.",
  },
  {
    icon: GraduationCap,
    title: "Chercheurs",
    desc: "Cartographiez motifs et filiations narratives à l'échelle d'un corpus.",
  },
  {
    icon: PenTool,
    title: "Auteurs & scénaristes",
    desc: "Prouvez l'antériorité de votre intrigue — ou assurez-vous de ne pas en reprendre une.",
  },
];

export function Audiences() {
  return (
    <section className="py-10 sm:py-16">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <SectionHeader
          eyebrow="Pour qui"
          title="Pensé pour celles et ceux qui vivent des récits"
        />
        <div className="mt-14 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {AUDIENCES.map((a, i) => (
            <Reveal key={a.title} delay={i * 0.1} effect="flip">
              <div className="group h-full rounded-3xl border border-lp-ink/10 bg-lp-ink/3 p-6 transition-all duration-500 hover:-translate-y-1 hover:border-pink/35 hover:bg-lp-ink/5">
                <div className="mb-4 inline-flex h-11 w-11 items-center justify-center rounded-xl bg-purple/12 text-purple transition-colors duration-500 group-hover:bg-pink/20 group-hover:text-pink dark:bg-soft-purple/15 dark:text-soft-purple dark:group-hover:text-soft-pink">
                  <a.icon className="h-5 w-5" />
                </div>
                <h3 className="font-heading text-base font-bold text-lp-ink">{a.title}</h3>
                <p className="mt-1.5 text-sm leading-6 text-lp-ink/55">{a.desc}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ── Tarifs ───────────────────────────────────────────────────────────── */
const PLAN_PRICES: Record<string, { price: string; note: string; cta: string; highlight?: boolean }> = {
  starter: { price: "0 €", note: "pour toujours", cta: "Commencer gratuitement" },
  pro: { price: "29 €", note: "par mois", cta: "Passer en Pro", highlight: true },
  enterprise: { price: "Sur devis", note: "annuel", cta: "Nous contacter" },
};

export function Pricing() {
  const plans = Object.values(SUBSCRIPTION_PLANS);
  return (
    <section id="tarifs" className="scroll-mt-28 py-24 sm:py-32">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <SectionHeader
          eyebrow="Tarifs"
          title="Des formules à la mesure de vos corpus"
          sub="Commencez gratuitement, montez en puissance quand vos analyses s'intensifient."
        />
        <div className="mt-16 grid gap-5 lg:grid-cols-3">
          {plans.map((plan, i) => {
            const meta = PLAN_PRICES[plan.id];
            return (
              <Reveal key={plan.id} delay={i * 0.12} effect={meta.highlight ? "zoom" : "up"}>
                <div
                  className={cn(
                    "relative flex h-full flex-col rounded-3xl border p-7 transition-all duration-500 hover:-translate-y-1.5",
                    meta.highlight
                      ? "border-pink/50 bg-gradient-to-b from-pink/12 to-purple/8 shadow-[0_30px_90px_-30px_rgba(218,56,97,0.55)]"
                      : "border-lp-ink/10 bg-lp-ink/3 hover:border-lp-ink/20",
                  )}
                >
                  {meta.highlight && (
                    <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-pink px-3.5 py-1 text-[11px] font-bold uppercase tracking-wider text-white shadow-lg">
                      Populaire
                    </span>
                  )}
                  <h3 className="font-heading text-lg font-bold text-lp-ink">{plan.label}</h3>
                  <p className="mt-1 text-[13px] leading-5 text-lp-ink/55">{plan.tagline}</p>
                  <div className="mt-6 flex items-baseline gap-2">
                    <span className={`${koba.className} text-4xl tracking-wide text-lp-ink`}>{meta.price}</span>
                    <span className="text-sm text-lp-ink/45">{meta.note}</span>
                  </div>
                  <div className="mt-1 text-xs text-lp-ink/40">
                    {plan.quotaDaily} analyses / jour · {plan.quotaMonthly} / mois
                  </div>
                  <ul className="mt-6 flex-1 space-y-2.5">
                    {plan.features.map((f) => (
                      <li key={f} className="flex items-start gap-2.5 text-sm text-lp-ink/70">
                        <Check className={cn("mt-0.5 h-4 w-4 shrink-0", meta.highlight ? "text-pink dark:text-soft-pink" : "text-purple dark:text-soft-purple")} />
                        {f}
                      </li>
                    ))}
                  </ul>
                  <Link
                    href={plan.id === "enterprise" ? "mailto:contact@narria.app" : "/register"}
                    className={cn(
                      "lp-shine mt-7 inline-flex h-11 items-center justify-center gap-2 rounded-full text-sm font-semibold transition-all",
                      meta.highlight
                        ? "bg-pink text-white hover:bg-soft-pink"
                        : "border border-lp-ink/15 bg-lp-ink/5 text-lp-ink hover:border-lp-ink/30 hover:bg-lp-ink/10",
                    )}
                  >
                    {meta.cta}
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                </div>
              </Reveal>
            );
          })}
        </div>
      </div>
    </section>
  );
}

/* ── FAQ ──────────────────────────────────────────────────────────────── */
const FAQ = [
  {
    q: "Qu'est-ce que le « vol d'intrigue » exactement ?",
    a: "C'est la reprise de la structure narrative profonde d'une œuvre — enchaînement des fonctions, rapports entre actants, courbe de tension — sans nécessairement copier une seule phrase. Un plagiat que les détecteurs textuels classiques ne voient pas.",
  },
  {
    q: "En quoi NARR'IA diffère-t-il d'un détecteur de plagiat classique ?",
    a: "Les détecteurs classiques comparent des mots et des phrases. NARR'IA compare des graphes narratifs : deux récits aux vocabulaires totalement différents peuvent obtenir un score SNS élevé si leur intrigue est la même.",
  },
  {
    q: "Les résultats ont-ils une valeur juridique ?",
    a: "Les scores constituent des indices objectifs et reproductibles, non des preuves légales. Ils sont conçus pour étayer un dossier ou orienter une expertise, qui doit toujours être validée par un expert qualifié.",
  },
  {
    q: "Quels formats de fichiers sont acceptés ?",
    a: "Texte brut (.txt), Word (.docx), PDF, EPUB et OpenDocument (.odt). Le texte est extrait automatiquement, y compris pour les œuvres longues, découpées puis réassemblées.",
  },
  {
    q: "Mes manuscrits restent-ils confidentiels ?",
    a: "Oui. Vos textes ne sont ni partagés ni réutilisés pour entraîner des modèles ; ils ne sont visibles que de vous et des collaborateurs que vous invitez explicitement sur un projet.",
  },
];

export function Faq() {
  return (
    <section className="py-10 sm:py-16">
      <div className="mx-auto max-w-3xl px-4 sm:px-6">
        <SectionHeader eyebrow="FAQ" title="Questions fréquentes" />
        <div className="mt-12 space-y-3">
          {FAQ.map((item, i) => (
            <Reveal key={item.q} delay={i * 0.06} effect="blur">
              <details className="lp-faq group rounded-2xl border border-lp-ink/10 bg-lp-ink/3 transition-colors open:border-purple/35 open:bg-lp-ink/5">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-6 py-4.5 text-[15px] font-semibold text-lp-ink/85">
                  {item.q}
                  <span className="lp-faq-icon flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-lp-ink/15 text-lp-ink/60">
                    +
                  </span>
                </summary>
                <p className="px-6 pb-5 text-sm leading-7 text-lp-ink/60">{item.a}</p>
              </details>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ── CTA final ────────────────────────────────────────────────────────── */
export function FinalCta({ isAuthed }: { isAuthed: boolean }) {
  return (
    <section className="py-24 sm:py-32">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <Reveal effect="zoom">
          <div className="relative overflow-hidden rounded-[36px] border border-white/10 px-6 py-16 text-center sm:py-24">
            <div className="absolute inset-0 bg-gradient-narria" aria-hidden />
            <div
              className="lp-orb pointer-events-none absolute -bottom-24 left-1/2 h-72 w-[560px] -translate-x-1/2 rounded-full opacity-50 blur-[90px]"
              style={{ background: "radial-gradient(closest-side, #da3861, transparent)" }}
              aria-hidden
            />
            <div className="lp-grain pointer-events-none absolute inset-0 opacity-[0.05]" aria-hidden />
            <div className="relative">
              <h2 className={`${koba.className} mx-auto max-w-2xl text-balance text-3xl leading-tight tracking-wide text-white sm:text-5xl`}>
                <ScrollWords text="Votre prochaine lecture mérite un second regard." stagger={0.08} />
              </h2>
              <p className="mx-auto mt-5 max-w-xl text-[15px] leading-7 text-white/65">
                Analysez votre première œuvre en quelques minutes — gratuitement, sans carte
                bancaire.
              </p>
              <div className="mt-9 flex flex-wrap items-center justify-center gap-3">
                <Link
                  href={isAuthed ? "/accueil" : "/register"}
                  className="lp-shine inline-flex h-12 items-center gap-2 rounded-full bg-pink px-8 text-sm font-semibold text-white shadow-[0_10px_40px_-8px_rgba(218,56,97,0.8)] transition-all hover:-translate-y-0.5 hover:bg-soft-pink"
                >
                  {isAuthed ? "Ouvrir l'app" : "Créer mon compte"}
                  <ArrowRight className="h-4 w-4" />
                </Link>
                <Link
                  href="/login"
                  className="inline-flex h-12 items-center rounded-full border border-white/20 bg-white/5 px-8 text-sm font-semibold text-white/85 backdrop-blur transition-all hover:-translate-y-0.5 hover:bg-white/10"
                >
                  J&apos;ai déjà un compte
                </Link>
              </div>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}

/* ── Pied de page ─────────────────────────────────────────────────────── */
export function Footer() {
  return (
    <footer className="border-t border-lp-ink/8 py-12">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <div className="flex flex-col items-start justify-between gap-8 md:flex-row md:items-center">
          <div>
            <LogoFull className="h-7 w-auto dark:hidden" />
            <LogoFull white className="hidden h-7 w-auto dark:block" />
            <p className="mt-3 max-w-sm text-[13px] leading-6 text-lp-ink/45">
              Narratologie computationnelle : détectez, quantifiez et qualifiez le vol
              d&apos;intrigue.
            </p>
          </div>
          <nav className="grid grid-cols-2 gap-x-10 gap-y-3 text-sm text-lp-ink/55 sm:grid-cols-3">
            <div className="space-y-3">
              <div className="text-[11px] font-bold uppercase tracking-widest text-lp-ink/35">Produit</div>
              <Link href="/#produit" className="block transition-colors hover:text-lp-ink">Vue d&apos;ensemble</Link>
              <Link href="/produit/etudiants" className="block transition-colors hover:text-lp-ink">Pour les étudiants</Link>
              <Link href="/produit/recherche" className="block transition-colors hover:text-lp-ink">Pour la recherche</Link>
              <Link href="/produit/fun" className="block transition-colors hover:text-lp-ink">Pour le fun</Link>
            </div>
            <div className="space-y-3">
              <div className="text-[11px] font-bold uppercase tracking-widest text-lp-ink/35">Découvrir</div>
              <Link href="/#fonctionnement" className="block transition-colors hover:text-lp-ink">Fonctionnement</Link>
              <Link href="/#score" className="block transition-colors hover:text-lp-ink">Score SNS</Link>
              <Link href="/#projets" className="block transition-colors hover:text-lp-ink">Projets</Link>
              <Link href="/#tarifs" className="block transition-colors hover:text-lp-ink">Tarifs</Link>
              <Link href="/contact" className="block font-medium text-pink transition-colors hover:text-soft-pink">Contact</Link>
            </div>
            <div className="space-y-3">
              <div className="text-[11px] font-bold uppercase tracking-widest text-lp-ink/35">Contact & Compte</div>
              <a href="mailto:contact@narria.tech" className="block transition-colors hover:text-lp-ink">contact@narria.tech</a>
              <Link href="/login" className="block transition-colors hover:text-lp-ink">Connexion</Link>
              <Link href="/register" className="block transition-colors hover:text-lp-ink">Inscription</Link>
            </div>
          </nav>
        </div>
        <div className="mt-10 flex flex-col gap-4 border-t border-lp-ink/8 pt-6 text-xs leading-5 text-lp-ink/35 md:flex-row md:items-center md:justify-between">
          <p>© {new Date().getFullYear()} NARR&apos;IA. Tous droits réservés.</p>
          <p className="max-w-xl">
            NARR&apos;IA est un outil d&apos;aide à l&apos;analyse narrative. Ses résultats
            constituent des indices, non des preuves légales.
          </p>
        </div>
      </div>
    </footer>
  );
}
