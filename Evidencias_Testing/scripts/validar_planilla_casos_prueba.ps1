param(
    [string]$BackendUrl = "http://127.0.0.1:8000",
    [string]$FrontendUrl = "http://127.0.0.1:5173",
    [switch]$AllowApiSkipped
)

$ErrorActionPreference = "Continue"

$scriptPath = Split-Path -Parent $MyInvocation.MyCommand.Path
$evidenceRoot = Resolve-Path (Join-Path $scriptPath "..")
$repoRoot = Resolve-Path (Join-Path $evidenceRoot "..")
$frontPath = Join-Path $repoRoot "Producto\CodigoFuente\Front"
$backendPath = Join-Path $repoRoot "Producto\CodigoFuente\Deploy\backend_api"
$runStamp = Get-Date -Format "yyyyMMdd_HHmmss"
$logDir = Join-Path $evidenceRoot "txt\validacion_planilla_$runStamp"
New-Item -ItemType Directory -Force -Path $logDir | Out-Null

$env:BLUEGRID_BACKEND_URL = $BackendUrl
$env:BLUEGRID_FRONTEND_URL = $FrontendUrl

$results = New-Object System.Collections.Generic.List[object]

function Invoke-ValidationStep {
    param(
        [string]$Name,
        [string]$CaseIds,
        [string]$WorkingDirectory,
        [string]$Command
    )

    $safeName = ($Name -replace '[^A-Za-z0-9_-]', '_')
    $logPath = Join-Path $logDir "$safeName.log"
    $started = Get-Date

    Push-Location $WorkingDirectory
    try {
        "[$($started.ToString('s'))] $Name" | Tee-Object -FilePath $logPath
        "Casos: $CaseIds" | Tee-Object -FilePath $logPath -Append
        "Directorio: $WorkingDirectory" | Tee-Object -FilePath $logPath -Append
        "Comando: $Command" | Tee-Object -FilePath $logPath -Append
        "" | Tee-Object -FilePath $logPath -Append

        powershell -NoProfile -ExecutionPolicy Bypass -Command $Command *>&1 |
            Tee-Object -FilePath $logPath -Append

        $exitCode = $LASTEXITCODE
        if ($null -eq $exitCode) { $exitCode = 0 }
    }
    catch {
        $_ | Tee-Object -FilePath $logPath -Append
        $exitCode = 1
    }
    finally {
        Pop-Location
    }

    $finished = Get-Date
    $results.Add([pscustomobject]@{
        name = $Name
        case_ids = $CaseIds
        exit_code = $exitCode
        ok = ($exitCode -eq 0)
        started_at = $started.ToString("s")
        finished_at = $finished.ToString("s")
        log = $logPath
    }) | Out-Null
}

Invoke-ValidationStep `
    -Name "frontend_tests_karma" `
    -CaseIds "CP-015, CP-016, CP-019, E-1.1, E-1.2, E-1.3" `
    -WorkingDirectory $frontPath `
    -Command "npm run test"

Invoke-ValidationStep `
    -Name "frontend_build" `
    -CaseIds "CP-015, CP-016, CP-017, CP-014, CP-025, E-3.1, E-4.1, E-4.2, E-4.3" `
    -WorkingDirectory $frontPath `
    -Command "npm run build"

Invoke-ValidationStep `
    -Name "backend_pytest" `
    -CaseIds "CP-005, CP-006, CP-007, CP-008, CP-010, CP-018, E-2.1, E-3.2" `
    -WorkingDirectory $backendPath `
    -Command "python -m pytest -q"

Invoke-ValidationStep `
    -Name "backend_compile" `
    -CaseIds "CP-001, CP-002, CP-003, CP-004, CP-012, CP-013, CP-017, CP-021, CP-023" `
    -WorkingDirectory $repoRoot `
    -Command "python -m compileall -q Producto\CodigoFuente\Deploy\backend_api"

Invoke-ValidationStep `
    -Name "docker_compose_config" `
    -CaseIds "CP-020, CP-021, E-3.1" `
    -WorkingDirectory $repoRoot `
    -Command "docker compose -f docker-compose.prod.yml config --quiet"

Invoke-ValidationStep `
    -Name "security_repository_scan" `
    -CaseIds "CP-004, CP-017, CP-022, E-3.2" `
    -WorkingDirectory $repoRoot `
    -Command @"
`$trackedSecrets = git ls-files | Select-String -Pattern '(^|/)(\.env|.*\.pem|.*\.key|.*id_rsa)$'
if (`$trackedSecrets) {
  Write-Error "Archivos sensibles versionados: `$trackedSecrets"
  exit 1
}
git check-ignore .env Producto/CodigoFuente/Deploy/backend_api/.env Producto/CodigoFuente/Front/.env | Out-Host
exit 0
"@

Invoke-ValidationStep `
    -Name "api_integral_evidence_generator" `
    -CaseIds "CP-001, CP-002, CP-003, CP-004, CP-005, CP-008, CP-012, CP-013, CP-017, CP-021, CP-023, CP-024" `
    -WorkingDirectory $repoRoot `
    -Command "python Evidencias_Testing\scripts\generar_evidencias_testing.py"

if (-not $AllowApiSkipped) {
    Invoke-ValidationStep `
        -Name "api_integral_assertions" `
        -CaseIds "CP-001, CP-002, CP-004, CP-005, CP-008, CP-012, CP-013, CP-017, CP-021, CP-023, CP-024" `
        -WorkingDirectory $repoRoot `
        -Command @"
`$summaryPath = 'Evidencias_Testing\txt\00_resumen_generacion_evidencias.json'
if (-not (Test-Path `$summaryPath)) {
  Write-Error "No existe `$summaryPath. Ejecutar generador de evidencias primero."
  exit 1
}
`$summary = Get-Content -Raw `$summaryPath | ConvertFrom-Json
`$failures = @()
if (`$summary.backend.status -ne 200) { `$failures += "Backend health no respondio 200: `$(`$summary.backend.status)" }
if (`$summary.ready.status -ne 200) { `$failures += "Backend ready no respondio 200: `$(`$summary.ready.status)" }
if (`$summary.frontend.status -ne 200) { `$failures += "Frontend no respondio 200: `$(`$summary.frontend.status)" }
if (-not `$env:BLUEGRID_TEST_PASSWORD) { `$failures += "Falta BLUEGRID_TEST_PASSWORD para validar login/OCR autenticado" }
if (`$env:BLUEGRID_TEST_PASSWORD -and `$summary.auth.status -ne 200) { `$failures += "Login autenticado no respondio 200: `$(`$summary.auth.status)" }
if (`$env:BLUEGRID_TEST_PASSWORD -and `$summary.post_ocr.status -notin @(200, 201, 422)) { `$failures += "OCR no alcanzo respuesta esperada 200/201/422: `$(`$summary.post_ocr.status)" }
if (`$failures.Count -gt 0) {
  `$failures | ForEach-Object { Write-Error `$_ }
  exit 1
}
Write-Host "API/OCR validado con servicios vivos y credenciales de prueba."
exit 0
"@
}

$summaryPath = Join-Path $logDir "00_resumen_validacion_planilla.json"
$results | ConvertTo-Json -Depth 5 | Set-Content -Encoding UTF8 $summaryPath

$failed = @($results | Where-Object { -not $_.ok })
Write-Host ""
Write-Host "Resumen guardado en: $summaryPath"
Write-Host "Logs guardados en: $logDir"
Write-Host ""
$results | Format-Table name, case_ids, exit_code, ok -AutoSize

if ($failed.Count -gt 0) {
    Write-Error "Validacion terminada con $($failed.Count) bloque(s) fallido(s). Revisar logs en $logDir"
    exit 1
}

Write-Host "Validacion completada sin fallos en bloques automatizados."
exit 0
