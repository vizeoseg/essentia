# CLAUDE.md — Essentia Services App

## Règle absolue : fichier de travail

**Toujours modifier `index_test.html` uniquement. Jamais `index.html` directement.**

- `index.html` = version en production, ne pas toucher
- `index_test.html` = fichier de travail pour tester les modifications
- Quand l'utilisateur valide et dit "on déploie" : `cp index_test.html index.html` + git commit + git push

## Tester en local

Le serveur local se lance ainsi :
```
cd "/Users/brunoseguin/Desktop/MISE A JOUR ESSENTIA APP 2" && python3 -m http.server 8080
```
Accès : http://localhost:8080/index_test.html

Supabase ne fonctionne pas en `file://` — toujours passer par le serveur local.

## Stack

- Application SPA mono-fichier HTML (tout dans `index.html` / `index_test.html`)
- Backend : Supabase (auth + base de données)
- Déploiement : Netlify
- PDF : jsPDF (fonts disponibles : helvetica, courier, times uniquement)
- Email : mailto + auto-download PDF (Brevo API prévu pour pièces jointes réelles)

## Contraintes techniques

- **Supabase** : données chargées en 3 temps — toute migration doit être aux 3 points sinon écrasée
- **jsPDF** : pas d'embed de fonts custom, utiliser `times italic` pour équivalent Georgia
- **Email pièce jointe** : impossible côté navigateur via mailto — solution = auto-download PDF + ouverture mail

## Conventions

- Références : `CLI-XXXX` (client), `CONT-2026-XXXX` (contrat), `DEV-2026-XXXX-NN` (devis), `FAC-2026-XXXX-NN` (facture)
- Signature Essentia : Amandine Sautière, Présidente — times italic, couleur `#1a3a8f`
- Statuts clients : `prospect`, `client_actif`, `devis_envoye`, `inactif` (calculé dynamiquement, jamais stocké)

## Workflow de développement

1. Modifier `index_test.html`
2. Tester sur http://localhost:8080/index_test.html
3. Valider avec l'utilisateur
4. Sur ordre de l'utilisateur : `cp index_test.html index.html` + commit + push Netlify
