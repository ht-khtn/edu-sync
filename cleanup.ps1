$matchIdPath = 'd:\app\edu-sync\app\(olympia)\olympia\(client)\client\[matchId]'
$sessionIdPath = 'd:\app\edu-sync\app\(olympia)\olympia\(client)\client\[sessionId]'

if (Test-Path $matchIdPath) {
    Remove-Item $matchIdPath -Recurse -Force
    Write-Host "Deleted [matchId] folder"
}

if (Test-Path $sessionIdPath) {
    Remove-Item $sessionIdPath -Recurse -Force
    Write-Host "Deleted [sessionId] folder"
}

Write-Host "Cleanup complete"
