# Intégration Qonto — Journal des modifications

## Date : 12 août 2026

## Contexte
Intégration de Qonto (Plateforme Agréée) dans Essentia Services pour :
1. L'envoi automatique des justificatifs de notes de frais vers les 
   transactions bancaires Qonto
2. La création de factures électroniques (Factur-X) directement dans 
   Qonto, en statut brouillon

## Fichiers créés

- netlify/functions/qonto-transactions.js
  Liste les transactions Qonto sans justificatif (90 derniers jours)
  
- netlify/functions/qonto-attachment.js
  Envoie une photo de justificatif vers une transaction Qonto 
  (multipart/form-data, endpoint /v2/transactions/{id}/attachments)
  
- netlify/functions/qonto-invoice.js
  Recherche ou crée le client Qonto correspondant, met à jour ses 
  informations (adresse, SIREN) si déjà existant, puis crée la 
  facture (statut "draft" par défaut)

## Fichiers modifiés (index.html + index_test.html, gardés identiques)

- Bouton "Envoyer vers Qonto" sur les notes de frais avec photo 
  (fonction envoyerFraisVersQonto)
- Modal de rapprochement transaction bancaire ↔ note de frais 
  (#modalQontoTx)
- Bouton "Qonto (brouillon)" sur l'écran de facturation 
  (fonction envoyerFactureVersQonto)
- Extraction automatique du code postal depuis l'adresse client 
  (regex \b\d{5}\b, même méthode que genererXMLFacturX)
- Constantes ajoutées : APP_SECRET_FRONT, _QONTO_TX_ENDPOINT, 
  _QONTO_ATTACH_ENDPOINT

## Sécurité

- Toutes les fonctions Qonto vérifient un header X-App-Secret contre 
  process.env.APP_SECRET avant tout appel à l'API Qonto (retour 401 
  sinon) — protection absente sur send-email.js (à corriger plus tard, 
  hors périmètre de ce chantier)
- Limite de taille sur les pièces jointes (8 Mo max)
- Aucune clé API Qonto n'est exposée côté client — tout passe par les 
  fonctions Netlify

## Variables d'environnement Netlify configurées

- APP_SECRET (secret partagé front/fonctions)
- QONTO_ORG_SLUG
- QONTO_SECRET_KEY
- QONTO_IBAN

## État actuel — Fonctionnel et testé en production

- ✅ Envoi de justificatif de note de frais vers Qonto : opérationnel
- ✅ Création de facture électronique en brouillon dans Qonto : 
  opérationnel et confirmé visible côté client sur son compte Qonto

## Limitations connues / à traiter plus tard

1. send-email.js n'a pas de protection X-App-Secret (faille pré-existante, 
   hors périmètre de ce chantier Qonto)
2. Le bouton justificatifs n'apparaît que sur les notes de frais 
   "classiques" avec photo — pas sur celles en kilométrage (comportement 
   voulu, un forfait km n'a pas de reçu)
3. Les factures Qonto restent en statut "draft" — validation manuelle 
   requise dans Qonto avant envoi réel au client. Passage en statut 
   "unpaid" (envoi direct) à décider plus tard si souhaité
4. Pas de synchronisation retour : si une facture est modifiée côté 
   Qonto après création, Essentia ne le sait pas automatiquement

## Derniers commits Git liés à ce chantier

(à compléter automatiquement avec git log --oneline -10)

```
e0c3b48 Fix: mise à jour du client Qonto existant (code postal) avant facturation
e80907e Fix: extraction code postal client pour facturation Qonto
0a5a852 Ajout facturation électronique via Qonto (brouillon)
739ae12 Ajout intégration Qonto : justificatifs notes de frais
0f5ec29 fix: exclure clients absents (planningPrevData + deplacementsData) du calcul des frais KM
0d7aed0 fix: exclure les clients absents (planningPrevData) du calcul des frais KM
dfc6c7a feat: trop-perçu client + tombstone factures multi-utilisateur
25e3fba fix: factures — flux payée/archivée, CA encaissé et race condition Supabase
75bcb1d fix: factures payées/archivées — comptage impayées et protection race condition Supabase
69a6780 fix: commune départ — select Paramètres lit progestParams au lieu de _curVal
```
