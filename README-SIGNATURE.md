# Signature Numérique F2G Solutions Inc.

## Fichiers créés

- `ADB-Framework-Telco-Automation-F2G-v1.0.0.exe` - Installateur signé
- `f2g-codesign.pfx` - Certificat auto-signé F2G Solutions Inc.
- `install-certificate.ps1` - Script d'installation du certificat

## Installation du certificat (optionnel)

Pour éviter l'avertissement "Publisher Unknown" :

```powershell
# Exécuter en tant qu'administrateur
.\install-certificate.ps1
```

## Vérification de la signature

```powershell
Get-AuthenticodeSignature "ADB-Framework-Telco-Automation-F2G-v1.0.0.exe"
```

## Résultat

- **Publisher** : F2G Solutions Inc.
- **Validité** : 13/11/2025 - 13/11/2026
- **Type** : Certificat auto-signé (pour tests)