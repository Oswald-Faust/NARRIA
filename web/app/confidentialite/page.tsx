import type { Metadata } from "next";
import { auth } from "@/auth";
import {
  LegalPage,
  LegalSection,
  LegalSubsection,
  P,
  UL,
} from "@/components/legal/legal-page";
import {
  DATA_CONTROLLER,
  LEGAL_LAST_UPDATED,
  LEGAL_SUBPROCESSORS,
  MINIMUM_AGE,
  PRIVACY_CONTACT,
  RETENTION,
} from "@/lib/legal/entity";

export const metadata: Metadata = {
  title: "Politique de confidentialité — NARR'IA",
  description:
    "Quelles données NARR'IA traite, pourquoi, combien de temps, et quels sont vos droits. Vos textes ne sont ni partagés, ni vendus, ni utilisés pour entraîner des modèles.",
};

export default async function ConfidentialitePage() {
  const session = await auth();

  return (
    <LegalPage
      title="Politique de confidentialité"
      lastUpdated={LEGAL_LAST_UPDATED}
      isAuthed={Boolean(session?.user)}
      currentPath="/confidentialite"
    >
      <P>
        NARR&apos;IA analyse des œuvres que vous nous confiez. Cette politique explique, sans jargon inutile,
        quelles données nous traitons, pourquoi, combien de temps, et quels sont vos droits.
      </P>
      <div className="mt-5 rounded-2xl border border-purple/25 bg-purple/8 p-5">
        <p className="text-[15px] font-semibold leading-7 text-lp-ink">
          Vos textes ne sont ni partagés, ni vendus, ni utilisés pour entraîner des modèles d&apos;intelligence
          artificielle. Ils ne sont visibles que de vous et des collaborateurs que vous invitez explicitement
          sur un projet.
        </p>
      </div>

      <LegalSection title="1. Responsable du traitement">
        <P>
          <strong>{DATA_CONTROLLER}</strong>, joignable à{" "}
          <a href={`mailto:${PRIVACY_CONTACT}`} className="font-medium text-pink underline hover:text-soft-pink">
            {PRIVACY_CONTACT}
          </a>
          .
        </P>
      </LegalSection>

      <LegalSection title="2. Données que nous traitons">
        <LegalSubsection title="Données de compte">
          <P>
            Nom complet, adresse e-mail, affiliation institutionnelle (facultative), mot de passe (stocké sous
            forme hachée, jamais en clair).
          </P>
        </LegalSubsection>
        <LegalSubsection title="Contenus">
          <P>
            Les œuvres que vous déposez (fichiers txt, docx, pdf, epub, odt), les structures narratives qui en
            sont extraites (fonctions, schémas actantiels, courbes de tension), vos comparaisons, rapports,
            projets et conversations avec l&apos;agent.
          </P>
        </LegalSubsection>
        <LegalSubsection title="Données d'usage">
          <P>
            Journaux techniques (connexions, actions, adresses IP), consommation des quotas, préférences
            d&apos;interface.
          </P>
        </LegalSubsection>
        <LegalSubsection title="Données de facturation">
          <P>
            Pour les formules payantes : formule souscrite, historique de facturation. Les données de paiement
            (numéro de carte) sont traitées directement par notre prestataire de paiement{" "}
            <strong>FedaPay</strong> et ne transitent jamais par nos serveurs.
          </P>
        </LegalSubsection>
        <LegalSubsection title="Support">
          <P>Le contenu de vos échanges avec nous lorsque vous nous écrivez.</P>
        </LegalSubsection>
      </LegalSection>

      <LegalSection title="3. Pourquoi nous les traitons (finalités et bases légales)">
        <UL>
          <li>
            <strong>Fournir le Service</strong> — analyses, comparaisons, projets, rapports, gestion du compte
            et des quotas : exécution du contrat.
          </li>
          <li>
            <strong>Facturer</strong> les formules payantes et tenir notre comptabilité : exécution du contrat
            et obligation légale.
          </li>
          <li>
            <strong>Sécuriser</strong> le Service — prévention des abus, des fraudes et des contournements de
            quotas : intérêt légitime.
          </li>
          <li>
            <strong>Vous répondre</strong> lorsque vous nous contactez : intérêt légitime.
          </li>
          <li>
            <strong>Vous informer</strong> des évolutions substantielles du Service ou de la présente politique :
            exécution du contrat.
          </li>
        </UL>
        <P>
          Nous n&apos;envoyons pas de prospection commerciale sans votre consentement, et nous ne vendons vos
          données à personne.
        </P>
      </LegalSection>

      <LegalSection title="4. Vos textes : ce que nous en faisons, et ce que nous n'en faisons pas">
        <UL>
          <li>
            Vos œuvres et les structures qui en sont extraites servent exclusivement à produire <strong>vos</strong>{" "}
            analyses, comparaisons et rapports.
          </li>
          <li>
            Elles ne sont <strong>jamais</strong> utilisées pour entraîner, affiner ou évaluer des modèles
            d&apos;intelligence artificielle — ni les nôtres, ni ceux de tiers.
          </li>
          <li>
            Elles ne sont visibles que de votre compte et des collaborateurs que vous invitez explicitement sur
            un projet. Nos équipes techniques n&apos;y accèdent que si c&apos;est strictement nécessaire au
            support ou à la sécurité, sur demande motivée et tracée.
          </li>
          <li>
            Vous pouvez supprimer une œuvre à tout moment ; la suppression retire l&apos;œuvre et ses structures
            dérivées du Service (hors sauvegardes techniques, purgées sous{" "}
            {RETENTION.backupsPurge}).
          </li>
        </UL>
        <P>
          L&apos;extraction narrative fait appel à un fournisseur d&apos;inférence tiers, Anthropic, dont les
          conditions commerciales excluent l&apos;entraînement de modèles sur les données transmises par ses
          clients. Il figure au tableau des sous-traitants ci-dessous.
        </P>
      </LegalSection>

      <LegalSection title="5. Qui accède à vos données (destinataires et sous-traitants)">
        <P>
          Nous faisons appel à des prestataires techniques strictement nécessaires au fonctionnement du Service,
          chacun lié par contrat aux mêmes exigences de confidentialité :
        </P>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[520px] border-collapse text-sm">
            <thead>
              <tr className="border-b border-lp-ink/15 text-left text-lp-ink/55">
                <th className="py-2.5 pr-4 font-semibold">Prestataire</th>
                <th className="py-2.5 pr-4 font-semibold">Rôle</th>
                <th className="py-2.5 font-semibold">Localisation des données</th>
              </tr>
            </thead>
            <tbody>
              {LEGAL_SUBPROCESSORS.map((sub) => (
                <tr key={sub.role} className="border-b border-lp-ink/8 align-top">
                  <td className="py-3 pr-4 font-medium text-lp-ink/85">{sub.name}</td>
                  <td className="py-3 pr-4 text-lp-ink/70">{sub.role}</td>
                  <td className="py-3 text-lp-ink/70">{sub.location}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <P>Aucun autre destinataire, hors obligation légale (réquisition d&apos;une autorité compétente).</P>
      </LegalSection>

      <LegalSection title="6. Transferts hors de l'Union européenne">
        <P>
          Lorsque des données de résidents de l&apos;Union européenne sont traitées hors de l&apos;UE, ces
          transferts sont encadrés par des garanties appropriées (clauses contractuelles types de la Commission
          européenne ou mécanisme équivalent).
        </P>
        <P>
          Certains de nos sous-traitants sont établis aux États-Unis (Anthropic, Cloudflare, Voyage AI). Les
          transferts correspondants reposent sur les clauses contractuelles types de la Commission européenne
          intégrées à leurs conditions de service.
        </P>
      </LegalSection>

      <LegalSection title="7. Durées de conservation">
        <UL>
          <li>
            Données de compte : durée de vie du compte, puis suppression sous{" "}
            {RETENTION.accountAfterClosure} après clôture.
          </li>
          <li>
            Œuvres et analyses : jusqu&apos;à suppression par vous ou clôture du compte ; sauvegardes techniques
            purgées sous {RETENTION.backupsPurge}.
          </li>
          <li>
            Journaux techniques : {RETENTION.technicalLogs}.
          </li>
          <li>Données de facturation : durée légale de conservation comptable applicable.</li>
        </UL>
      </LegalSection>

      <LegalSection title="8. Sécurité">
        <P>
          Le Service applique notamment : chiffrement des échanges en transit (TLS), hachage des mots de passe,
          cloisonnement des accès par compte et par projet, journalisation des accès.
        </P>
        <P>
          Les accès administratifs sont nominatifs et tracés, et les sauvegardes de la base de données sont
          chiffrées au repos par notre hébergeur.
        </P>
        <P>
          En cas de violation de données susceptible d&apos;engendrer un risque pour vos droits, nous vous en
          informons dans les conditions prévues par la réglementation applicable.
        </P>
      </LegalSection>

      <LegalSection title="9. Cookies">
        <P>
          Le Site utilise des cookies strictement nécessaires au fonctionnement (session, préférences
          d&apos;interface).
        </P>
        <P>
          Ces cookies servent à vous maintenir connecté et à mémoriser votre thème d&apos;affichage. Le Site ne
          dépose aucun cookie de mesure d&apos;audience, de publicité ou de réseau social : aucun consentement
          préalable n&apos;est donc requis.
        </P>
      </LegalSection>

      <LegalSection title="10. Vos droits">
        <P>
          Vous disposez des droits d&apos;accès, de rectification, d&apos;effacement, de portabilité, de
          limitation et d&apos;opposition sur vos données, dans les conditions prévues par la réglementation
          applicable. Pour les exercer :{" "}
          <a href={`mailto:${PRIVACY_CONTACT}`} className="font-medium text-pink underline hover:text-soft-pink">
            {PRIVACY_CONTACT}
          </a>
          . Nous répondons sous un mois.
        </P>
        <P>
          Si vous résidez dans l&apos;Union européenne, vous pouvez également saisir l&apos;autorité de contrôle
          de votre pays (en France, la CNIL).
        </P>
      </LegalSection>

      <LegalSection title="11. Âge minimum">
        <P>
          Le Service est ouvert aux personnes de {MINIMUM_AGE.value} ans et plus.
        </P>
      </LegalSection>

      <LegalSection title="12. Évolution de cette politique">
        <P>
          Toute modification substantielle vous est notifiée par e-mail ou via le Service avant son entrée en
          vigueur.
        </P>
      </LegalSection>
    </LegalPage>
  );
}
