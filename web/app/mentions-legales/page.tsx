import type { Metadata } from "next";
import Link from "next/link";
import { auth } from "@/auth";
import { LegalPage, LegalSection, P, UL, Placeholder } from "@/components/legal/legal-page";
import { CONTACT_EMAIL, LEGAL_ENTITY, LEGAL_HOSTING } from "@/lib/legal/entity";

export const metadata: Metadata = {
  title: "Mentions légales — NARR'IA",
  description:
    "Éditeur, directeur de la publication, hébergement et propriété intellectuelle du site narria.tech et de la plateforme NARR'IA.",
};

export default async function MentionsLegalesPage() {
  const session = await auth();

  return (
    <LegalPage title="Mentions légales" isAuthed={Boolean(session?.user)} currentPath="/mentions-legales">
      <LegalSection title="Éditeur du site">
        <P>
          Le site narria.tech (« le Site ») et la plateforme NARR&apos;IA (« le Service ») sont édités par : 
            <strong>{LEGAL_ENTITY.denomination}</strong> —{" "}
            <a
              href={`https://${LEGAL_ENTITY.website}`}
              target="_blank"
              rel="noopener noreferrer"
              className="font-medium text-pink underline hover:text-soft-pink"
            >
              {LEGAL_ENTITY.website}
            </a>
           Contact :{" "}
          <a href={`mailto:${CONTACT_EMAIL}`} className="font-medium text-pink underline hover:text-soft-pink">
            {CONTACT_EMAIL}
          </a>
        </P>
      </LegalSection>

      <LegalSection title="Directeur de la publication">
        <P>{LEGAL_ENTITY.publicationDirector}</P>
      </LegalSection>

      <LegalSection title="Hébergement">
        <P>Le Site est hébergé par :</P>
        <UL>
          <li>
            <strong>{LEGAL_HOSTING.name}</strong>
          </li>
          <li>{LEGAL_HOSTING.contact}</li>
        </UL>
        <P>{LEGAL_HOSTING.domain}.</P>
      </LegalSection>

      <LegalSection title="Propriété intellectuelle">
        <P>
          L&apos;ensemble des éléments du Site et du Service — textes, interfaces, éléments graphiques, logo et
          marque NARR&apos;IA, répertoire des fonctions narratives, documentation, gabarits de rapports — est
          protégé par le droit de la propriété intellectuelle et demeure la propriété exclusive de
          l&apos;éditeur ou de ses concédants. Toute reproduction ou représentation, totale ou partielle, sans
          autorisation écrite préalable est interdite.
        </P>
        <P>
          Les œuvres déposées par les utilisateurs sur le Service restent la propriété de leurs titulaires
          respectifs (voir les{" "}
          <Link href="/cgu" className="font-medium text-pink underline hover:text-soft-pink">
            Conditions générales d&apos;utilisation
          </Link>
          ).
        </P>
      </LegalSection>

      <LegalSection title="Signalement">
        <P>
          Pour signaler un contenu ou un usage illicite du Service :{" "}
          <a href={`mailto:${CONTACT_EMAIL}`} className="font-medium text-pink underline hover:text-soft-pink">
            {CONTACT_EMAIL}
          </a>
          .
        </P>
      </LegalSection>
    </LegalPage>
  );
}
