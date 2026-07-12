# Load generator: 1,000 incidents + ~10,000 log lines through the real REST API.
# Usage: powershell -File loadtest.ps1   (backend must be running on :8080)
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Net.Http

$base = 'http://localhost:8080'
$client = [System.Net.Http.HttpClient]::new()
$client.Timeout = [TimeSpan]::FromSeconds(30)

function Post-Json($path, $obj) {
    $json = $obj | ConvertTo-Json -Compress
    $content = [System.Net.Http.StringContent]::new($json, [System.Text.Encoding]::UTF8, 'application/json')
    $resp = $client.PostAsync("$base$path", $content).Result
    if (-not $resp.IsSuccessStatusCode) { throw "POST $path -> $($resp.StatusCode)" }
    return $resp.Content.ReadAsStringAsync().Result | ConvertFrom-Json
}
function Patch-Json($path, $obj) {
    $json = if ($null -ne $obj) { $obj | ConvertTo-Json -Compress } else { '{}' }
    $req = [System.Net.Http.HttpRequestMessage]::new([System.Net.Http.HttpMethod]::new('PATCH'), "$base$path")
    $req.Content = [System.Net.Http.StringContent]::new($json, [System.Text.Encoding]::UTF8, 'application/json')
    $resp = $client.SendAsync($req).Result
    if (-not $resp.IsSuccessStatusCode) { throw "PATCH $path -> $($resp.StatusCode)" }
}

# --- Login ---
$auth = Post-Json '/api/auth/login' @{ email = 'admin@ims.com'; password = 'Admin@123' }
$client.DefaultRequestHeaders.Authorization = [System.Net.Http.Headers.AuthenticationHeaderValue]::new('Bearer', $auth.token)
Write-Output "Logged in as $($auth.role)"

# --- 1,000 incidents ---
$systems = @('checkout','auth','payments','search','inventory','notification','gateway','billing','reporting','cdn')
$problems = @('latency spike > 500ms','HTTP 500 burst','connection pool exhausted','TLS handshake failures','queue backlog growing','disk usage above 90%','replica lag critical','OOM kill detected','timeout calling downstream','cache hit rate collapsed')
$prios = @('P1','P2','P2','P3','P3','P3','P3','P4','P4','P4')  # weighted distribution

$N = 1000
$sw = [System.Diagnostics.Stopwatch]::StartNew()
$ids = New-Object System.Collections.Generic.List[long]
for ($i = 1; $i -le $N; $i++) {
    $sysName = $systems[(Get-Random -Maximum $systems.Count)]
    $prob = $problems[(Get-Random -Maximum $problems.Count)]
    $inc = Post-Json '/api/incidents' @{
        title = "[$sysName] $prob (#$i)"
        description = "Load-test incident ${i}: $sysName service reported '$prob'. Generated for scale validation."
        priority = $prios[(Get-Random -Maximum $prios.Count)]
    }
    $ids.Add($inc.id)
    if ($i % 200 -eq 0) { Write-Output ("  {0} incidents created ({1:n1}/s)" -f $i, ($i / $sw.Elapsed.TotalSeconds)) }
}
$createSecs = $sw.Elapsed.TotalSeconds
Write-Output ("CREATED {0} incidents in {1:n1}s ({2:n1} req/s)" -f $N, $createSecs, ($N / $createSecs))

# --- Resolve 30%, close half of those (realistic status spread) ---
$sw.Restart()
$shuffled = $ids | Get-Random -Count $ids.Count
$toResolve = $shuffled | Select-Object -First 300
$toClose = $toResolve | Select-Object -First 150
foreach ($id in $toResolve) { Patch-Json "/api/incidents/$id/status" @{ status = 'RESOLVED'; notes = 'Auto-resolved during load test' } }
foreach ($id in $toClose) { Patch-Json "/api/incidents/$id/close" @{ notes = 'Closed during load test' } }
Write-Output ("RESOLVED 300 / CLOSED 150 in {0:n1}s" -f $sw.Elapsed.TotalSeconds)

# --- 10,000 log lines across 4 files (real parser path) ---
$levels = @('INFO','INFO','INFO','INFO','INFO','INFO','INFO','WARN','WARN','ERROR','ERROR','ERROR','FATAL')
$msgs = @(
    'Request processed successfully in {0}ms',
    'Database connection timeout after {0}s',
    'Login attempt failed for user u{0}',
    'Retry triggered for job #{0}',
    'Connection refused by downstream service node-{0}',
    'Heartbeat OK from worker-{0}',
    'Cache evicted {0} entries',
    'Slow query detected: {0}ms on incidents table',
    'Out of memory warning in worker-{0}',
    'Disk usage check: {0}% used'
)
$sw.Restart()
$tmpDir = "$env:TEMP\ims-loadtest"
New-Item -ItemType Directory -Force $tmpDir | Out-Null
$attachTargets = @($ids[0], $ids[1], $null, $null)  # 2 attached, 2 standalone
$totalLines = 0
for ($f = 0; $f -lt 4; $f++) {
    $lines = New-Object System.Collections.Generic.List[string]
    $t = (Get-Date).AddDays(-7)
    for ($j = 0; $j -lt 2500; $j++) {
        $t = $t.AddSeconds((Get-Random -Minimum 30 -Maximum 300))
        $lvl = $levels[(Get-Random -Maximum $levels.Count)]
        $msg = ($msgs[(Get-Random -Maximum $msgs.Count)] -f (Get-Random -Maximum 9999))
        $lines.Add(('{0:yyyy-MM-dd HH:mm:ss} {1} {2}' -f $t, $lvl, $msg))
    }
    $file = "$tmpDir\app-server-$f.log"
    [System.IO.File]::WriteAllLines($file, $lines)
    $url = "$base/api/logs/upload"
    if ($null -ne $attachTargets[$f]) { $url += "?incidentId=$($attachTargets[$f])" }
    $result = curl.exe -s -X POST $url -H "Authorization: Bearer $($auth.token)" -F "file=@$file" | ConvertFrom-Json
    $totalLines += $result.parsed
    Write-Output ("  uploaded {0}: parsed {1} (errors {2}, warns {3})" -f $result.source, $result.parsed, $result.errors, $result.warnings)
}
Write-Output ("INGESTED {0} log lines in {1:n1}s" -f $totalLines, $sw.Elapsed.TotalSeconds)
Write-Output 'LOAD TEST DATA COMPLETE'
