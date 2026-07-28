import type { Metadata } from "next";
import { GraduationCap, PenTool, FlaskConical } from "lucide-react";
import { auth } from "@/auth";
import {
  OfferPage,
  OfferHero,
  OfferSection,
  OfferCards,
  OfferChecklist,
  OfferFrame,
  OfferClosingCta,
} from "@/components/landing/offer-page";

export const metadata: Metadata = {
  title: "NARR'IA Campus — La narratologie computationnelle dans vos maquettes",
  description:
    "Licence établissement : comptes enseignants et étudiants, espaces de classe, quotas mutualisés et facturation institutionnelle. Pour les cours de narratologie, les ateliers d'écriture et les UE d'IA appliquée à la discipline.",
};

const PROPOSAL_MAILTO =
  "mailto:contact@narria.tech?subject=Offre%20Campus%20-%20demande%20de%20proposition";

const CONTEXTS = [
  {
    icon: GraduationCap,
    title: "Cours de narratologie",
    desc: "Propp, Greimas et Bremond appliqués aux textes du programme, avec des schémas générés et discutables en classe.",
  },
  {
    icon: PenTool,
    title: "Ateliers de création littéraire",
    desc: "Les étudiants vérifient la structure de leurs textes — et leur originalité — avant de rendre.",
  },
  {
    icon: FlaskConical,
    title: "UE d'informatique et d'IA appliquée à la discipline",
    desc: "Un cas concret d'IA disciplinaire : un moteur documenté, des scores traçables, une méthode inspectable de bout en bout.",
  },
] as const;

const INCLUDED = [
  "Comptes enseignants et étudiants pour l'année universitaire, dimensionnés sur vos effectifs.",
  "Espaces de classe : l'enseignant crée un projet par cours, y dépose le corpus et suit le travail des étudiants.",
  "Quotas mutualisés à l'échelle de l'établissement.",
  "Une session de prise en main pour l'équipe pédagogique.",
  "Facturation institutionnelle : bon de commande et virement.",
] as const;

export default async function CampusPage() {
  const session = await auth();

  return (
    <OfferPage isAuthed={Boolean(session?.user)}>
      <OfferHero
        kicker="NARR'IA Campus"
        title="La narratologie computationnelle entre dans vos maquettes."
        subtitle="Une licence pour tout l'établissement : les enseignants pilotent, les étudiants analysent, l'administration facture en une ligne."
        primaryCta={{ label: "Demander une proposition", href: PROPOSAL_MAILTO }}
        secondaryCta={{ label: "Voir NARR'IA pour les étudiants", href: "/produit/etudiants" }}
        reassurance="Sur devis, selon vos effectifs"
      />

      <OfferSection eyebrow="Usages" title="Où NARR'IA s'insère">
        <OfferCards cards={CONTEXTS} />
      </OfferSection>

      <OfferSection eyebrow="La licence" title="Ce que comprend la licence">
        <OfferChecklist items={INCLUDED} />
      </OfferSection>

      <OfferFrame>
        <p>
          <strong>Pourquoi NARR&apos;IA en cours.</strong> Un moteur narratologique conçu en Afrique, fondé sur
          un répertoire documenté de 53 fonctions — dont 7 propres aux traditions orales africaines — et des
          scores entièrement traçables : les étudiants voient comment la mesure est construite, pas seulement
          son résultat.
        </p>
      </OfferFrame>

      <OfferClosingCta
        title="Équipez une promotion entière en une rentrée."
        cta={{ label: "Demander une proposition", href: PROPOSAL_MAILTO }}
      />
    </OfferPage>
  );
}
