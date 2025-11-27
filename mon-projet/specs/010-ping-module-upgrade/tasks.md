# Tasks — Spec 010 Module Ping

- [ ] Backend — Modèle/validation : schéma Pydantic (cible, durée 1–86400 s, intervalle 100–60000 ms, timeout), validation IPv4/IPv6/domaine.
- [ ] Backend — Orchestration : scheduler ping (monotonic, ±10 ms), support stop manuel/auto, statut completed/stopped.
- [ ] Backend — WS temps réel : endpoint WS ping, payload par ping (ts, seq, rtt, success/error, progression), buffer circulaire.
- [ ] Backend — Rapport + export : métriques (tx/rx, perte %, rtt min/avg/max, durée effective), endpoint REST rapport + CSV.
- [ ] Backend — Logging : erreurs réseau/DNS/timeout, arrêts manuels.
- [ ] Frontend — Formulaire : champs + validation immédiate, sauvegarde derniers paramètres.
- [ ] Frontend — Temps réel : abonnement WS, affichage live (couleurs, autoscroll), barre/progression, compteur temps restant, bouton stop + confirmation.
- [ ] Frontend — Rapport/export : affichage synthèse, export CSV.
- [ ] Tests back : unités (validation, calculs, métriques), intégration REST/WS.
- [ ] Tests front : parcours manuel (start, stop, erreur validation, export).
