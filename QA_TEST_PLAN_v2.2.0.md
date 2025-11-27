# 🧪 Plan de Tests QA - MOBIQ v2.2.0

**Version** : 2.2.0  
**Date** : 27 Novembre 2025  
**Testeur** : _____________________  
**Environnement** : Windows 10/11 64-bit  

---

## 📦 Installation & Démarrage

### ✅ Test 1 : Installation de l'application
- [ ] Lancer `MOBIQ-Setup-2.2.0.exe`
- [ ] Installation réussie dans `%LOCALAPPDATA%\Programs\mobiq\`
- [ ] Raccourci bureau créé
- [ ] Application démarre sans erreur

### ✅ Test 2 : Premier lancement
- [ ] Backend démarre automatiquement (port 8007)
- [ ] Interface React se charge complètement
- [ ] Aucune erreur dans la console
- [ ] Dashboard principal visible

---

## 🔌 Gestion des Appareils

### ✅ Test 3 : Détection ADB
- [ ] Connecter un appareil Android (USB debugging activé)
- [ ] Appareil détecté automatiquement dans le dashboard
- [ ] Métadonnées affichées (modèle, numéro série, statut)
- [ ] Statut "Connecté" en vert

### ✅ Test 4 : Multi-appareils
- [ ] Connecter 2-3 appareils simultanément
- [ ] Tous les appareils listés séparément
- [ ] Sélection d'appareil fonctionnelle
- [ ] Pas de conflit entre appareils

---

## 📞 Modules Telco - Tests Critiques

### ✅ Test 5 : Module d'appel vocal
- [ ] Aller dans **Test Modules** → **Call Test**
- [ ] Saisir numéro de téléphone valide
- [ ] Définir durée (ex: 30 secondes)
- [ ] Cliquer **▶ Run Test**
- [ ] Appel initié sur l'appareil
- [ ] Appel terminé automatiquement après la durée
- [ ] Logs détaillés visibles

### ✅ Test 6 : Gestion SMS
- [ ] Module **SMS Test**
- [ ] Envoyer SMS vers numéro valide
- [ ] Message envoyé avec succès
- [ ] Tester suppression SMS
- [ ] Vérifier sur l'appareil physique

### ✅ Test 7 : Contrôles réseau
- [ ] **Airplane Mode** ON/OFF
- [ ] **WiFi** Enable/Disable
- [ ] **Mobile Data** Enable/Disable
- [ ] **Force 2G/3G/4G** (si supporté)
- [ ] Vérifier changements sur l'appareil

---

## 🔄 Workflows & Automatisation

### ✅ Test 8 : Exécution de workflow
- [ ] Aller dans **Workflows**
- [ ] Sélectionner workflow prédéfini (ex: "Daily Smoke")
- [ ] Lancer l'exécution
- [ ] Suivre progression en temps réel
- [ ] Workflow complété sans erreur
- [ ] Rapport généré

### ✅ Test 9 : Création workflow personnalisé
- [ ] Créer nouveau workflow
- [ ] Ajouter 3-4 modules (drag & drop)
- [ ] Sauvegarder workflow
- [ ] Exécuter le workflow créé
- [ ] Vérifier séquence d'exécution

---

## 📊 Interface & Rapports

### ✅ Test 10 : Dashboard temps réel
- [ ] Cartes de statut mises à jour
- [ ] Logs en temps réel
- [ ] Graphiques/métriques fonctionnels
- [ ] Navigation fluide entre sections

### ✅ Test 11 : Génération de rapports
- [ ] Aller dans **Reports**
- [ ] Générer rapport d'exécution
- [ ] Rapport PDF créé
- [ ] Contenu complet et lisible
- [ ] Export réussi

---

## 🔧 Stabilité & Performance

### ✅ Test 12 : Tests de charge
- [ ] Lancer 5+ modules simultanément
- [ ] Application reste responsive
- [ ] Pas de crash ou freeze
- [ ] Mémoire < 2GB RAM

### ✅ Test 13 : Déconnexion/reconnexion
- [ ] Débrancher appareil pendant test
- [ ] Rebrancher appareil
- [ ] Détection automatique
- [ ] Reprise des opérations

### ✅ Test 14 : Fermeture/redémarrage
- [ ] Fermer application complètement
- [ ] Redémarrer application
- [ ] Configuration préservée
- [ ] Historique disponible

---

## 🚨 Tests d'Erreur

### ✅ Test 15 : Gestion d'erreurs
- [ ] Tester avec appareil non compatible
- [ ] Tester sans appareil connecté
- [ ] Messages d'erreur clairs
- [ ] Application ne crash pas

### ✅ Test 16 : Numéros invalides
- [ ] Appel vers numéro inexistant
- [ ] SMS vers numéro invalide
- [ ] Gestion gracieuse des erreurs
- [ ] Logs d'erreur appropriés

---

## 📝 Critères de Validation

### ✅ Critères PASS
- [ ] **Installation** : Réussie sans intervention manuelle
- [ ] **Détection ADB** : Automatique et fiable
- [ ] **Modules Core** : Call, SMS, Network fonctionnels
- [ ] **Interface** : Responsive et intuitive
- [ ] **Stabilité** : Aucun crash pendant 30min d'utilisation
- [ ] **Performance** : < 2GB RAM, < 500ms latence UI

### ❌ Critères FAIL
- [ ] Crash application
- [ ] Échec détection appareil
- [ ] Modules telco non fonctionnels
- [ ] Interface non responsive
- [ ] Consommation excessive ressources

---

## 📋 Rapport Final

**Statut Global** : ⭕ PASS / ❌ FAIL  
**Score** : ___/16 tests réussis  

**Bugs Critiques** :
- 
- 

**Bugs Mineurs** :
- 
- 

**Recommandations** :
- 
- 

**Signature QA** : _____________________  
**Date** : _____________________