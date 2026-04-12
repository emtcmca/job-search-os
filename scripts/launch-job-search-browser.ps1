$chromeCandidates = @(
  (Join-Path $env:LOCALAPPDATA "Google\Chrome\Application\chrome.exe"),
  (Join-Path $env:ProgramFiles "Google\Chrome\Application\chrome.exe"),
  (Join-Path ${env:ProgramFiles(x86)} "Google\Chrome\Application\chrome.exe")
) | Where-Object { $_ -and (Test-Path $_) }

if (-not $chromeCandidates -or $chromeCandidates.Count -eq 0) {
  throw "Could not find Chrome on this machine."
}

$chromePath = $chromeCandidates[0]
$userDataDir = Join-Path $env:LOCALAPPDATA "Google\Chrome\User Data"
$profileDirectory = "Profile 3"
$debugPort = 9222

Start-Process -FilePath $chromePath -ArgumentList @(
  "--remote-debugging-port=$debugPort",
  "--user-data-dir=$userDataDir",
  "--profile-directory=$profileDirectory",
  "--new-window"
)

Write-Output "Launched Chrome for Job Search OS on debug port $debugPort using profile directory $profileDirectory."
