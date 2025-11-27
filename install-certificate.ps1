# Installer le certificat F2G Solutions Inc. dans le magasin de confiance
Write-Host "Installation du certificat F2G Solutions Inc..."

# Importer le certificat dans le magasin Trusted Root
$cert = Get-PfxCertificate -FilePath "f2g-codesign.pfx"
$store = New-Object System.Security.Cryptography.X509Certificates.X509Store("Root", "LocalMachine")
$store.Open("ReadWrite")
$store.Add($cert)
$store.Close()

Write-Host "Certificat installé avec succès dans le magasin de confiance."
Write-Host "L'exécutable sera maintenant reconnu comme signé par F2G Solutions Inc."