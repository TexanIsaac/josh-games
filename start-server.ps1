# Starts Joshua's game server on Mallet.
#
# Two house rules are load-bearing here:
#   - pwsh 7, never powershell.exe 5.1
#   - py -3.12 pinned, never bare "py -3" (an unpinned launcher picks up whatever
#     Python gets installed next and breaks silently)

$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $root

py -3.12 "$root\serve.py" --port 8790
