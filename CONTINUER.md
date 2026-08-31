# À continuer — session 2026-07-28

## Sujet en suspens : fichier test qui remonte des données localStorage

### Problème
`index_test.html` et `index.html` partagent le même `localStorage` sur `localhost:8080`.
Toute donnée saisie en test persiste et revient au rechargement.

### Options discutées (pas encore choisie)

| Option | Description | Avantage | Inconvénient |
|---|---|---|---|
| A | Préfixe `progestV10_TEST` pour le test | Isolation totale | Ne voit pas les vraies données Supabase |
| B | Priorité Supabase au chargement | Toujours à jour | Plus lent, vide si Supabase lent |
| C | Bouton "Vider cache local" dans index_test | Simple, contrôle manuel | Manuel |
| D | Pas de fichier test, branche git + Netlify preview | Propre | Workflow plus complexe |

### Action à faire
→ Choisir une option et implémenter

---

## Ce qui a été fait et déployé aujourd'hui

- **Tombstone factures** : suppression multi-utilisateur ne revient plus
- **Flux payée/archivée** : `marquerPayee` → `statut='payee'` (pas archivée directement)
- **CA encaissé** : inclut maintenant `statut='archivee'` (avant = toujours 0)
- **Compteur impayées** : excluait pas `archivee` — corrigé
- **Race condition Supabase** : protection par rang `envoyee < payee < archivee`
- **Trop-perçu client** : champ sur fiche, badge liste, bannière + déduction auto sur prochaine facture

## Commit
`dfc6c7a` — committé, pas encore pushé sur git remote
Netlify déployé via CLI (dernier deploy : `6a68e94a`)
