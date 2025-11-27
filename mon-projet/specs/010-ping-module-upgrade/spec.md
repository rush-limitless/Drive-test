# Spec 010 — Module Ping temps réel

## Contexte
- Le module `ping` actuel est minimal : pas de validation stricte (cible, durée, intervalle), pas de respect précis de l’intervalle, pas de flux temps réel ni de rapport complet.
- Besoin métier : surveiller la connectivité réseau avec des mesures fiables pendant une durée définie, avec intervalle configurable, affichage temps réel et rapport synthétique.

## Objectifs
- Permettre de lancer un ping continu sur une cible (IP v4/v6 ou domaine) pendant une durée précise, avec intervalle configurable (ms).
- Offrir un affichage temps réel des résultats (succès/échec, latence, progression) et un rapport synthèse en fin de test.
- Autoriser l’arrêt manuel avec génération d’un rapport partiel.

## Portée
- Backend FastAPI : validation entrées, scheduling précis, streaming temps réel, calcul des métriques, export CSV.
- Frontend React/Electron : UI de configuration, affichage temps réel, progression, bouton stop, export CSV.
- Logging côté backend (erreurs réseau, interruptions).

## Hors portée
- Persistance longue durée (DB) des résultats.
- Authentification / multi-tenancy.
- Télémetrie externe.

## Exigences fonctionnelles
- RF-001 Validation entrées :
  - Cible : IPv4/IPv6 ou domaine valide.
  - Durée : 1–86400 s.
  - Intervalle : 100–60000 ms.
  - Timeout ping configurable (défaut 5s).
- RF-002 Exécution :
  - Démarrage immédiat après validation.
  - Intervalle respecté ±10 ms, durée totale ±1 s.
  - Le dernier ping est envoyé même si la durée est légèrement dépassée.
  - Arrêt automatique à la durée ou via bouton stop (avec confirmation).
- RF-003 Temps réel :
  - Afficher timestamp, séquence, RTT ms, statut (succès/échec + erreur) pour chaque ping.
  - Progression (temps restant, % complété), autoscroll.
- RF-004 Rapport final :
  - Total envoyés, réussis, échoués, perte %, RTT min/avg/max, durée réelle.
  - Export CSV.
  - Indiquer statut (terminé / interrompu).
- RF-005 Intégration :
  - REST/WS compatible FastAPI existant, format JSON standardisé.
  - Logs d’erreur intégrés au logging global.

## Exigences non fonctionnelles
- Précision intervalle : ±10 ms.
- Mémoire < 50 MB pour 24h de test (buffer circulaire pour l’affichage).
- Temps de démarrage < 500 ms.
- UI réactive, messages d’erreur clairs, sauvegarde du dernier formulaire.
- Résilience : gère host unreachable, DNS fail, timeouts, interruptions réseau.

## Contraintes techniques
- Backend : FastAPI + ping3 (ou subprocess ping Android via ADB), threads/async pour ne pas bloquer.
- Frontend : React existant, WebSocket pour le flux temps réel, export CSV côté client.
- Stockage : en mémoire (pas de DB).

## Cas d’usage
- Nominal : cible google.com, durée 60s, intervalle 1000 ms → 60 pings, rapport complet.
- Erreur : cible invalide → validation bloque avant exécution.
- Interruption : test 300s, arrêt à 120s → rapport partiel, statut "interrompu".

## Architecture / intégration
- Endpoint REST pour démarrer/arrêter un test ping (paramètres validés).
- WebSocket pour pousser les résultats de chaque ping et la progression.
- Calcul des métriques côté backend, rapport retourné fin de test ou à l’arrêt.
- UI : formulaire + vue temps réel + barre de progression + bouton stop + export CSV.

## Acceptation / Done
- Tous les critères d’acceptation des US sont satisfaits.
- Tests unitaires ≥ 90 % sur la logique ping backend.
- Tests d’intégration REST/WS passent.
- UI validée (comportement temps réel + export).
- Documentation technique et aide utilisateur mises à jour.
- Revue de code approuvée.
