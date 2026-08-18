$ErrorActionPreference = 'Continue'
$out = 'H:\VoiceFollower\host\vf27_test.out'
"inizio: $(Get-Date -Format 'HH:mm:ss')" | Set-Content $out -Encoding utf8
$t0 = Get-Date
try {
  $b2 = @{ prompt='L'utente chiede: che ore sono? Chi viene oggi?' } | ConvertTo-Json
  $r2 = Invoke-RestMethod -Uri 'http://localhost:3000/api/orchestrate' -Method Post -ContentType 'application/json' -Body $b2 -TimeoutSec 300
  $dt = [int]((Get-Date) - $t0).TotalSeconds
  "orchestrate OK in ${dt}s" | Add-Content $out
  "modelUsed: $($r2.modelUsed)" | Add-Content $out
  "spokenResponse: $($r2.spokenResponse)" | Add-Content $out
} catch {
  "orchestrate ERRORE: $($_.Exception.Message)" | Add-Content $out
}
"fine: $(Get-Date -Format 'HH:mm:ss')" | Add-Content $out
