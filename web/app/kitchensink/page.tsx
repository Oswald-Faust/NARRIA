import { ScanText, GitCompareArrows, BookMarked, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { GradientHeader } from "@/components/ui/gradient-header";

/**
 * Vitrine temporaire du design system (kitchensink) — sera remplacée par la
 * landing publique. Sert à valider la charte NARR'IA (couleurs, typo, composants).
 */
export default function KitchenSinkPage() {
  return (
    <main className="mx-auto max-w-5xl space-y-10 px-6 py-12">
      <div>
        <h1 className="font-display text-4xl font-bold">
          NARR&apos;IA — <span className="text-gradient-narria">Design system</span>
        </h1>
        <p className="mt-2 text-muted">
          Quicksand pour les titres · Kantumruy pour le corps · palette purple/pink.
        </p>
      </div>

      <GradientHeader
        title="Analyser un texte"
        subtitle="Soumettez une œuvre pour détecter sa structure narrative profonde."
        icon={<ScanText className="h-6 w-6" />}
        action={<Button variant="secondary">Lancer l&apos;analyse</Button>}
      />

      <section className="space-y-4">
        <h2 className="font-heading text-xl font-bold">Boutons</h2>
        <div className="flex flex-wrap gap-3">
          <Button variant="primary">Accéder à NARR&apos;IA</Button>
          <Button variant="purple">Analyser</Button>
          <Button variant="secondary">Réinitialiser</Button>
          <Button variant="outline">Annuler</Button>
          <Button variant="ghost">En savoir plus</Button>
          <Button variant="primary" disabled>
            Désactivé
          </Button>
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="font-heading text-xl font-bold">Badges</h2>
        <div className="flex flex-wrap gap-3">
          <Badge tone="purple">Rupture</Badge>
          <Badge tone="pink">SNS 0.82</Badge>
          <Badge tone="yellow">Modéré</Badge>
          <Badge tone="success">Faible risque</Badge>
          <Badge tone="danger">Critique</Badge>
          <Badge tone="neutral">Exposition</Badge>
        </div>
      </section>

      <section className="grid gap-5 md:grid-cols-3">
        {[
          { icon: ScanText, t: "Analyser un texte", d: "Décompose un récit en graphe narratif." },
          { icon: GitCompareArrows, t: "Comparer deux textes", d: "Scores SNS, SS, ST, SRJ entre deux œuvres." },
          { icon: BookMarked, t: "Explorer le répertoire", d: "53 fonctions narratives en 7 familles." },
        ].map(({ icon: Icon, t, d }) => (
          <Card key={t}>
            <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-2xl bg-soft-purple/20 text-soft-purple">
              <Icon className="h-5 w-5" />
            </div>
            <CardTitle>{t}</CardTitle>
            <CardDescription>{d}</CardDescription>
            <Button variant="purple" size="sm" className="mt-5">
              Ouvrir <ArrowRight className="h-4 w-4" />
            </Button>
          </Card>
        ))}
      </section>

      <section className="space-y-3">
        <h2 className="font-heading text-xl font-bold">Palette</h2>
        <div className="grid grid-cols-3 gap-3 sm:grid-cols-6">
          {[
            ["Dark Purple", "bg-dark-purple"],
            ["Purple", "bg-purple"],
            ["Pink", "bg-pink"],
            ["Yellow", "bg-yellow"],
            ["Soft Purple", "bg-soft-purple"],
            ["Soft Pink", "bg-soft-pink"],
          ].map(([name, bg]) => (
            <div key={name} className="space-y-2">
              <div className={`h-16 rounded-xl ${bg}`} />
              <p className="text-xs text-muted">{name}</p>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}
