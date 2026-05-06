param(
    [int]$Port = 3000,
    [int]$StartupTimeoutSeconds = 90
)

$ErrorActionPreference = "Stop"

$repoRoot = Split-Path -Parent $PSScriptRoot
$frontendDir = Join-Path $repoRoot "frontend"
$nodeVersion = "22.18.0"
$nodeDir = Join-Path $repoRoot "node-v$nodeVersion-win-x64"
$nodeZip = Join-Path $repoRoot "node-v$nodeVersion-win-x64.zip"
$nodeExe = Join-Path $nodeDir "node.exe"
$npmCmd = Join-Path $nodeDir "npm.cmd"
$nextBin = Join-Path $frontendDir "node_modules\next\dist\bin\next"
$healthUrl = "http://127.0.0.1:$Port/"

function Write-Step {
    param([string]$Message)
    Write-Host "[start-pulse] $Message"
}

function Unblock-PortableNodeFiles {
    param([string]$TargetPath)

    if (-not (Test-Path -LiteralPath $TargetPath)) {
        return
    }

    Get-ChildItem -LiteralPath $TargetPath -Recurse -File -ErrorAction SilentlyContinue |
        Unblock-File -ErrorAction SilentlyContinue
}

function Ensure-PortableNode {
    if (Test-Path -LiteralPath $nodeExe) {
        Unblock-PortableNodeFiles -TargetPath $nodeDir
        Write-Step "Portable Node already available at $nodeExe"
        return
    }

    Write-Step "Downloading portable Node.js v$nodeVersion"
    $downloadUrl = "https://nodejs.org/dist/v$nodeVersion/node-v$nodeVersion-win-x64.zip"
    $ProgressPreference = "SilentlyContinue"
    Invoke-WebRequest -Uri $downloadUrl -OutFile $nodeZip
    Unblock-File -LiteralPath $nodeZip -ErrorAction SilentlyContinue

    Write-Step "Expanding portable Node.js"
    Expand-Archive -LiteralPath $nodeZip -DestinationPath $repoRoot -Force
    Unblock-PortableNodeFiles -TargetPath $nodeDir
}

function Ensure-FrontendDependencies {
    if (Test-Path -LiteralPath $nextBin) {
        Write-Step "Frontend dependencies already installed"
        return
    }

    Write-Step "Installing frontend dependencies"
    & $npmCmd install --prefix $frontendDir
}

function Get-PortOwner {
    param([int]$TargetPort)

    $connection = Get-NetTCPConnection -State Listen -LocalPort $TargetPort -ErrorAction SilentlyContinue |
        Select-Object -First 1

    if (-not $connection) {
        return $null
    }

    $processId = $connection.OwningProcess
    $process = Get-CimInstance Win32_Process -Filter "ProcessId = $processId" -ErrorAction SilentlyContinue

    [PSCustomObject]@{
        ProcessId = $processId
        LocalAddress = $connection.LocalAddress
        CommandLine = if ($process) { $process.CommandLine } else { "" }
        Name = if ($process) { $process.Name } else { "" }
    }
}

function Test-RepoServerOwnership {
    param($PortOwner)

    if (-not $PortOwner) {
        return $false
    }

    $commandLine = [string]$PortOwner.CommandLine
    return $commandLine -like "*$repoRoot*" -or $commandLine -like "*$frontendDir*"
}

function Test-UrlHealthy {
    param([string]$Url)

    try {
        $response = Invoke-WebRequest -Uri $Url -UseBasicParsing -TimeoutSec 10
        return $response.StatusCode -eq 200
    }
    catch {
        return $false
    }
}

function Wait-ForHealthyResponse {
    param(
        [string]$Url,
        [int]$TimeoutSeconds
    )

    $deadline = (Get-Date).AddSeconds($TimeoutSeconds)
    while ((Get-Date) -lt $deadline) {
        if (Test-UrlHealthy -Url $Url) {
            return $true
        }

        Start-Sleep -Seconds 2
    }

    return $false
}

function Start-FrontendServer {
    $command = "Set-Location '$frontendDir'; & '$nodeExe' '$nextBin' dev --hostname 127.0.0.1 --port $Port"
    Start-Process powershell.exe `
        -WorkingDirectory $frontendDir `
        -ArgumentList "-NoExit", "-ExecutionPolicy", "Bypass", "-Command", $command `
        -WindowStyle Normal | Out-Null
}

if (-not (Test-Path -LiteralPath $frontendDir)) {
    throw "Frontend directory not found at $frontendDir"
}

Ensure-PortableNode
Ensure-FrontendDependencies

$existingOwner = Get-PortOwner -TargetPort $Port
if ($existingOwner) {
    if (Test-RepoServerOwnership -PortOwner $existingOwner) {
        if (Test-UrlHealthy -Url $healthUrl) {
            Write-Step "ShortPulse is already healthy on $healthUrl (PID $($existingOwner.ProcessId))"
            exit 0
        }

        Write-Step "Stopping stale ShortPulse listener on port $Port (PID $($existingOwner.ProcessId))"
        Stop-Process -Id $existingOwner.ProcessId -Force
        Start-Sleep -Seconds 2
    }
    else {
        throw "Port $Port is already in use by another process (PID $($existingOwner.ProcessId): $($existingOwner.Name)). Resolve that conflict before starting ShortPulse."
    }
}

Write-Step "Starting ShortPulse on $healthUrl"
Start-FrontendServer

if (-not (Wait-ForHealthyResponse -Url $healthUrl -TimeoutSeconds $StartupTimeoutSeconds)) {
    throw "ShortPulse did not become healthy on $healthUrl within $StartupTimeoutSeconds seconds."
}

$newOwner = Get-PortOwner -TargetPort $Port
$processText = if ($newOwner) { " (PID $($newOwner.ProcessId))" } else { "" }
Write-Step "ShortPulse is running at $healthUrl$processText"
