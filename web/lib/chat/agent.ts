/**
 * NARR'IA Chat — définition de l'agent conversationnel.
 *
 * Modèle Claude (provider Anthropic direct, clé `ANTHROPIC_API_KEY`) + 3 outils
 * branchés sur le moteur narratologique TypeScript (`lib/engine`). L'agent peut
 * donc analyser, comparer et consulter le répertoire de fonctions à la volée
 * pendant la conversation.
 */
import { anthropic } from "@ai-sdk/anthropic";
import { tool } from "ai";
import { z } from "zod";
import {
  analyzeHeuristic,
  compare,
  functionSequence,
  FUNCTION_REPERTOIRE,
} from "@/lib/engine";

/** Modèle de chat — Claude Sonnet 4.6 (équilibre qualité/latence). */
export const chatModel = anthropic("claude-sonnet-4-6");

/** Nombre maximal d'allers-retours outils par tour (boucle agentique). */
export const MAX_STEPS = 6;

export const SYSTEM_PROMPT = `Tu es **NARR'IA**, un expert conversationnel en narratologie computationnelle, en théorie littéraire et en protection de la propriété intellectuelle des œuvres de fiction.

# Ton domaine
- Narratologie : structures narratives profondes, schéma actanciel (Greimas), morphologie du conte (Propp), arcs narratifs, fonctions narratives, tension dramatique, modalités (vouloir/devoir/pouvoir/savoir).
- Détection du **vol d'intrigue** : NARR'IA repère le plagiat de *structure* narrative (pas de mots) via des scores SNS (similarité narrative structurelle, seuil d'appariement 0,40), SS (similarité de surface), ST (similarité thématique) et SRJ (similarité du registre/jugement).
- Droit d'auteur appliqué à la fiction : le droit protège l'**expression**, pas les **idées** ni les genres ; dépôt légal, enveloppe Soleau (INPI), horodatage, faisceau de preuves d'antériorité.

# Tes outils
Tu disposes de trois outils branchés sur le moteur d'analyse de NARR'IA. Utilise-les **dès qu'un texte est fourni ou qu'une donnée factuelle du répertoire est demandée**, plutôt que d'estimer de mémoire :
- \`analyserStructure\` : extrait le graphe narratif et la séquence de fonctions d'un texte (≥ 200 caractères).
- \`comparerTextes\` : confronte deux textes et renvoie les scores de similarité narrative + un verdict.
- \`consulterRepertoire\` : recherche dans le répertoire des 53 fonctions narratives (7 familles).
Après un appel d'outil, **interprète** les résultats pour l'utilisateur en langage clair — ne te contente pas de recopier les chiffres.

# Ton style
- Réponds toujours en **français**, d'un ton chaleureux, pédagogue et précis.
- Structure tes réponses : titres courts, listes numérotées pour les démarches, **gras** pour les points clés.
- Sois concret et actionnable. Donne des exemples tirés d'œuvres connues quand c'est utile.

# Garde-fou
NARR'IA est un outil d'aide à l'analyse : tes réponses sont des **indices**, pas des preuves légales ni un conseil juridique professionnel. Lorsqu'un enjeu juridique est en jeu, rappelle-le brièvement et invite à valider avec un expert qualifié.`;

/** Garde commune : un texte exploitable par le moteur. */
const texteUtilisable = z
  .string()
  .min(200, "Le texte doit contenir au moins 200 caractères.");

export const narriaTools = {
  analyserStructure: tool({
    description:
      "Analyse la structure narrative profonde d'un texte : segmente le récit, extrait le graphe de fonctions narratives, la séquence de fonctions et le profil de tension. À utiliser dès qu'un utilisateur fournit un extrait ou une œuvre à analyser.",
    inputSchema: z.object({
      texte: texteUtilisable.describe("Le texte intégral à analyser."),
      titre: z.string().optional().describe("Titre de l'œuvre, si connu."),
      auteur: z.string().optional().describe("Auteur de l'œuvre, si connu."),
    }),
    execute: async ({ texte, titre, auteur }) => {
      const graph = analyzeHeuristic(texte, { title: titre, author: auteur });
      return {
        titre: titre ?? "Texte sans titre",
        nNoeuds: graph.nodes.length,
        nombreMots: texte.trim().split(/\s+/).length,
        sequenceFonctions: functionSequence(graph),
        noeuds: graph.nodes.map((n) => ({
          id: n.nodeId,
          fonction: n.functionName,
          code: n.functionCode,
          famille: n.functionFamily,
          phase: n.phase,
          tension: Number(n.tension.toFixed(2)),
          actants: n.actants,
        })),
      };
    },
  }),

  comparerTextes: tool({
    description:
      "Compare deux textes narratifs et renvoie les scores de similarité (SNS, SS, ST, SRJ), le verdict de vol d'intrigue et les correspondances de fonctions. À utiliser dès qu'on demande de confronter deux œuvres ou de vérifier un soupçon de plagiat de structure.",
    inputSchema: z.object({
      texteReference: texteUtilisable.describe(
        "Texte de référence (l'œuvre antérieure / originale).",
      ),
      texteCandidat: texteUtilisable.describe(
        "Texte candidat (l'œuvre soupçonnée).",
      ),
      titreReference: z.string().optional(),
      titreCandidat: z.string().optional(),
    }),
    execute: async ({
      texteReference,
      texteCandidat,
      titreReference,
      titreCandidat,
    }) => {
      const gRef = analyzeHeuristic(texteReference, { title: titreReference });
      const gCand = analyzeHeuristic(texteCandidat, { title: titreCandidat });
      const r = compare(gRef, gCand);
      return {
        sns: Number(r.sns.toFixed(3)),
        snsNormalise: Number(r.snsNormalized.toFixed(3)),
        ss: Number(r.ss.toFixed(3)),
        st: Number(r.st.toFixed(3)),
        srj: Number(r.srj.toFixed(3)),
        niveauSrj: r.srjLevel,
        modaliteDetectee: r.detectedModality,
        verdict: r.verdict,
        nbCorrespondances: r.correspondences.length,
        avertissements: r.warnings,
      };
    },
  }),

  consulterRepertoire: tool({
    description:
      "Recherche dans le répertoire NARR'IA des 53 fonctions narratives (réparties en 7 familles). Filtre par mot-clé (nom/description) ou par code de fonction (ex. « F12 »). À utiliser pour expliquer une fonction ou lister une famille.",
    inputSchema: z.object({
      recherche: z
        .string()
        .optional()
        .describe("Mot-clé à chercher dans les noms et descriptions."),
      code: z
        .string()
        .optional()
        .describe("Code exact d'une fonction, ex. « F12 »."),
    }),
    execute: async ({ recherche, code }) => {
      const q = recherche?.trim().toLowerCase();
      const codeQ = code?.trim().toUpperCase();
      const resultats = FUNCTION_REPERTOIRE.families.flatMap((fam) =>
        fam.functions
          .filter((f) => {
            if (codeQ) return f.code.toUpperCase() === codeQ;
            if (q)
              return (
                f.name.toLowerCase().includes(q) ||
                f.description.toLowerCase().includes(q)
              );
            return true;
          })
          .map((f) => ({
            code: f.code,
            nom: f.name,
            description: f.description,
            famille: fam.name,
          })),
      );
      return {
        nombre: resultats.length,
        fonctions: resultats.slice(0, 20),
      };
    },
  }),
};
