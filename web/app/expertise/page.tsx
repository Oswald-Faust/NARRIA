import type { Metadata } from "next";
import { Scale, BookMarked, PenTool } from "lucide-react";
import { auth } from "@/auth";
import {
  OfferPage,
  OfferHero,
  OfferSection,
  OfferCards,
  OfferChecklist,
  OfferSteps,
  OfferFrame,
  OfferClosingCta,
} from "@/components/landing/offer-page";

export const metadata: Metadata = {
  title: "NARR'IA Expertise — Un dossier, un corpus, un rapport défendable",
  description:
    "Forfait au dossier pour avocats, experts PI et éditeurs : espace dédié, analyses illimitées sur le corpus du litige, rapport d'expertise SNS horodaté et traçable.",
};

const OPEN_CASE_MAILTO =
  "mailto:contact@narria.tech?subject=Ouverture%20d%27un%20dossier%20Expertise";

const AUDIENCES = [
  {
    icon: Scale,
    title: "Avocats & experts PI",
    desc: "Objectivez un dossier de contrefaçon avec des indices chiffrés, reproductibles et expliqués.",
  },
  {
    icon: BookMarked,
    title: "Éditeurs",
    desc: "Levez un doute sur un manuscrit avant publication — ou documentez-le après.",
  },
  {
    icon: PenTool,
    title: "Auteurs & scénaristes",
    desc: "Établissez l'antériorité structurelle de votre intrigue face à une reprise présumée.",
  },
] as const;

const INCLUDED = [
  "Un projet dédié et confidentiel — accessible uniquement aux personnes que vous invitez.",
  "Analyses et comparaisons illimitées sur le corpus du dossier, versions et variantes comprises.",
  "Un rapport d'expertise horodaté : score SNS, cinq sous-scores, appariements fonction par fonction, schémas actantiels, courbes de tension et paramètres du modèle.",
  "Un interlocuteur pendant l'instruction, pour expliquer la méthode et répondre aux questions techniques.",
  "Exports PDF et HTML prêts à joindre au dossier.",
] as const;

const STEPS = [
  { n: "01", title: "Vous ouvrez le dossier.", desc: "Corpus transmis, périmètre défini, devis confirmé." },
  { n: "02", title: "Nous instruisons.", desc: "Analyses, comparaisons, itérations avec vous jusqu'à couvrir le périmètre." },
  { n: "03", title: "Vous recevez le rapport.", desc: "PDF horodaté, plus l'accès permanent à l'espace projet." },
] as const;

export default async function ExpertisePage() {
  const session = await auth();

  return (
    <OfferPage isAuthed={Boolean(session?.user)}>
      <OfferHero
        kicker="NARR'IA Expertise"
        title="Un litige d'intrigue. Un rapport défendable."
        subtitle="Forfait au dossier : un espace dédié et confidentiel, des analyses illimitées sur le corpus de l'affaire, et un rapport d'expertise complet — chaque score traçable jusqu'aux fonctions narratives qui l'ont produit."
        primaryCta={{ label: "Ouvrir un dossier", href: OPEN_CASE_MAILTO }}
        secondaryCta={{ label: "Voir la méthode SNS", href: "/#score" }}
        reassurance="À partir de 590 € par dossier · Confidentialité contractuelle · Rapport sous 5 jours ouvrés"
      />

      <OfferSection eyebrow="Pour qui" title="Trois situations, une même exigence de preuve">
        <OfferCards cards={AUDIENCES} />
      </OfferSection>

      <OfferSection eyebrow="Le forfait" title="Ce que comprend le forfait">
        <OfferChecklist items={INCLUDED} />
      </OfferSection>

      <OfferSection eyebrow="Déroulé" title="Le déroulé">
        <OfferSteps steps={STEPS} />
      </OfferSection>

      <OfferFrame>
        <p>
          <strong>Le cadre.</strong> Les scores NARR&apos;IA constituent des indices objectifs et
          reproductibles, non des preuves légales. Le rapport est conçu pour étayer un dossier ou orienter une
          expertise, qui doit être validée par un expert qualifié.
        </p>
      </OfferFrame>

      <OfferClosingCta
        title="Votre affaire mérite des indices structurels."
        cta={{ label: "Ouvrir un dossier", href: OPEN_CASE_MAILTO }}
      />
    </OfferPage>
  );
}
