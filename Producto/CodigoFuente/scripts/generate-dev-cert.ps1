param(
  [string]$OutDir = "certs/dev",
  [string]$Name = "bluegridocr.local"
)

$ErrorActionPreference = "Stop"

$target = Join-Path (Get-Location) $OutDir
New-Item -ItemType Directory -Force -Path $target | Out-Null

$certPath = Join-Path $target "$Name.pem"
$keyPath = Join-Path $target "$Name.key"

$rsa = [System.Security.Cryptography.RSA]::Create(2048)
$subject = [System.Security.Cryptography.X509Certificates.X500DistinguishedName]::new("CN=localhost")
$request = [System.Security.Cryptography.X509Certificates.CertificateRequest]::new(
  $subject,
  $rsa,
  [System.Security.Cryptography.HashAlgorithmName]::SHA256,
  [System.Security.Cryptography.RSASignaturePadding]::Pkcs1
)

$request.CertificateExtensions.Add(
  [System.Security.Cryptography.X509Certificates.X509BasicConstraintsExtension]::new($false, $false, 0, $false)
)
$request.CertificateExtensions.Add(
  [System.Security.Cryptography.X509Certificates.X509KeyUsageExtension]::new(
    [System.Security.Cryptography.X509Certificates.X509KeyUsageFlags]::DigitalSignature -bor
    [System.Security.Cryptography.X509Certificates.X509KeyUsageFlags]::KeyEncipherment,
    $false
  )
)
$request.CertificateExtensions.Add(
  [System.Security.Cryptography.X509Certificates.X509SubjectKeyIdentifierExtension]::new($request.PublicKey, $false)
)

$san = [System.Security.Cryptography.X509Certificates.SubjectAlternativeNameBuilder]::new()
$san.AddDnsName("localhost")
$san.AddDnsName("127.0.0.1")
$san.AddIpAddress([System.Net.IPAddress]::Parse("127.0.0.1"))
$request.CertificateExtensions.Add($san.Build())

$notBefore = [System.DateTimeOffset]::Now.AddDays(-1)
$notAfter = $notBefore.AddYears(2)
$cert = $request.CreateSelfSigned($notBefore, $notAfter)

function Write-AsnLength([System.IO.MemoryStream]$Stream, [int]$Length) {
  if ($Length -lt 128) {
    $Stream.WriteByte([byte]$Length)
    return
  }
  $bytes = [System.BitConverter]::GetBytes($Length)
  [Array]::Reverse($bytes)
  $bytes = $bytes | Where-Object { $_ -ne 0 }
  $Stream.WriteByte([byte](0x80 -bor $bytes.Length))
  $Stream.Write($bytes, 0, $bytes.Length)
}

function Write-AsnInteger([System.IO.MemoryStream]$Stream, [byte[]]$Value) {
  $Stream.WriteByte(0x02)
  $offset = 0
  while ($offset -lt ($Value.Length - 1) -and $Value[$offset] -eq 0) {
    $offset++
  }
  $clean = $Value[$offset..($Value.Length - 1)]
  if (($clean[0] -band 0x80) -ne 0) {
    Write-AsnLength $Stream ($clean.Length + 1)
    $Stream.WriteByte(0)
  } else {
    Write-AsnLength $Stream $clean.Length
  }
  $Stream.Write($clean, 0, $clean.Length)
}

function Export-RsaPrivateKeyDer([System.Security.Cryptography.RSA]$Rsa) {
  $p = $Rsa.ExportParameters($true)
  $inner = [System.IO.MemoryStream]::new()
  Write-AsnInteger $inner ([byte[]](0))
  Write-AsnInteger $inner $p.Modulus
  Write-AsnInteger $inner $p.Exponent
  Write-AsnInteger $inner $p.D
  Write-AsnInteger $inner $p.P
  Write-AsnInteger $inner $p.Q
  Write-AsnInteger $inner $p.DP
  Write-AsnInteger $inner $p.DQ
  Write-AsnInteger $inner $p.InverseQ
  $body = $inner.ToArray()

  $outer = [System.IO.MemoryStream]::new()
  $outer.WriteByte(0x30)
  Write-AsnLength $outer $body.Length
  $outer.Write($body, 0, $body.Length)
  return $outer.ToArray()
}

$certPem = [System.Text.StringBuilder]::new()
[void]$certPem.AppendLine("-----BEGIN CERTIFICATE-----")
[void]$certPem.AppendLine([System.Convert]::ToBase64String($cert.Export([System.Security.Cryptography.X509Certificates.X509ContentType]::Cert), [System.Base64FormattingOptions]::InsertLineBreaks))
[void]$certPem.AppendLine("-----END CERTIFICATE-----")
[System.IO.File]::WriteAllText($certPath, $certPem.ToString())

$keyPem = [System.Text.StringBuilder]::new()
[void]$keyPem.AppendLine("-----BEGIN RSA PRIVATE KEY-----")
[void]$keyPem.AppendLine([System.Convert]::ToBase64String((Export-RsaPrivateKeyDer $rsa), [System.Base64FormattingOptions]::InsertLineBreaks))
[void]$keyPem.AppendLine("-----END RSA PRIVATE KEY-----")
[System.IO.File]::WriteAllText($keyPath, $keyPem.ToString())

Write-Host "Certificado creado: $certPath"
Write-Host "Llave privada creada: $keyPath"
Write-Host "Nota: el navegador mostrara advertencia hasta confiar manualmente el certificado."
