import type { Metadata } from "next";
import { auth } from "@/auth";
import { LandingNavbar } from "@/components/landing/navbar";
import { Hero } from "@/components/landing/hero";
import {
  MarqueeStrip, HowItWorks, BentoFeatures, ProjectsSection, ScoreSection,
  Audiences, Faq, FinalCta, Footer, SectionDivider,
} from "@/components/landing/sections";
import { Pricing } from "@/components/landing/pricing";

export const metadata: Metadata = {
  title: "NARR'IA — Le vol d'intrigue ne passe plus inaperçu",
  description:
    "NARR'IA lit la structure profonde de vos récits et détecte le plagiat d'intrigue là où les mots ne se ressemblent pas. Score SNS explicable, 53 fonctions narratives, rapports exportables.",
};

/** Page d'accueil produit (landing marketing publique). */
export default async function LandingPage() {
  const session = await auth();
  const isAuthed = Boolean(session?.user);

  return (
    <div className="min-h-screen bg-lp-bg text-lp-ink selection:bg-pink/40 selection:text-lp-ink">
      <LandingNavbar isAuthed={isAuthed} />
      <main>
        <Hero isAuthed={isAuthed} />
        <MarqueeStrip />
        <HowItWorks />
        <SectionDivider />
        <BentoFeatures />
        <SectionDivider />
        <ProjectsSection />
        <ScoreSection />
        <Audiences />
        <SectionDivider />
        <Pricing />
        <Faq />
        <FinalCta isAuthed={isAuthed} />
      </main>
      <Footer />
    </div>
  );
}
