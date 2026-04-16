$chromeCandidates = @(@(
  (Join-Path $env:LOCALAPPDATA "Google\Chrome\Application\chrome.exe"),
  (Join-Path $env:ProgramFiles "Google\Chrome\Application\chrome.exe"),
  (Join-Path ${env:ProgramFiles(x86)} "Google\Chrome\Application\chrome.exe")
) | Where-Object { $_ -and (Test-Path $_) })

if (-not $chromeCandidates -or $chromeCandidates.Count -eq 0) {
  throw "Could not find Chrome on this machine."
}

$chromePath = $chromeCandidates[0]
$userDataDir = Join-Path $env:LOCALAPPDATA "JobSearchOS\ChromeAutomation"
$debugPort = 9222

if (-not (Test-Path $userDataDir)) {
  New-Item -ItemType Directory -Path $userDataDir -Force | Out-Null
}

try {
  Start-Process -FilePath $chromePath -ArgumentList @(
    "--remote-debugging-port=$debugPort",
    "--user-data-dir=$userDataDir",
    "--new-window"
  ) -ErrorAction Stop

  Write-Output "Launched Chrome for Job Search OS on debug port $debugPort using automation profile at $userDataDir."
}
catch {
  throw "Failed to launch Chrome from '$chromePath'. $($_.Exception.Message)"
}
