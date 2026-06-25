import type { Metadata } from "next";
import { Quicksand, Kantumruy_Pro, Fredoka } from "next/font/google";
import "./globals.css";
import { Providers } from "@/components/providers";

const quicksand = Quicksand({
  variable: "--font-quicksand",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

const kantumruy = Kantumruy_Pro({
  variable: "--font-kantumruy",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
});

// Police d'affichage des gros titres (héros). Approximation de « KOBA » du Figma :
// pour un rendu pixel-perfect, remplacer cet import par next/font/local pointant
// vers le fichier KOBA.woff2 officiel (variable CSS --font-koba inchangée).
const koba = Fredoka({
  variable: "--font-koba",
  subsets: ["latin"],
  weight: ["500", "600", "700"],
});

export const metadata: Metadata = {
  title: "NARR'IA — Narratologie computationnelle",
  description:
    "Détectez, quantifiez et qualifiez le vol d'intrigue. Votre expert conversationnel en narratologie et littérature.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="fr"
      suppressHydrationWarning
      className={`${quicksand.variable} ${kantumruy.variable} ${koba.variable} h-full antialiased`}
    >
      <body className="min-h-full bg-background font-body text-foreground">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
