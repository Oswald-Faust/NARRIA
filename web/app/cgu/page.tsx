import type { Metadata } from "next";
import Link from "next/link";
import { auth } from "@/auth";
import { LegalPage, LegalSection, P } from "@/components/legal/legal-page";
import {
  GOVERNING_LAW,
  LEGAL_ENTITY,
  LEGAL_LAST_UPDATED,
  MINIMUM_AGE,
} from "@/lib/legal/entity";

export const metadata: Metadata = {
  title: "Conditions générales d'utilisation — NARR'IA",
  description:
    "Conditions d'accès et d'utilisation de la plateforme NARR'IA : compte, formules et quotas, contenus déposés, propriété intellectuelle, responsabilité.",
};

export default async function CguPage() {
  const session = await auth();

  return (
    <LegalPage
      title="Conditions générales d'utilisation"
      lastUpdated={LEGAL_LAST_UPDATED}
      isAuthed={Boolean(session?.user)}
      currentPath="/cgu"
    >
      <LegalSection title="Article 1 — Objet">
        <P>
          Les présentes conditions régissent l&apos;accès et l&apos;utilisation de la plateforme NARR&apos;IA
          (« le Service »), éditée par <strong>{LEGAL_ENTITY.denomination}</strong> (« l&apos;Éditeur »),
          accessible à l&apos;adresse narria.tech. La création d&apos;un compte vaut acceptation pleine et
          entière des présentes conditions et de la{" "}
          <Link href="/confidentialite" className="font-medium text-pink underline hover:text-soft-pink">
            Politique de confidentialité
          </Link>
          .
        </P>
      </LegalSection>

      <LegalSection title="Article 2 — Description du Service">
        <P>
          NARR&apos;IA est un service d&apos;analyse narratologique computationnelle : extraction de structures
          narratives (fonctions, schémas actantiels, courbes de tension), comparaison d&apos;œuvres et production
          d&apos;un Score de Similarité Narrative (SNS), génération de rapports, espaces de projets collaboratifs
          et agent conversationnel.
        </P>
        <P>
          <strong>Portée des résultats.</strong> Les scores et rapports NARR&apos;IA constituent des indices
          objectifs et reproductibles, non des preuves légales. Ils sont conçus pour étayer un dossier ou
          orienter une expertise, qui doit toujours être validée par un expert qualifié. L&apos;Éditeur ne
          fournit aucun conseil juridique.
        </P>
      </LegalSection>

      <LegalSection title="Article 3 — Compte">
        <P>
          L&apos;utilisateur s&apos;engage à fournir des informations exactes, à maintenir la confidentialité de
          ses identifiants et à signaler sans délai tout accès non autorisé. Chaque compte est personnel ; le
          partage d&apos;identifiants pour contourner les limites de sièges est interdit. Le Service est ouvert
          aux personnes de {MINIMUM_AGE.value} ans et plus.
        </P>
      </LegalSection>

      <LegalSection title="Article 4 — Formules, quotas et évolution des tarifs">
        <P>
          Les formules, quotas et tarifs en vigueur sont ceux affichés sur la page{" "}
          <Link href="/#tarifs" className="font-medium text-pink underline hover:text-soft-pink">
            Tarifs
          </Link>{" "}
          au moment de la souscription. Les quotas non consommés ne sont pas reportés. L&apos;Éditeur peut faire
          évoluer la grille tarifaire ; toute modification applicable à un abonnement en cours est notifiée au
          moins 30 jours avant son entrée en vigueur, l&apos;utilisateur restant libre de résilier avant cette
          date.
        </P>
      </LegalSection>

      <LegalSection title="Article 5 — Paiement, renouvellement, résiliation">
        <P>
          Les abonnements sont payables d&apos;avance et renouvelés tacitement par période (mensuelle ou
          annuelle). L&apos;utilisateur peut résilier à tout moment depuis son compte ; la résiliation prend
          effet à la fin de la période en cours, sans remboursement prorata de la période entamée.
        </P>
        <P>
          <strong>Droit de rétractation (consommateurs de l&apos;UE).</strong> Conformément à la réglementation
          applicable, le consommateur dispose d&apos;un délai de rétractation de 14 jours ; en souscrivant une
          formule payante et en demandant l&apos;exécution immédiate du Service, il reconnaît expressément que
          l&apos;utilisation du Service avant la fin de ce délai peut emporter renonciation ou limitation de ce
          droit dans les conditions légales.
        </P>
      </LegalSection>

      <LegalSection title="Article 6 — Contenus déposés par l'utilisateur">
        <P>
          L&apos;utilisateur <strong>conserve l&apos;intégralité de ses droits</strong> sur les œuvres qu&apos;il
          dépose. Il concède à l&apos;Éditeur une licence limitée, non exclusive et révocable, aux seules fins
          techniques de fournir le Service (stockage, extraction des structures, génération des analyses et
          rapports, partage avec les collaborateurs qu&apos;il invite).
        </P>
        <P>
          L&apos;utilisateur garantit disposer des droits ou autorisations nécessaires pour soumettre une œuvre à
          l&apos;analyse, et demeure seul responsable de l&apos;usage qu&apos;il fait des analyses et rapports,
          notamment lorsqu&apos;il soumet des œuvres de tiers à des fins d&apos;étude ou de comparaison.
        </P>
        <P>
          Sont interdits les contenus manifestement illicites, notamment ceux contraires à la dignité des
          personnes ou impliquant des mineurs.
        </P>
      </LegalSection>

      <LegalSection title="Article 7 — Usages interdits">
        <P>
          Sont notamment interdits : le contournement des quotas ou des limites de formule ; la revente ou la
          sous-licence du Service sans accord écrit ; l&apos;extraction systématique du répertoire, des scores ou
          des rapports en vue de constituer un service concurrent ; les tentatives d&apos;accès non autorisé, de
          rétro-ingénierie du moteur ou de perturbation du Service ; tout usage contraire à la loi.
        </P>
      </LegalSection>

      <LegalSection title="Article 8 — Propriété intellectuelle de l'Éditeur">
        <P>
          La plateforme, la marque NARR&apos;IA, le répertoire des fonctions narratives, la méthode de calcul du
          SNS, les interfaces et la documentation demeurent la propriété exclusive de l&apos;Éditeur. Les
          rapports générés peuvent être librement utilisés, cités et joints à des dossiers par l&apos;utilisateur,
          sous réserve de ne pas en altérer le contenu.
        </P>
      </LegalSection>

      <LegalSection title="Article 9 — Disponibilité et évolution du Service">
        <P>
          L&apos;Éditeur s&apos;efforce d&apos;assurer une disponibilité continue du Service, sans garantie
          d&apos;absence d&apos;interruption (maintenance, incident, force majeure). Les fonctionnalités peuvent
          évoluer ; les évolutions substantielles défavorables applicables aux abonnements en cours sont
          notifiées dans les conditions de l&apos;article 4.
        </P>
      </LegalSection>

      <LegalSection title="Article 10 — Responsabilité">
        <P>
          Le Service est fourni « en l&apos;état ». Dans les limites permises par la loi, la responsabilité de
          l&apos;Éditeur est limitée aux dommages directs prouvés et plafonnée aux sommes effectivement versées
          par l&apos;utilisateur au titre des 12 derniers mois. L&apos;Éditeur n&apos;est pas responsable des
          décisions — éditoriales, académiques, judiciaires ou autres — prises sur le fondement des analyses.
        </P>
      </LegalSection>

      <LegalSection title="Article 11 — Suspension et clôture">
        <P>
          L&apos;Éditeur peut suspendre ou clore un compte en cas de manquement grave ou répété aux présentes
          conditions, après notification et, sauf urgence, mise en demeure restée sans effet. L&apos;utilisateur
          peut exporter ses rapports avant clôture ; les données sont ensuite traitées conformément à la{" "}
          <Link href="/confidentialite" className="font-medium text-pink underline hover:text-soft-pink">
            Politique de confidentialité
          </Link>
          .
        </P>
      </LegalSection>

      <LegalSection title="Article 12 — Clients professionnels et institutions">
        <P>
          Les formules Équipe et Institution peuvent donner lieu à des conditions particulières (nombre de
          sièges, accord de traitement des données, facturation sur bon de commande) qui complètent les
          présentes conditions. En cas de contradiction, les conditions particulières prévalent.
        </P>
      </LegalSection>

      <LegalSection title="Article 13 — Droit applicable et litiges">
        <P>
          Les présentes conditions sont régies par le droit {GOVERNING_LAW.law}. Tout litige sera porté devant
          les juridictions compétentes de {GOVERNING_LAW.jurisdiction}, sans préjudice des règles impératives
          protectrices des consommateurs de leur pays de résidence, y compris les dispositifs de médiation de la
          consommation applicables.
        </P>
      </LegalSection>
    </LegalPage>
  );
}
