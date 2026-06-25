import type { Metadata } from "next";
import { Quicksand, Kantumruy_Pro } from "next/font/google";
import "./globals.css";

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
      className={`${quicksand.variable} ${kantumruy.variable} h-full antialiased dark`}
    >
      <body className="min-h-full bg-background font-body text-foreground">
        {children}
      </body>
    </html>
  );
}
