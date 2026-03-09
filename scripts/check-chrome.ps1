$paths = @(
    'C:\Program Files\Google\Chrome\Application\chrome.exe',
    'C:\Program Files (x86)\Google\Chrome\Application\chrome.exe'
)
$found = $false
foreach ($p in $paths) {
    if (Test-Path $p) {
        $found = $true
        $v = (Get-Item $p).VersionInfo.ProductVersion
        Write-Output "$p`: $v"
    }
}
if (-not $found) { Write-Output 'Chrome not found at standard install paths' }
