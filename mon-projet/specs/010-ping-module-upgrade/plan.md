# Plan — Spec 010 Module Ping

## Approche générale
- Backend : renforcer la validation, planifier l’envoi des pings avec précision, exposer un flux temps réel (WebSocket) + endpoints start/stop, calculer métriques et rapport (JSON + CSV).
- Frontend/Electron : nouvelle UI ping (formulaire, progression, live log, bouton stop, export CSV), validation côté client, sauvegarde des derniers paramètres.
- Tests : unités backend (logique ping), intégration REST/WS, tests UI manuels ciblés.

## Backend (FastAPI)
1) Validation et modèle
   - Ajouter un schéma Pydantic dédié (cible, durée 1–86400 s, intervalle 100–60000 ms, timeout optionnel).
   - Valider les cibles IPv4/IPv6/domain (regex + résolution DNS si domaine).
2) Orchestration ping
   - Thread/async task qui envoie les pings à l’intervalle demandé (±10 ms), total calculé par `ceil(durée/intervalle)`.
   - Utiliser `ping3` côté host (ou ADB ping si device_id, en respectant intervalle/timing) ; timeout configurable.
   - Support stop manuel et arrêt auto à la durée ; conserver statut “completed” vs “stopped”.
3) WebSocket temps réel
   - Channel `/api/v1/ws/ping` (ou existant si partagé) pour pousser chaque ping : timestamp, seq, rtt ms, success/error, progression (% + temps restant).
   - Buffer circulaire en mémoire pour limiter l’usage (<50 MB).
4) Rapport final
   - Calculer total, success/fail, perte %, RTT min/avg/max, durée effective.
   - Endpoint REST pour récupérer le rapport + export CSV (content-type text/csv).
5) Logging
   - Logs d’erreur réseau, timeouts, resolutions DNS, arrêts manuels.

## Frontend (React/Electron)
1) UI formulaire
   - Champs cible, durée (s), intervalle (ms), timeout optionnel ; validation immédiate.
   - Sauvegarde du dernier formulaire (local storage).
2) Exécution / temps réel
   - Appel REST start → ouvre WS pour recevoir les pings et progression.
   - Affichage ligne par ligne (timestamp, seq, rtt, statut couleur), auto-scroll, barre de progression temps restant/%, compteur.
   - Bouton stop avec confirmation ; relai REST stop.
3) Rapport / export
   - Affichage des métriques finales, statut (terminé/interrompu), durée effective.
   - Bouton export CSV (utiliser les données accumulées ou re-fetch rapport).
4) UX
   - Messages d’erreur clairs (validation, réseau).
   - UI responsive pendant le test (pas de blocage).

## Tests
- Unitaire backend : validation des entrées, calcul du nombre de pings, parsing des résultats, métriques.
- Intégration backend : start/stop REST, flux WS, rapport final, export CSV.
- UI manuel : démarrage, live feed, stop, export, cas d’erreur validation.

## Risques / mitigations
- Précision timing : utiliser `time.monotonic()` + scheduler léger ; tolérance ±10 ms.
- Performance longues durées : buffer circulaire et compactage des logs.
- Compatibilité ADB ping vs ping3 : prévoir fallback et signaler clairement si device ping échoue.
