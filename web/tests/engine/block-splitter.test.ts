/**
 * Conformité du découpage en blocs aux quatre règles impératives et aux trois
 * interdictions absolues (retour bêta-testeurs, août 2026).
 *
 * Chaque règle est testée pour ce qu'elle IMPOSE et pour ce qu'elle INTERDIT :
 * une règle de découpage qui coupe trop est aussi fautive qu'une règle qui ne
 * coupe pas assez.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  splitIntoBlocks,
  toJsonBlocks,
  renderBlocksForPrompt,
  blockAtChar,
  charRangeForBlocks,
  extractSubject,
} from "@/lib/engine/segmentation/block-splitter";

const textesOf = (text: string, options?: Parameters<typeof splitIntoBlocks>[1]) =>
  splitIntoBlocks(text, options).map((b) => b.texte_brut);

describe("Règle 1 — Dialogue", () => {
  it("ouvre un bloc à chaque réplique tiretée", () => {
    const texte = ["— Où vas-tu ?", "— Au marché, répondit Marie.", "— Prends garde."].join("\n");
    expect(textesOf(texte)).toEqual([
      "— Où vas-tu ?",
      "— Au marché, répondit Marie.",
      "— Prends garde.",
    ]);
  });

  it("ne fusionne jamais deux répliques de locuteurs différents", () => {
    const blocs = splitIntoBlocks("— Bonjour.\n— Bonsoir.");
    expect(blocs).toHaveLength(2);
    expect(blocs.every((b) => b.rule === "dialogue")).toBe(true);
  });

  it("coupe à l'ouverture d'une réplique en cours de ligne (guillemets français)", () => {
    const texte = "« Bonjour », dit-il. « Bonsoir », répondit-elle.";
    expect(textesOf(texte)).toEqual(["« Bonjour », dit-il.", "« Bonsoir », répondit-elle."]);
  });

  it("traite le guillemet droit par alternance ouvrant/fermant", () => {
    const texte = '"Viens", dit Paul. "Non", dit Luc.';
    expect(textesOf(texte)).toEqual(['"Viens", dit Paul.', '"Non", dit Luc.']);
  });

  it("reconnaît les tirets cadratin, demi-cadratin et trait d'union", () => {
    for (const tiret of ["—", "–", "-"]) {
      const blocs = splitIntoBlocks(`${tiret} Une réplique.`);
      expect(blocs[0].rule).toBe("dialogue");
    }
  });
});

describe("Règle 2 — Paragraphe", () => {
  it("ouvre un bloc à chaque nouveau paragraphe", () => {
    const texte = "Le roi mourut.\n\nLa reine pleura.";
    expect(textesOf(texte)).toEqual(["Le roi mourut.", "La reine pleura."]);
  });

  it("traite un simple retour à la ligne comme un nouveau paragraphe", () => {
    const texte = "Le roi mourut.\nLa reine pleura.";
    expect(textesOf(texte)).toHaveLength(2);
  });

  it("ne combine jamais deux paragraphes, même sur un sujet identique", () => {
    const texte = "Jean marchait.\n\nJean marchait encore.\n\nJean marchait toujours.";
    expect(splitIntoBlocks(texte)).toHaveLength(3);
  });

  it("gère indifféremment \\n, \\r\\n et \\r", () => {
    expect(splitIntoBlocks("A dormait.\r\nB veillait.\rC partit.")).toHaveLength(3);
  });

  it("ignore les lignes vides sans produire de bloc creux", () => {
    const blocs = splitIntoBlocks("\n\n  \nLe roi mourut.\n\n\n  \n\nLa reine pleura.\n\n");
    expect(blocs.map((b) => b.texte_brut)).toEqual(["Le roi mourut.", "La reine pleura."]);
  });
});

describe("Règle 3 — Saut temporel", () => {
  it("coupe sur un marqueur temporel au sein d'un paragraphe", () => {
    const texte = "Le roi festoya longuement. Le lendemain, il partit en guerre.";
    expect(textesOf(texte)).toEqual([
      "Le roi festoya longuement.",
      "Le lendemain, il partit en guerre.",
    ]);
  });

  it("reconnaît la forme productive « quantité + unité + relation »", () => {
    const texte = "Il s'embarqua. Trois jours plus tard, la tempête se leva.";
    const blocs = splitIntoBlocks(texte);
    expect(blocs).toHaveLength(2);
    expect(blocs[1].rule).toBe("saut_temporel");
    expect(blocs[1].texte_brut).toBe("Trois jours plus tard, la tempête se leva.");
  });

  it("reconnaît « Pendant ce temps » et « Au même moment »", () => {
    for (const marqueur of ["Pendant ce temps", "Au même moment"]) {
      const blocs = splitIntoBlocks(`Il combattait au loin. ${marqueur}, la cité brûlait.`);
      expect(blocs).toHaveLength(2);
      expect(blocs[1].rule).toBe("saut_temporel");
    }
  });

  it("ne coupe pas sur un marqueur enchâssé dans une proposition", () => {
    const texte = "Il promit de revenir le lendemain sans faute.";
    expect(splitIntoBlocks(texte)).toHaveLength(1);
  });

  it("place la frontière après le marqueur en mode « after »", () => {
    const texte = "Le roi festoya. Le lendemain, il partit.";
    expect(textesOf(texte, { temporalBoundary: "after" })).toEqual([
      "Le roi festoya. Le lendemain,",
      "il partit.",
    ]);
  });

  it("n'est pas déclenchée par un adverbe de dramatisation", () => {
    expect(splitIntoBlocks("Il avançait. Soudain la porte céda.")).toHaveLength(1);
  });
});

describe("Règle 4 — Changement de sujet", () => {
  it("coupe quand le sujet nommé change (cas de référence de la règle)", () => {
    const blocs = splitIntoBlocks("Jean entra. Marie était assise.");
    expect(blocs.map((b) => b.texte_brut)).toEqual(["Jean entra.", "Marie était assise."]);
    expect(blocs[1].rule).toBe("changement_sujet");
  });

  it("ne coupe pas sur un pronom de reprise", () => {
    expect(splitIntoBlocks("Jean entra. Il ôta son manteau. Il s'assit.")).toHaveLength(1);
  });

  it("ne coupe pas quand le sujet nommé se répète", () => {
    expect(splitIntoBlocks("Jean entra. Jean ôta son manteau.")).toHaveLength(1);
  });

  it("rattache le pronom au dernier sujet nommé, pas à la phrase littérale", () => {
    // « Il » reprend Jean : aucune coupe entre les deux dernières phrases.
    const blocs = splitIntoBlocks("Jean entra. Il s'assit. Jean se releva.");
    expect(blocs).toHaveLength(1);
  });

  it("coupe sur un changement de groupe nominal déterminé", () => {
    const blocs = splitIntoBlocks("Le roi ordonna le départ. La reine refusa.");
    expect(blocs.map((b) => b.texte_brut)).toEqual([
      "Le roi ordonna le départ.",
      "La reine refusa.",
    ]);
  });

  it("reste conservatrice quand le sujet n'est pas identifiable", () => {
    expect(splitIntoBlocks("Il pleuvait sans fin. Rien ne bougeait plus.")).toHaveLength(1);
  });

  it("est transparente aux connecteurs de tête", () => {
    expect(splitIntoBlocks("Jean entra. Puis Jean s'assit.")).toHaveLength(1);
  });
});

describe("extractSubject", () => {
  it("identifie pronoms, noms propres et groupes nominaux", () => {
    expect(extractSubject("Il partit.")).toEqual({ kind: "pronoun" });
    expect(extractSubject("Marie chantait.")).toEqual({ kind: "named", value: "marie" });
    expect(extractSubject("Le roi dormait.")).toEqual({ kind: "named", value: "roi" });
  });

  it("neutralise un complément circonstanciel antéposé", () => {
    expect(extractSubject("Dans la forêt, Jean marchait.")).toEqual({ kind: "named", value: "jean" });
  });

  it("ignore la casse initiale des mots-outils", () => {
    expect(extractSubject("Alors il comprit.")).toEqual({ kind: "pronoun" });
  });

  it("neutralise un circonstanciel temporel antéposé (relève de la règle 3)", () => {
    expect(extractSubject("Le lendemain, il partit.")).toEqual({ kind: "pronoun" });
    expect(extractSubject("Trois jours plus tard, Marie revint.")).toEqual({
      kind: "named",
      value: "marie",
    });
  });

  it("voit à travers l'ouverture de réplique", () => {
    expect(extractSubject("« Jean ment », cria-t-elle.")).toEqual({ kind: "named", value: "jean" });
  });
});

describe("Ordre de priorité des règles", () => {
  it("attribue une ligne de réplique au dialogue et non au paragraphe", () => {
    const blocs = splitIntoBlocks("Le roi se tut.\n— Parle !");
    expect(blocs.map((b) => b.rule)).toEqual(["paragraphe", "dialogue"]);
  });

  it("fait primer le dialogue sur le saut temporel à position égale", () => {
    const blocs = splitIntoBlocks("Il attendit.\n— Le lendemain, tout changea.");
    expect(blocs[1].rule).toBe("dialogue");
  });

  it("fait primer le saut temporel sur le changement de sujet à position égale", () => {
    const blocs = splitIntoBlocks("Jean partit. Le lendemain, Marie revint.");
    expect(blocs[1].rule).toBe("saut_temporel");
  });
});

describe("Interdictions absolues", () => {
  const roman = [
    "Jean poussa la porte de l'auberge.",
    "",
    "— Qui va là ? cria l'aubergiste.",
    "— Un voyageur, dit Jean.",
    "",
    "L'aubergiste servit un bol de soupe. Le lendemain, Jean reprit la route.",
  ].join("\n");

  it("ne regroupe pas des paragraphes successifs traitant du même sujet", () => {
    const blocs = splitIntoBlocks(roman);
    expect(blocs.map((b) => b.texte_brut)).toEqual([
      "Jean poussa la porte de l'auberge.",
      "— Qui va là ? cria l'aubergiste.",
      "— Un voyageur, dit Jean.",
      "L'aubergiste servit un bol de soupe.",
      "Le lendemain, Jean reprit la route.",
    ]);
  });

  it("ne divise un paragraphe que par saut temporel ou changement de sujet", () => {
    const blocs = splitIntoBlocks(roman);
    const internes = blocs.filter((b) => b.rule === "saut_temporel" || b.rule === "changement_sujet");
    expect(internes).toHaveLength(1);
    expect(internes[0].rule).toBe("saut_temporel");
  });

  it("ne coupe jamais sur une appréciation thématique", () => {
    // Trois phrases, même sujet, aucun marqueur : un seul bloc, quel que soit
    // le « thème » que le contenu pourrait suggérer.
    const texte = "Le héros vainquit le dragon. Il libéra la princesse. Il rentra au royaume.";
    expect(splitIntoBlocks(texte)).toHaveLength(1);
  });
});

describe("Déterminisme et intégrité", () => {
  const corpus = [
    "Le roi mourut de chagrin.",
    "",
    "— Est-ce vrai ? demanda la reine.",
    "— Hélas oui, répondit le chambellan.",
    "",
    "La reine se retira. Trois jours plus tard, elle abdiqua. Le prince monta sur le trône.",
  ].join("\n");

  it("produit exactement le même découpage à chaque exécution", () => {
    const a = splitIntoBlocks(corpus);
    for (let i = 0; i < 20; i++) {
      expect(splitIntoBlocks(corpus)).toEqual(a);
    }
  });

  it("numérote les blocs de 1 à n, sans trou", () => {
    const blocs = splitIntoBlocks(corpus);
    expect(blocs.map((b) => b.id)).toEqual(blocs.map((_, i) => i + 1));
  });

  it("expose des offsets exacts qui pointent vers le texte source", () => {
    for (const bloc of splitIntoBlocks(corpus)) {
      expect(corpus.slice(bloc.startChar, bloc.endChar)).toBe(bloc.texte_brut);
    }
  });

  it("produit des blocs strictement ordonnés et disjoints", () => {
    const blocs = splitIntoBlocks(corpus);
    for (let i = 1; i < blocs.length; i++) {
      expect(blocs[i].startChar).toBeGreaterThanOrEqual(blocs[i - 1].endChar);
    }
  });

  it("couvre l'intégralité du texte signifiant", () => {
    const blocs = splitIntoBlocks(corpus);
    const concat = blocs.map((b) => b.texte_brut).join("");
    const attendu = corpus.replace(/\s+/g, "");
    expect(concat.replace(/\s+/g, "")).toBe(attendu);
  });

  it("retourne une liste vide sur un texte vide ou blanc", () => {
    expect(splitIntoBlocks("")).toEqual([]);
    expect(splitIntoBlocks("   \n\n  ")).toEqual([]);
  });

  it("gère un texte d'une seule phrase sans ponctuation finale", () => {
    expect(textesOf("Un récit minimal")).toEqual(["Un récit minimal"]);
  });
});

describe("Déterminisme sur les œuvres réelles du dépôt", () => {
  const echantillons = ["romeo_juliette", "amants_conakry", "saison_pluies"] as const;

  for (const id of echantillons) {
    it(`découpe ${id} de façon rigoureusement reproductible`, () => {
      const brut = JSON.parse(
        readFileSync(join(process.cwd(), "content/samples", `${id}.json`), "utf-8"),
      ) as { text: string };

      const reference = splitIntoBlocks(brut.text);
      expect(reference.length).toBeGreaterThan(5);

      for (let i = 0; i < 5; i++) {
        expect(splitIntoBlocks(brut.text)).toEqual(reference);
      }

      // Les offsets doivent rester exacts sur du texte littéraire réel.
      for (const bloc of reference) {
        expect(brut.text.slice(bloc.startChar, bloc.endChar)).toBe(bloc.texte_brut);
      }
    });
  }
});

describe("Format de sortie et ancrage", () => {
  const corpus = "Le roi mourut.\n\nLa reine pleura. Le lendemain, elle abdiqua.";

  it("expose le format demandé : id + texte_brut", () => {
    const json = toJsonBlocks(splitIntoBlocks(corpus));
    expect(json).toEqual([
      { id: 1, texte_brut: "Le roi mourut." },
      { id: 2, texte_brut: "La reine pleura." },
      { id: 3, texte_brut: "Le lendemain, elle abdiqua." },
    ]);
    expect(Object.keys(json[0])).toEqual(["id", "texte_brut"]);
  });

  it("rend les blocs préfixés de leur identifiant pour le prompt", () => {
    expect(renderBlocksForPrompt(splitIntoBlocks(corpus))).toBe(
      "[1] Le roi mourut.\n[2] La reine pleura.\n[3] Le lendemain, elle abdiqua.",
    );
  });

  it("retrouve le bloc contenant un offset donné", () => {
    const blocs = splitIntoBlocks(corpus);
    expect(blockAtChar(blocs, 0)?.id).toBe(1);
    expect(blockAtChar(blocs, corpus.indexOf("La reine"))?.id).toBe(2);
    expect(blockAtChar(blocs, corpus.indexOf("Le lendemain"))?.id).toBe(3);
    expect(blockAtChar(blocs, corpus.length + 10)).toBeNull();
  });

  it("convertit une plage de blocs en bornes de caractères", () => {
    const blocs = splitIntoBlocks(corpus);
    const plage = charRangeForBlocks(blocs, 2, 3);
    expect(plage).not.toBeNull();
    expect(corpus.slice(plage!.startChar, plage!.endChar)).toBe(
      "La reine pleura. Le lendemain, elle abdiqua.",
    );
  });

  it("tolère une plage inversée et rejette une plage hors champ", () => {
    const blocs = splitIntoBlocks(corpus);
    expect(charRangeForBlocks(blocs, 3, 2)).toEqual(charRangeForBlocks(blocs, 2, 3));
    expect(charRangeForBlocks(blocs, 1, 99)).toBeNull();
  });
});
