$url = 'https://dl.google.com/chrome/install/GoogleChromeStandaloneEnterprise64.msi'
$out = Join-Path $env:TEMP 'GoogleChromeEnterprise64.msi'
Write-Output "Downloading to: $out"
Invoke-WebRequest -Uri $url -OutFile $out -UseBasicParsing -ErrorAction Stop
Write-Output 'Running installer (msiexec)'
Start-Process -FilePath 'msiexec.exe' -ArgumentList '/i', $out, '/qn', '/norestart' -Wait -NoNewWindow
Write-Output 'Installer exit'
