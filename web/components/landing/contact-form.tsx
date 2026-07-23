"use client";

import { useState } from "react";
import { Send, CheckCircle2, AlertCircle, Loader2, Copy, Mail, Clock, MapPin, Sparkles, Building2, Phone } from "lucide-react";
import { cn } from "@/lib/utils";

const SUBJECT_OPTIONS = [
  "Demande de démo ou présentation",
  "Support technique & accompagnement",
  "Partenariat académique ou de recherche",
  "Question commerciale / Abonnements",
  "Presse & Médias",
  "Autre demande",
];

export function ContactForm() {
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    subject: SUBJECT_OPTIONS[0],
    organization: "",
    phone: "",
    message: "",
    honeypot: "",
  });

  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [errorMessage, setErrorMessage] = useState("");
  const [copied, setCopied] = useState(false);

  const handleCopyEmail = () => {
    navigator.clipboard.writeText("contact@narria.tech");
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus("loading");
    setErrorMessage("");

    try {
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.message || "Erreur lors de l'envoi du message.");
      }

      setStatus("success");
      setFormData({
        name: "",
        email: "",
        subject: SUBJECT_OPTIONS[0],
        organization: "",
        phone: "",
        message: "",
        honeypot: "",
      });
    } catch (err: unknown) {
      setStatus("error");
      setErrorMessage(err instanceof Error ? err.message : "Une erreur est survenue.");
    }
  };

  return (
    <div className="grid gap-12 lg:grid-cols-12 lg:items-start">
      {/* Informations de contact direct (Col 5) */}
      <div className="space-y-6 lg:col-span-5">
        <div className="rounded-3xl border border-lp-ink/10 bg-lp-ink/3 p-8 backdrop-blur-xl transition-all dark:bg-lp-ink/5">
          <div className="flex items-center gap-3">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-pink/15 text-pink">
              <Mail className="h-5.5 w-5.5" />
            </span>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-lp-ink/50">Adresse E-mail Directe</p>
              <h3 className="text-lg font-bold text-lp-ink">contact@narria.tech</h3>
            </div>
          </div>

          <p className="mt-4 text-sm leading-relaxed text-lp-ink/65">
            Pour toute demande urgente, question générale ou prise de contact directe, vous pouvez m&apos;écrire à tout moment à cette adresse.
          </p>

          <button
            type="button"
            onClick={handleCopyEmail}
            className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-lp-ink/15 bg-lp-ink/5 px-4 py-3 text-sm font-semibold text-lp-ink transition-all hover:bg-lp-ink/10 active:scale-[0.98]"
          >
            {copied ? (
              <>
                <CheckCircle2 className="h-4.5 w-4.5 text-emerald-500" />
                <span>Adresse copiée dans le presse-papier !</span>
              </>
            ) : (
              <>
                <Copy className="h-4.5 w-4.5 text-lp-ink/70" />
                <span>Copier contact@narria.tech</span>
              </>
            )}
          </button>
        </div>

        {/* Engagements & Support */}
        <div className="space-y-4 rounded-3xl border border-lp-ink/10 bg-lp-ink/3 p-8 backdrop-blur-xl dark:bg-lp-ink/5">
          <div className="flex items-start gap-3.5">
            <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-purple/15 text-purple dark:text-soft-purple">
              <Clock className="h-4 w-4" />
            </span>
            <div>
              <h4 className="text-sm font-bold text-lp-ink">Réactivité garantie</h4>
              <p className="mt-0.5 text-xs leading-relaxed text-lp-ink/60">
                Nous répondons à l&apos;ensemble des messages reçus sous 24 heures ouvrées.
              </p>
            </div>
          </div>

          <div className="border-t border-lp-ink/8 pt-4">
            <div className="flex items-start gap-3.5">
              <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-yellow/15 text-[#8a5a10] dark:text-yellow">
                <Sparkles className="h-4 w-4" />
              </span>
              <div>
                <h4 className="text-sm font-bold text-lp-ink">Accompagnement personnalisé</h4>
                <p className="mt-0.5 text-xs leading-relaxed text-lp-ink/60">
                  Démo privée sur vos propres corpus ou questions d&apos;intégration narratologique.
                </p>
              </div>
            </div>
          </div>

          <div className="border-t border-lp-ink/8 pt-4">
            <div className="flex items-start gap-3.5">
              <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-pink/15 text-pink">
                <MapPin className="h-4 w-4" />
              </span>
              <div>
                <h4 className="text-sm font-bold text-lp-ink">Siège & Recherche</h4>
                <p className="mt-0.5 text-xs leading-relaxed text-lp-ink/60">
                  NARR&apos;IA · Paris, France & Support international.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Formulaire complet (Col 7) */}
      <div className="lg:col-span-7">
        <div className="relative overflow-hidden rounded-[32px] border border-lp-ink/10 bg-lp-ink/3 p-6 sm:p-10 backdrop-blur-xl dark:bg-lp-ink/5">
          <div className="mb-8">
            <h2 className="text-2xl font-bold tracking-tight text-lp-ink sm:text-3xl">
              Envoyer un message
            </h2>
            <p className="mt-2 text-sm text-lp-ink/65">
              Remplissez le formulaire ci-dessous. Le message sera transmis directement aux fondateurs et à l&apos;équipe technique.
            </p>
          </div>

          {status === "success" && (
            <div className="mb-8 flex items-start gap-3.5 rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-5 text-emerald-800 dark:text-emerald-300">
              <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600 dark:text-emerald-400" />
              <div>
                <h4 className="font-bold">Message envoyé avec succès !</h4>
                <p className="mt-1 text-xs leading-relaxed opacity-90">
                  Merci pour votre message. Nous avons bien reçu votre demande et nous vous répondrons à l&apos;adresse transmise dans les plus brefs délais.
                </p>
                <button
                  type="button"
                  onClick={() => setStatus("idle")}
                  className="mt-3 text-xs font-semibold underline underline-offset-4 hover:opacity-80"
                >
                  Envoyer un autre message
                </button>
              </div>
            </div>
          )}

          {status === "error" && (
            <div className="mb-8 flex items-start gap-3.5 rounded-2xl border border-pink/30 bg-pink/10 p-5 text-pink">
              <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" />
              <div>
                <h4 className="font-bold">Impossible d&apos;envoyer le message</h4>
                <p className="mt-1 text-xs leading-relaxed opacity-90">{errorMessage}</p>
              </div>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Honeypot caché */}
            <input
              type="text"
              name="honeypot"
              value={formData.honeypot}
              onChange={(e) => setFormData({ ...formData, honeypot: e.target.value })}
              className="hidden"
              tabIndex={-1}
              autoComplete="off"
            />

            <div className="grid gap-6 sm:grid-cols-2">
              {/* Nom complet */}
              <div className="space-y-2">
                <label htmlFor="contact-name" className="block text-xs font-bold uppercase tracking-wider text-lp-ink/70">
                  Nom complet <span className="text-pink">*</span>
                </label>
                <input
                  id="contact-name"
                  type="text"
                  required
                  placeholder="Ex. Éléonore Vaneau"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full rounded-2xl border border-lp-ink/15 bg-lp-ink/5 px-4 py-3.5 text-sm text-lp-ink placeholder:text-lp-ink/35 focus:border-purple focus:outline-none focus:ring-2 focus:ring-purple/25 transition-all"
                />
              </div>

              {/* Email */}
              <div className="space-y-2">
                <label htmlFor="contact-email" className="block text-xs font-bold uppercase tracking-wider text-lp-ink/70">
                  Adresse e-mail <span className="text-pink">*</span>
                </label>
                <input
                  id="contact-email"
                  type="email"
                  required
                  placeholder="votre.email@domaine.fr"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="w-full rounded-2xl border border-lp-ink/15 bg-lp-ink/5 px-4 py-3.5 text-sm text-lp-ink placeholder:text-lp-ink/35 focus:border-purple focus:outline-none focus:ring-2 focus:ring-purple/25 transition-all"
                />
              </div>
            </div>

            <div className="grid gap-6 sm:grid-cols-2">
              {/* Motif / Sujet */}
              <div className="space-y-2">
                <label htmlFor="contact-subject" className="block text-xs font-bold uppercase tracking-wider text-lp-ink/70">
                  Sujet de votre demande <span className="text-pink">*</span>
                </label>
                <select
                  id="contact-subject"
                  required
                  value={formData.subject}
                  onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
                  className="w-full rounded-2xl border border-lp-ink/15 bg-lp-ink/5 px-4 py-3.5 text-sm text-lp-ink focus:border-purple focus:outline-none focus:ring-2 focus:ring-purple/25 transition-all"
                >
                  {SUBJECT_OPTIONS.map((opt) => (
                    <option key={opt} value={opt} className="bg-lp-bg text-lp-ink">
                      {opt}
                    </option>
                  ))}
                </select>
              </div>

              {/* Organisation / Établissement (Optionnel) */}
              <div className="space-y-2">
                <label htmlFor="contact-org" className="block text-xs font-bold uppercase tracking-wider text-lp-ink/70">
                  Organisation / Université <span className="text-xs font-normal text-lp-ink/40">(optionnel)</span>
                </label>
                <div className="relative">
                  <input
                    id="contact-org"
                    type="text"
                    placeholder="Ex. Université Sorbonne, Éditions..."
                    value={formData.organization}
                    onChange={(e) => setFormData({ ...formData, organization: e.target.value })}
                    className="w-full rounded-2xl border border-lp-ink/15 bg-lp-ink/5 pl-10 pr-4 py-3.5 text-sm text-lp-ink placeholder:text-lp-ink/35 focus:border-purple focus:outline-none focus:ring-2 focus:ring-purple/25 transition-all"
                  />
                  <Building2 className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-lp-ink/40" />
                </div>
              </div>
            </div>

            {/* Téléphone (Optionnel) */}
            <div className="space-y-2">
              <label htmlFor="contact-phone" className="block text-xs font-bold uppercase tracking-wider text-lp-ink/70">
                Numéro de téléphone <span className="text-xs font-normal text-lp-ink/40">(optionnel)</span>
              </label>
              <div className="relative">
                <input
                  id="contact-phone"
                  type="tel"
                  placeholder="+33 6 12 34 56 78"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  className="w-full rounded-2xl border border-lp-ink/15 bg-lp-ink/5 pl-10 pr-4 py-3.5 text-sm text-lp-ink placeholder:text-lp-ink/35 focus:border-purple focus:outline-none focus:ring-2 focus:ring-purple/25 transition-all"
                />
                <Phone className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-lp-ink/40" />
              </div>
            </div>

            {/* Message */}
            <div className="space-y-2">
              <label htmlFor="contact-message" className="block text-xs font-bold uppercase tracking-wider text-lp-ink/70">
                Votre Message <span className="text-pink">*</span>
              </label>
              <textarea
                id="contact-message"
                required
                rows={5}
                placeholder="Décrivez votre besoin, votre projet ou votre question narrative..."
                value={formData.message}
                onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                className="w-full rounded-2xl border border-lp-ink/15 bg-lp-ink/5 px-4 py-3.5 text-sm text-lp-ink placeholder:text-lp-ink/35 focus:border-purple focus:outline-none focus:ring-2 focus:ring-purple/25 transition-all"
              />
            </div>

            {/* Bouton de soumission */}
            <button
              type="submit"
              disabled={status === "loading"}
              className={cn(
                "lp-shine inline-flex h-13 w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-purple to-pink text-base font-semibold text-white shadow-lg transition-all hover:opacity-95 active:scale-[0.99]",
                status === "loading" && "cursor-not-allowed opacity-75"
              )}
            >
              {status === "loading" ? (
                <>
                  <Loader2 className="h-5 w-5 animate-spin" />
                  <span>Envoi en cours à contact@narria.tech...</span>
                </>
              ) : (
                <>
                  <Send className="h-5 w-5" />
                  <span>Envoyer le message</span>
                </>
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
