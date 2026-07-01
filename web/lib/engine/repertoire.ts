/**
 * Répertoire des 53 fonctions narratives NARR'IA en 7 familles (dont 7 propres
 * aux traditions africaines). Port fidèle de `narria/repertoire/functions.py`.
 */

export interface RepertoireFunction {
  code: string;
  name: string;
  description: string;
  african?: boolean;
}

export interface RepertoireFamily {
  id: string;
  name: string;
  functions: RepertoireFunction[];
}

export const FUNCTION_REPERTOIRE: { families: RepertoireFamily[] } = {
  families: [
    {
      id: "F1",
      name: "Famille 1 — Rupture initiale (manque, désir, départ)",
      functions: [
        { code: "F01", name: "Départ", description: "Le protagoniste quitte son lieu d'origine (physiquement ou symboliquement)." },
        { code: "F02", name: "Désir / Quête", description: "Formulation explicite ou implicite d'un objet-manque à conquérir." },
        { code: "F03", name: "Manque", description: "Absence d'un élément, d'un être ou d'une condition indispensable." },
        { code: "F04", name: "Interdiction", description: "Un interdit est posé qui conditionne le déroulement de l'intrigue." },
        { code: "F05", name: "Transgression", description: "L'interdit est enfreint, déclenchant la dynamique narrative." },
        { code: "F06", name: "Exil initial", description: "Le protagoniste est chassé de son milieu d'origine contre sa volonté." },
        { code: "F07", name: "Mandat", description: "Une autorité (destinateur) confie une mission au protagoniste." },
      ],
    },
    {
      id: "F2",
      name: "Famille 2 — Quête et cheminement (rencontre, don, épreuve)",
      functions: [
        { code: "F10", name: "Rencontre", description: "Le protagoniste rencontre un personnage clé (adjuvant, opposant, destinateur)." },
        { code: "F11", name: "Don / Réception", description: "Transmission d'un objet, d'un savoir ou d'un pouvoir au protagoniste." },
        { code: "F12", name: "Entrée dans l'épreuve", description: "Franchissement d'un seuil qualifiant (initiation, examen, rite)." },
        { code: "F13", name: "Cheminement", description: "Trajet physique ou intérieur du protagoniste vers l'objet de la quête." },
        { code: "F14", name: "Reconnaissance du mentor", description: "Identification d'une figure tutélaire qui oriente le protagoniste." },
        { code: "F15", name: "Épreuve qualifiante", description: "Test que le protagoniste doit surmonter pour obtenir le moyen magique ou le savoir-faire nécessaire à la quête." },
        { code: "F16", name: "Obtention du moyen", description: "Acquisition de l'outil, de l'arme, du savoir ou de l'allié qui rendra possible la résolution de la quête." },
      ],
    },
    {
      id: "F3",
      name: "Famille 3 — Obstacles et conflits",
      functions: [
        { code: "F20", name: "Combat", description: "Affrontement physique avec un antagoniste." },
        { code: "F21", name: "Trahison", description: "Un allié se retourne contre le protagoniste." },
        { code: "F22", name: "Menace", description: "Menace pesant sur le protagoniste ou ses proches." },
        { code: "F23", name: "Meurtre", description: "Mort violente infligée à un personnage significatif." },
        { code: "F24", name: "Blessure", description: "Le protagoniste ou un allié est blessé (physiquement ou psychiquement)." },
        { code: "F25", name: "Enlèvement", description: "Un personnage est enlevé, séquestré, ou soustrait." },
        { code: "F26", name: "Duel ou compétition", description: "Affrontement ritualisé et codifié avec un adversaire." },
        { code: "F27", name: "Poursuite", description: "Le protagoniste est traqué ou traque un adversaire. Tension de mouvement." },
        { code: "F28", name: "Épreuve principale", description: "Confrontation décisive avec l'obstacle central de la quête. Moment climactique." },
      ],
    },
    {
      id: "F4",
      name: "Famille 4 — Pivot et reconnaissance",
      functions: [
        { code: "F30", name: "Reconnaissance", description: "Identification cognitive d'un fait, d'une identité, d'une relation." },
        { code: "F31", name: "Révélation", description: "Dévoilement d'un secret structurant (généalogique, moral, historique)." },
        { code: "F32", name: "Dissimulation", description: "Un secret est activement caché au protagoniste ou au lecteur." },
        { code: "F33", name: "Métamorphose", description: "Transformation physique ou morale d'un personnage." },
        { code: "F34", name: "Renversement", description: "Inversion des rapports de force ou des valeurs établies." },
        { code: "F35", name: "Anagnorisis", description: "Reconnaissance d'une identité cachée (filiation, véritable adversaire, véritable ami). Catégorie aristotélicienne." },
      ],
    },
    {
      id: "F5",
      name: "Famille 5 — Résolution (victoire, défaite, mort)",
      functions: [
        { code: "F40", name: "Libération / Sauvetage", description: "Un personnage est délivré ou sauvé d'une situation périlleuse." },
        { code: "F41", name: "Triomphe", description: "Le protagoniste atteint l'objet de sa quête." },
        { code: "F42", name: "Échec", description: "Le protagoniste échoue à atteindre l'objet de sa quête." },
        { code: "F43", name: "Mort", description: "Mort du protagoniste ou d'une figure centrale." },
        { code: "F44", name: "Pardon", description: "Acte de réconciliation qui dénoue une animosité." },
        { code: "F45", name: "Vengeance", description: "Acte de réparation violente d'un tort subi." },
        { code: "F46", name: "Rédemption", description: "Transformation morale positive d'un personnage ayant failli." },
        { code: "F47", name: "Punition", description: "Sanction subie par un personnage coupable, restituant l'ordre moral du récit." },
        { code: "F48", name: "Récompense", description: "Octroi d'un bienfait matériel ou symbolique au protagoniste victorieux." },
        { code: "F49", name: "Sentence morale", description: "Moralité finale ou leçon explicite que le récit délivre. À distinguer de FNPROV (proverbe narratif africain)." },
      ],
    },
    {
      id: "F6",
      name: "Famille 6 — Liaisons et relations",
      functions: [
        { code: "F50", name: "Amour", description: "Naissance ou développement d'un lien amoureux." },
        { code: "F51", name: "Union / Mariage", description: "Officialisation rituelle ou sociale d'une alliance amoureuse." },
        { code: "F52", name: "Rejet", description: "Refus d'une relation, d'une offre, d'une proposition." },
        { code: "F53", name: "Séparation", description: "Rupture volontaire ou subie d'un lien établi." },
        { code: "F54", name: "Retour", description: "Retour du protagoniste à son lieu d'origine, transformé." },
        { code: "F55", name: "Héritage", description: "Transmission de biens, de charges ou de savoirs entre générations." },
        { code: "F56", name: "Filiation", description: "Révélation ou constitution d'un lien de parenté structurant le récit." },
      ],
    },
    {
      id: "FN",
      name: "Famille 7 — Fonctions propres aux traditions africaines (apport NARR'IA)",
      functions: [
        { code: "FNAL", name: "Alliance matrimoniale / clanique", description: "Mariage ou alliance entre clans qui recompose la configuration actantielle du récit.", african: true },
        { code: "FNANC", name: "Ancêtre-arbitre", description: "Un ancêtre (rêve, vision, apparition rituelle, oracle) tranche un conflit ou oriente le destin. À distinguer du Donateur proppien.", african: true },
        { code: "FNBENI", name: "Bénédiction", description: "Acte rituel par lequel une autorité transmet force ou légitimité au protagoniste.", african: true },
        { code: "FNCOMM", name: "Interpellation communautaire", description: "La voix narrative interpelle l'auditoire ou la communauté, héritage de l'oralité africaine.", african: true },
        { code: "FNGR", name: "Griot-narrateur", description: "Interventions d'une figure de griot commentant l'action, invoquant la mémoire collective.", african: true },
        { code: "FNMALA", name: "Malédiction", description: "Acte rituel transmettant une entrave narrative au protagoniste ou à sa lignée. Symétrique de FNBENI.", african: true },
        { code: "FNPROV", name: "Proverbe narratif", description: "Insertion d'un proverbe ou d'une sentence de la tradition orale commentant l'action.", african: true },
      ],
    },
  ],
};

export function getFunctionByCode(code: string): (RepertoireFunction & { family: string }) | null {
  for (const fam of FUNCTION_REPERTOIRE.families) {
    for (const fn of fam.functions) {
      if (fn.code === code) return { ...fn, family: fam.name };
    }
  }
  return null;
}

export function allFunctionCodes(): string[] {
  return FUNCTION_REPERTOIRE.families.flatMap((f) => f.functions.map((fn) => fn.code));
}

export function totalFunctions(): number {
  return allFunctionCodes().length;
}
