# Fix ADB Bundle - Solution complète

## Problème
L'exécutable ne fonctionne pas sans ADB installé sur le PC cible.

## Solution
1. Télécharger Android Platform Tools
2. Inclure adb.exe dans les ressources Electron
3. Modifier le backend pour utiliser le chemin bundlé

## Étapes rapides
1. Télécharger: https://developer.android.com/studio/releases/platform-tools
2. Extraire adb.exe vers `mon-projet/src/electron/resources/adb/`
3. Modifier le code backend pour utiliser le chemin relatif
4. Reconstruire l'exécutable

## Code à modifier
- `mon-projet/src/backend/main.py` : Remplacer 'adb' par chemin bundlé
- `mon-projet/src/backend/services/adb_manager.py` : Idem
- `mon-projet/src/backend/modules/telco_modules.py` : Idem