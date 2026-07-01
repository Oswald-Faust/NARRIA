import { redirect } from "next/navigation";

// La racine renvoie vers l'app ; le middleware redirige vers /login si non connecté.
export default function RootPage() {
  redirect("/accueil");
}
