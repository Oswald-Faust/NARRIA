import Link from "next/link";
import {
  ScanText,
  GitCompareArrows,
  BookMarked,
  ArrowRight,
  TriangleAlert,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardTitle, CardDescription } from "@/components/ui/card";

const ACTIONS = [
  {
    href: "/analyser",
    icon: ScanText,
    title: "Analyser un texte",
    desc: "Soumettez une œuvre pour détecter sa structure narrative profonde et identifier les schémas constitutifs.",
    cta: "Lancer l'analyse",
  },
  {
    href: "/comparer",
    icon: GitCompareArrows,
    title: "Comparer deux textes",
    desc: "Confrontez deux œuvres et obtenez les scores SNS, SS, ST et SRJ de risque de plagiat d'intrigue.",
    cta: "Comparer maintenant",
  },
  {
    href: "/repertoire",
    icon: BookMarked,
    title: "Explorer le répertoire",
    desc: "Parcourez les 53 fonctions narratives réparties en 7 familles, dont 7 propres aux traditions africaines.",
    cta: "Explorer",
  },
];

export default function AccueilPage() {
  return (
    <div className="mx-auto max-w-6xl space-y-6">
      {/* Hero */}
      <section className="bg-gradient-narria relative overflow-hidden rounded-[var(--radius-card)] px-8 py-10">
        <div className="relative z-10 max-w-2xl">
          <span className="inline-block rounded-full bg-white/15 px-3 py-1 text-xs font-semibold text-white">
            Narratologie computationnelle
          </span>
          <h1 className="mt-4 font-heading text-3xl font-bold text-white">
            Bienvenue sur NARR&apos;IA
          </h1>
          <p className="mt-3 text-sm text-white/80">
            Détectez, quantifiez et qualifiez le vol d&apos;intrigue. Analysez la
            structure narrative profonde d&apos;une œuvre, comparez-la à une autre,
            ou interrogez votre expert conversationnel en littérature.
          </p>
          <Link href="/chat">
            <Button variant="primary" className="mt-6">
              Démarrer avec NARR&apos;IA Chat <ArrowRight className="h-4 w-4" />
            </Button>
          </Link>
        </div>
        <div className="absolute -right-10 -top-10 z-0 h-64 w-64 rounded-full bg-white/10 blur-2xl" />
      </section>

      {/* Cards d'action */}
      <section className="grid gap-5 md:grid-cols-3">
        {ACTIONS.map(({ href, icon: Icon, title, desc, cta }) => (
          <Card key={href} className="flex flex-col">
            <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-soft-purple/20 text-soft-purple">
              <Icon className="h-6 w-6" />
            </div>
            <CardTitle>{title}</CardTitle>
            <CardDescription className="flex-1">{desc}</CardDescription>
            <Link href={href} className="mt-5">
              <Button variant="purple" size="sm" className="w-full">
                {cta} <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
          </Card>
        ))}
      </section>

      {/* Bandeau d'avertissement */}
      <div className="flex items-start gap-3 rounded-[var(--radius-card)] border border-yellow/30 bg-yellow/10 px-5 py-4">
        <TriangleAlert className="mt-0.5 h-5 w-5 shrink-0 text-yellow" />
        <p className="text-sm text-foreground/90">
          <span className="font-semibold">Avertissement important.</span>{" "}
          NARR&apos;IA est un outil d&apos;analyse narratologique. Ses scores
          constituent une aide à l&apos;expertise et non une preuve juridique
          définitive de plagiat. L&apos;interprétation finale relève toujours du
          jugement humain.
        </p>
      </div>
    </div>
  );
}
