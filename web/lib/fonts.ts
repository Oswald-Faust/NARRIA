import { Quicksand, Kantumruy_Pro } from "next/font/google";
import localFont from "next/font/local";

export const quicksand = Quicksand({
  variable: "--font-quicksand",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

export const kantumruy = Kantumruy_Pro({
  variable: "--font-kantumruy",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
});

export const koba = localFont({
  src: "../fonts/KOBA.otf",
  variable: "--font-koba",
  display: "swap",
});
