# Handoff — « Associer un circuit » en page dédiée (fiche usager)

## But
Remplacer la **modal** d'association de circuit (`CircuitLinkDialog` dans `tab-circuits.tsx`) par une **page dédiée**, plus aérée et plus claire, et améliorer la lisibilité du picker (Suggestions vs Autres circuits). **La logique métier ne change pas** : on réutilise le moteur de suggestions existant et les mutations tRPC.

> Référence visuelle : un prototype HTML/React de la page existe (dossier `scomap/` — fichiers `usagers.jsx` fonction `AssocierCircuitPage`, `ui.jsx` composant `ReasonChip`). Reproduire ce rendu avec les composants `shadcn/ui` du repo. Demande-le si tu veux que je te le fournisse.

## Déjà en place (à réutiliser tel quel — NE PAS réécrire)
- Moteur de scoring : `apps/web/src/lib/trpc/services/circuit-suggestions.ts` (établissement +60/+45, proximité tracé/arrêt par paliers, arrêt mutualisable +12, seuil 20).
- Endpoint : `trpc.usagerCircuits.suggestForUsager({ usagerId })` → `CircuitSuggestion[]` `{ circuitId, score, reasons[] }`.
- `CircuitPicker`, `SuggestionReasonChip`, `SUGGESTION_REASON_ICONS/STYLES` dans `apps/web/src/components/usagers/tab-circuits.tsx`.
- Carte : `apps/web/src/components/trajets/trajet-map.tsx` (`TrajetMap`, import dynamique `ssr:false`).
- Mutations : `usagerCircuits.create`, `circuits.createFull` (déjà utilisées par `CircuitLinkDialog`).

## Changements demandés

### 1. Nouvelle route page
Créer `apps/web/src/app/(dashboard)/usagers/[id]/associer-circuit/page.tsx` (client) qui rend un nouveau composant `AssocierCircuitClient({ usagerId })`. Y déplacer le contenu du `CircuitLinkDialog` (modes `existing`/`new`, formulaires RHF + Zod `linkFormSchema`/`createNewFormSchema`, sélection d'adresse, toggles, mutations). **Supprimer la modal** et faire pointer le bouton « Associer un circuit » de `tab-circuits.tsx` vers `router.push(\`/usagers/${usagerId}/associer-circuit\`)`.

### 2. Retour systématique vers l'onglet Circuits
- Annuler / Retour / succès de mutation → `router.push(\`/usagers/${usagerId}?tab=circuits\`)`.
- Rendre les onglets de la fiche **adressables** : dans la page détail usager (`usagers/[id]/page.tsx` + `EntityDetailLayout`), lire `searchParams.tab` pour initialiser la `Tabs` (`defaultValue`/`value`) sur l'onglet demandé. Garde le comportement existant si `tab` absent.

### 3. Mise en page de la page (aérée, 2 colonnes ≥ lg)
- **En-tête** : lien « ← Retour à la fiche » + titre « Associer un circuit » + sous-titre « {Prénom NOM} · {type de transport} ».
- **Segmented** « Circuit existant / Nouveau circuit » (réutiliser le style d'onglets pill : actif `bg-primary text-primary-foreground`).
- **Grille `lg:grid-cols-3 gap-6`** :
  - **Colonne gauche (`lg:col-span-2`)**, 3 cartes (`bg-card border rounded-xl p-6`, en-tête = icône teintée `bg-primary/10` + titre) :
    1. **Choisir le circuit** (mode existant) ou **Créer un nouveau circuit** (mode nouveau) — voir §4.
    2. **Adresse de prise en charge** : cartes radio (≤ 4 adresses) — sélection = `border-primary bg-primary/[0.06] ring-1 ring-inset ring-primary` (carte isolée, le ring est OK ici).
    3. **Options** : 2 lignes toggle (`Bell` Notification d'arrivée, `ShieldCheck` Autorisation de rentrer seul), conteneur `divide-y rounded-xl border`.
  - **Colonne droite (`lg:col-span-1`, `sticky top-20`)** : **panneau d'aperçu** du circuit sélectionné — voir §5.
- **Barre d'action collante** en bas (`fixed bottom-0`, décalée de la sidebar) : `Annuler` (outline) + CTA plein accent (« Associer le circuit » / « Créer & associer »). Prévoir `pb-24` sur le contenu.

### 4. Picker « Choisir le circuit » — clarté Suggestions / Autres (IMPORTANT)
Données : `suggestForUsager` (annoter chaque circuit dispo avec sa suggestion). Tri : suggérés par `score` desc, autres par nom. `showGroups = !search && suggested.length>0 && others.length>0`.

- Champ **recherche** (input `Search`).
- **Deux blocs encadrés DISTINCTS** (au lieu d'une seule liste à en-têtes collants) :
  - **Suggestions** : carte `rounded-lg border overflow-hidden` ; en-tête **légèrement teinté** `bg-primary/[0.05]` avec icône `Sparkles` (primary), titre « SUGGESTIONS », **compteur** (pastille), et à droite « classées par pertinence » ; corps `bg-primary/[0.02] divide-y`.
  - **Autres circuits** : même structure, en-tête neutre `bg-muted/40`, compteur.
  - Empilés avec `space-y-3`. En recherche (`!showGroups`) : un seul bloc bordé, suggérés puis autres, sans en-têtes.
- **Ligne de circuit** (`button`, `items-start gap-3 px-4 py-3.5`) :
  - icône circuit tuile `size-9 rounded-lg` (`bg-primary text-primary-foreground` si sélectionné, sinon `bg-primary/10 text-primary`),
  - nom (`text-sm font-semibold`) + sous-ligne `établissement · ville · N usagers`,
  - **chips de raison** (`SuggestionReasonChip`) sur une ligne dessous — garder `whitespace-nowrap` pour ne pas couper le texte,
  - à droite, colonne `flex flex-col items-end gap-2` : **étiquette de pertinence** + **radio**.
- **Étiquette de pertinence** selon `score` : `≥80` « Idéal » (vert `emerald`), `≥40` « Recommandé » (primary), sinon « Possible » (muted). Petit pill `text-[10.5px] font-semibold border`.
- **Sélection** : **ne pas utiliser `ring` sur la ligne** (il déborde aux coins arrondis du bloc). Utiliser **`border-l-2 border-l-primary` + `bg-primary/[0.06]`** (clippé proprement par `overflow-hidden` du bloc) ; lignes non sélectionnées `border-l-transparent hover:bg-muted/50`. Contrôle de sélection = **radio** à droite (`size-5 rounded-full border-2` → plein `bg-primary` + `Check` quand sélectionné). Présélectionner la **meilleure suggestion**.

### 5. Panneau d'aperçu (colonne droite) — réutilise `TrajetMap`
Pour le circuit sélectionné :
- charger son **trajet représentatif** (`trpc.trajets.listByCircuit` → 1er) puis `trpc.trajets.getById` (`routeGeometry`), `trpc.arrets.list`, `trpc.basemap.getStyle` ;
- afficher **`TrajetMap`** (import dynamique, `h-[200px]`, coins haut arrondis) ;
- dessous : nom + établissement, **chips de raison** de la suggestion, **3 stats** (arrêts / usagers / jours), et un lien **« Ouvrir la fiche du circuit »** (`/circuits/{id}`, `target="_blank"`).
- Mode « Nouveau circuit » : placeholder « Le tracé sera défini après la création ». Skeleton pendant le chargement.

## Contraintes
- **Style + structure only** : ne touche pas au scoring, aux schémas Zod, aux mutations tRPC, à la validation. Réutilise `CircuitPicker`/`SuggestionReasonChip` (adapte leur rendu pour les 2 blocs + tier + sélection left-accent ; **ne modifie pas** `components/ui/`).
- Tokens de thème uniquement (`bg-primary`, `text-primary`, `border-border`, `text-muted-foreground`…), **jamais de couleur en dur** ; vérifie **light + dark** (le `--primary` est sombre en dark → la coche du radio doit rester lisible : `text-primary-foreground` sur fond `bg-primary`).
- TS strict, `pnpm lint` OK.

## Vérification
- Usager non affecté avec établissement ayant des circuits + adresse géocodée → bloc **Suggestions** (chips établissement/tracé/arrêt + tier) et bloc **Autres circuits**.
- Recherche → liste à plat sans en-têtes de groupe.
- Sélection : liseré gauche + radio, **aucun artefact de coin**.
- Annuler / Associer / Créer & associer → retour sur **l'onglet Circuits** de l'usager.
- Mode « Nouveau circuit », usager sans adresse, transport non éligible (bouton désactivé), light + dark.
