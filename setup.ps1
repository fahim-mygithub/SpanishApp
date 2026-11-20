# One-time setup for Hoy: installs, deploys the reminder worker, and publishes the app to GitHub Pages.
# Run from this folder:  powershell -ExecutionPolicy Bypass -File setup.ps1   (or double-click setup.cmd)
# Safe to re-run: every step skips itself if it's already done.

# 'Continue' because Windows PowerShell 5 treats any stderr line from npm/npx as an error under 'Stop';
# real failures are caught with Check (exit codes) instead.
$ErrorActionPreference = 'Continue'
trap { Write-Host "`nSetup stopped: $_" -ForegroundColor Red; Read-Host 'Press Enter to close'; exit 1 }
Set-Location -Path $PSScriptRoot
$Owner = 'fahim-mygithub'
$Repo = 'SpanishApp'
$AppUrl = "https://$Owner.github.io/$Repo/"
$Utf8 = New-Object System.Text.UTF8Encoding($false)

function Step($msg) { Write-Host ""; Write-Host "==> $msg" -ForegroundColor Yellow }
function Check($what) { if ($LASTEXITCODE -ne 0) { throw "$what failed (exit code $LASTEXITCODE)" } }
function WriteText($path, $text) { [IO.File]::WriteAllText((Join-Path $PSScriptRoot $path), $text, $Utf8) }

Step 'Checking Node and git'
node --version; Check 'node'
git --version; Check 'git'

Step 'Installing the app (clean install for Windows)'
if (Test-Path node_modules) { Remove-Item node_modules -Recurse -Force }
if (Test-Path package-lock.json) { Remove-Item package-lock.json -Force }
npm install --no-audit --no-fund; Check 'npm install'
npm test; Check 'tests'

Step 'Installing the reminder worker'
Push-Location worker
if (Test-Path node_modules) { Remove-Item node_modules -Recurse -Force }
npm install --no-audit --no-fund; Check 'npm install (worker)'
Pop-Location

Step 'Push keys (VAPID)'
if (-not (Test-Path .vapid.local)) {
  $keys = node scripts/gen-vapid.mjs; Check 'key generation'
  WriteText '.vapid.local' (($keys -join "`n") + "`n")
  Write-Host 'Generated new keys (saved to .vapid.local, which is git-ignored).'
} else { Write-Host 'Reusing keys from .vapid.local' }
$vapid = @{}
Get-Content .vapid.local | ForEach-Object { if ($_ -match '^(\w+)=(.+)$') { $vapid[$Matches[1]] = $Matches[2].Trim() } }

Step 'Cloudflare sign-in'
Push-Location worker
npx wrangler whoami 2>&1 | Out-String | Tee-Object -Variable who | Out-Null
if ($who -match 'not authenticated') {
  Write-Host 'A browser window will open. Sign in to Cloudflare and click Allow.'
  npx wrangler login; Check 'wrangler login'
} else { Write-Host 'Already signed in.' }

Step 'Reminder storage (KV)'
$toml = [IO.File]::ReadAllText((Join-Path $PWD 'wrangler.toml'))
if ($toml -match 'PASTE_KV_NAMESPACE_ID') {
  $out = npx wrangler kv namespace create SUBS 2>&1 | Out-String
  Write-Host $out
  if ($out -notmatch '([0-9a-f]{32})') { throw 'Could not find the new KV namespace id in the output above.' }
  $toml = $toml.Replace('PASTE_KV_NAMESPACE_ID', $Matches[1])
  [IO.File]::WriteAllText((Join-Path $PWD 'wrangler.toml'), $toml, $Utf8)
} else { Write-Host 'Already set up.' }

Step 'Deploying the reminder worker'
$out = npx wrangler deploy 2>&1 | Out-String
Write-Host $out
if ($LASTEXITCODE -ne 0) { throw 'wrangler deploy failed (see above).' }
if ($out -notmatch '(https://spanish-nudge\.[a-z0-9-]+\.workers\.dev)') { throw 'Could not find the worker URL in the output above.' }
$WorkerUrl = $Matches[1]

Step 'Giving the worker its keys'
$vapid['VAPID_PUBLIC_KEY'] | npx wrangler secret put VAPID_PUBLIC_KEY; Check 'secret VAPID_PUBLIC_KEY'
$vapid['VAPID_PRIVATE_KEY'] | npx wrangler secret put VAPID_PRIVATE_KEY; Check 'secret VAPID_PRIVATE_KEY'
Pop-Location

Step 'Pointing the app at the worker'
WriteText '.env.local' "VITE_PUSH_URL=$WorkerUrl`nVITE_VAPID_PUBLIC_KEY=$($vapid['VAPID_PUBLIC_KEY'])`n"
Get-Content .env.local

Step 'Saving the code to GitHub'
if (-not (Test-Path .git)) {
  git init -b main; Check 'git init'
  git remote add origin "https://github.com/$Owner/$Repo.git"; Check 'git remote'
}
git add -A; Check 'git add'
git diff --cached --quiet
if ($LASTEXITCODE -ne 0) { git commit -m 'Hoy: five-minute Spanish PWA with reminders'; Check 'git commit' }
git push -u origin main; Check 'git push'

Step 'Publishing the app to GitHub Pages'
npm run deploy:pages; Check 'deploy:pages'

Write-Host ''
Write-Host 'Done.' -ForegroundColor Green
Write-Host "App:     $AppUrl"
Write-Host "Worker:  $WorkerUrl"
Write-Host 'GitHub Pages can take a minute or two the first time.'
Write-Host 'On your iPhone: open the app link in Safari, Share -> Add to Home Screen, open it from the icon,'
Write-Host 'then Settings -> Daily reminder -> on -> Send a test reminder.'
Read-Host 'Press Enter to close'
