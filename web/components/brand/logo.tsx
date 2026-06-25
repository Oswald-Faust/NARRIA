import Image from "next/image";
import fullLogo from "@/assets/narria-full-logo.png";
import mark from "@/assets/narria-simple-logo.png";
import fullMark from "@/assets/narria-full.png";
import { cn } from "@/lib/utils";

/** Logo complet horizontal (icône + mot « narr'ia »). */
export function LogoFull({ className, priority }: { className?: string; priority?: boolean }) {
  return (
    <Image src={fullLogo} alt="NARR'IA" priority={priority} className={cn("h-auto w-auto", className)} />
  );
}

/** Icône seule (le « n ») — pour la sidebar repliée. */
export function LogoMark({ className }: { className?: string }) {
  return <Image src={mark} alt="NARR'IA" className={cn("h-auto w-auto", className)} />;
}

/** Grande icône carrée — pour le centre de l'accueil. */
export function LogoEmblem({ className }: { className?: string }) {
  return <Image src={fullMark} alt="NARR'IA" className={cn("h-auto w-auto", className)} />;
}
