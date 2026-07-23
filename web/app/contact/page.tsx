import type { Metadata } from "next";
import { auth } from "@/auth";
import { LandingNavbar } from "@/components/landing/navbar";
import { Footer, SectionDivider } from "@/components/landing/sections";
import { ContactForm } from "@/components/landing/contact-form";
import { Reveal } from "@/components/landing/reveal";

export const metadata: Metadata = {
  title: "Contact — NARR'IA",
  description:
    "Contactez l'équipe NARR'IA directement à contact@narria.tech. Posez vos questions, demandez une démonstration ou partagez vos besoins narratologiques.",
};

export default async function ContactPage() {
  const session = await auth();
  const isAuthed = Boolean(session?.user);

  return (
    <div className="min-h-screen bg-lp-bg text-lp-ink selection:bg-pink/40 selection:text-lp-ink">
      <LandingNavbar isAuthed={isAuthed} />

      <main className="relative pt-28 pb-20 sm:pt-36 sm:pb-28">
        {/* Orbes décoratives de fond */}
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          <div
            className="lp-orb absolute -top-24 left-1/2 h-96 w-[600px] -translate-x-1/2 rounded-full opacity-30 blur-[120px]"
            style={{ background: "radial-gradient(closest-side, #843b90, transparent)" }}
            aria-hidden
          />
          <div
            className="lp-orb absolute top-1/3 -right-32 h-80 w-[450px] rounded-full opacity-25 blur-[100px]"
            style={{ background: "radial-gradient(closest-side, #da3861, transparent)" }}
            aria-hidden
          />
        </div>

        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          {/* En-tête héro de la page de contact */}
          <Reveal effect="blur">
            <div className="mx-auto max-w-3xl text-center">
              <span className="inline-flex items-center gap-2 rounded-full border border-purple/30 bg-purple/10 px-4 py-1.5 text-xs font-semibold text-purple dark:text-soft-purple">
                Discutons de votre projet
              </span>
              <h1 className="mt-4 text-balance text-4xl font-extrabold tracking-tight text-lp-ink sm:text-6xl">
                Contactez l&apos;équipe <span className="text-gradient-narria">NARR&apos;IA</span>
              </h1>
              <p className="mt-6 text-balance text-base leading-relaxed text-lp-ink/70 sm:text-lg">
                Une question sur le score SNS, besoin d&apos;une démonstration personnalisée ou envie d&apos;échanger directement avec nous ? Écrivez-nous à{" "}
                <a
                  href="mailto:contact@narria.tech"
                  className="font-bold text-pink underline decoration-pink/40 underline-offset-4 hover:text-soft-pink"
                >
                  contact@narria.tech
                </a>{" "}
                ou remplissez le formulaire ci-dessous.
              </p>
            </div>
          </Reveal>

          <div className="mt-16">
            <Reveal effect="zoom" delay={0.15}>
              <ContactForm />
            </Reveal>
          </div>
        </div>
      </main>

      <SectionDivider />
      <Footer />
    </div>
  );
}
