# Créer un certificat auto-signé pour F2G Solutions Inc.
$cert = New-SelfSignedCertificate -Type CodeSigningCert -Subject "CN=F2G Solutions Inc." -KeyUsage DigitalSignature -FriendlyName "F2G Solutions Inc. Code Signing" -CertStoreLocation "Cert:\CurrentUser\My" -KeyLength 2048

# Exporter le certificat
$password = ConvertTo-SecureString -String "YourPassword123" -Force -AsPlainText
Export-PfxCertificate -Cert $cert -FilePath ".\f2g-codesign.pfx" -Password $password

Write-Host "Certificat créé: f2g-codesign.pfx"
Write-Host "Mot de passe: YourPassword123"