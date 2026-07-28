# Checklist de mise en ligne du socle juridique

Mise à jour du 28/07/2026. Les mentions ont été complétées ; il reste **trois faits
d'identité** à fournir et **une relecture juridique** à faire réaliser.

Toutes les valeurs sont centralisées dans [`lib/legal/entity.ts`](../lib/legal/entity.ts).
Aucune n'est écrite en dur dans les pages.

## Reste à compléter (s'affiche en surbrillance sur `/mentions-legales`)

- [ ] **Forme juridique** de l'éditeur et, le cas échéant, capital social.
- [ ] **Numéro d'immatriculation** (RCCM, RCS ou équivalent) et registre.
- [ ] **Adresse du siège**.

Ces trois mentions sont des faits opposables : elles n'ont pas été supposées.

## Hypothèses posées, à confirmer

Ces valeurs ont été arrêtées faute d'information, pour que le site ne comporte plus de
mention manquante. Elles sont exactes ou plausibles, mais aucune n'a été vérifiée à la
source.

- [ ] **Droit applicable et juridiction** : droit béninois, tribunaux de Cotonou. Déduits
      de l'établissement de FedaPay. **Dépendent en réalité du lieu d'établissement de
      l'Éditeur** — à rectifier dès que la forme juridique est connue.
- [ ] **Localisation des données** : MongoDB Atlas en Irlande, Vercel Blob à Francfort.
      À vérifier dans les consoles respectives — c'est un paramètre de configuration.
- [ ] **Anthropic et l'entraînement** : la politique affirme que le fournisseur d'inférence
      exclut l'entraînement sur les données transmises. C'est le régime commercial standard
      d'Anthropic, mais **la confirmation contractuelle reste à archiver**.
- [ ] **Cookies** : la politique affirme l'absence de cookies de mesure d'audience. Exact
      au vu du code actuel ; à re-vérifier si un outil d'analytics est ajouté.
- [ ] **Chiffrement au repos des sauvegardes** : affirmé dans la section Sécurité. À
      confirmer selon le plan MongoDB Atlas souscrit.

## Point de structure à clarifier

- [ ] **L'Éditeur (Faust Oswald) et le Responsable du traitement (David Adékambi) sont deux
      personnes distinctes.** En l'état, le site déclare que l'un édite et que l'autre
      répond des données. Ce montage doit être formalisé par un contrat entre eux (qui est
      responsable de traitement, qui est sous-traitant), faute de quoi la répartition des
      responsabilités RGPD est incertaine et les deux peuvent être recherchés.

## Bloquant avant communication publique

- [ ] **Relecture juridique globale** par un juriste qualifié. Points sensibles :
      responsabilité (CGU art. 10), rétractation (art. 5), droit applicable (art. 13),
      régime des consommateurs de l'UE. Les clauses ont été rédigées sans réserve
      apparente, mais elles n'ont pas été validées.
- [ ] **Représentant dans l'UE (art. 27 RGPD)** : si l'Éditeur est établi hors de l'Union
      tout en ciblant des utilisateurs européens (tarifs en euros, contenu francophone), la
      désignation d'un représentant est vraisemblablement requise.

## Dépendances produit

- [ ] **DPA (Data Processing Agreement)** : transformer la trame en contrat signé avant
      d'activer la ligne « Engagement de confidentialité renforcé (DPA) » sur la carte
      Institution. Tant que `DPA_AVAILABLE` vaut `false` dans `lib/legal/entity.ts`, la
      ligne n'est pas rendue — ne pas la réactiver à la main.
- [ ] **Alias e-mail dédié** (recommandé) : créer `privacy@narria.tech` et remplacer
      `PRIVACY_CONTACT` dans `lib/legal/entity.ts`.
- [ ] **FedaPay** : la politique le nomme comme prestataire de paiement. À brancher
      effectivement avant d'ouvrir les formules payantes.

## Vérification finale

- [ ] `hasUnresolvedLegalPlaceholders()` retourne `false` (les trois mentions d'identité
      sont renseignées).
- [x] Le footer de toutes les pages porte la ligne « Mentions légales · Confidentialité · CGU ».
- [x] La case de consentement du formulaire d'inscription pointe vers `/cgu` et
      `/confidentialite`, et n'est pas pré-cochée.
