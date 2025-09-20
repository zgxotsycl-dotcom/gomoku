$wd = Resolve-Path "$PSScriptRoot/.."
$out = Join-Path $wd 'dev.out.log'
$err = Join-Path $wd 'dev.err.log'
if (Test-Path $out) { Clear-Content $out -ErrorAction SilentlyContinue } else { New-Item -ItemType File -Path $out -Force | Out-Null }
if (Test-Path $err) { Clear-Content $err -ErrorAction SilentlyContinue } else { New-Item -ItemType File -Path $err -Force | Out-Null }
$psi = New-Object System.Diagnostics.ProcessStartInfo
$psi.FileName = 'npx'
$psi.ArgumentList.Add('next')
$psi.ArgumentList.Add('dev')
$psi.ArgumentList.Add('-p')
$psi.ArgumentList.Add('3010')
$psi.WorkingDirectory = $wd
$psi.RedirectStandardOutput = $true
$psi.RedirectStandardError = $true
$psi.UseShellExecute = $false
$p = New-Object System.Diagnostics.Process
$p.StartInfo = $psi
$null = $p.Start()
$p.BeginOutputReadLine()
$p.BeginErrorReadLine()
$p.StandardOutput.BaseStream.CopyTo([System.IO.File]::Open($out, [System.IO.FileMode]::Append, [System.IO.FileAccess]::Write, [System.IO.FileShare]::ReadWrite))
$p.StandardError.BaseStream.CopyTo([System.IO.File]::Open($err, [System.IO.FileMode]::Append, [System.IO.FileAccess]::Write, [System.IO.FileShare]::ReadWrite))
Write-Host ("PID=" + $p.Id)
