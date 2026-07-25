import type { Metadata } from "next";
import "./globals.css";
import { Providers } from "@/components/providers";
import { koba, kantumruy, quicksand } from "@/lib/fonts";
import { SITE_URL } from "@/lib/app-url";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
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
