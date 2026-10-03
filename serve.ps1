# Minimal static file server for local preview (dev use only).
# Usage: powershell -ExecutionPolicy Bypass -File serve.ps1 -Port 8777 -Root "<path>"

param(
  [int]$Port = 8777,
  [string]$Root = (Get-Location).Path
)

$Root = (Resolve-Path -LiteralPath $Root).Path
$listener = [System.Net.HttpListener]::new()
$listener.Prefixes.Add("http://localhost:$Port/")
$listener.Start()

$mime = @{
  '.html' = 'text/html; charset=utf-8'
  '.css'  = 'text/css; charset=utf-8'
  '.js'   = 'text/javascript; charset=utf-8'
  '.svg'  = 'image/svg+xml'
  '.json' = 'application/json'
  '.png'  = 'image/png'
  '.jpg'  = 'image/jpeg'
  '.ico'  = 'image/x-icon'
}

while ($listener.IsListening) {
  try {
    $ctx = $listener.GetContext()
    $rel = [System.Uri]::UnescapeDataString($ctx.Request.Url.AbsolutePath.TrimStart('/'))
    if (-not $rel) { $rel = 'index.html' }

    # Never cache while developing. A stale .js paired with a newer .html
    # silently breaks the UI, which is very hard to debug.
    $ctx.Response.AddHeader('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0')
    $ctx.Response.AddHeader('Pragma', 'no-cache')
    $ctx.Response.AddHeader('Expires', '0')

    # keep requests inside the served root
    $path = [System.IO.Path]::GetFullPath((Join-Path $root ($rel -replace '/', '\')))
    if (-not $path.StartsWith($Root, [System.StringComparison]::OrdinalIgnoreCase)) {
      $rel = 'index.html'
      $path = Join-Path $Root $rel
    }

    if ((Test-Path -LiteralPath $path) -and -not (Get-Item -LiteralPath $path).PSIsContainer) {
      $ext = [System.IO.Path]::GetExtension($path).ToLower()
      $bytes = [System.IO.File]::ReadAllBytes($path)
      $ctx.Response.ContentType = if ($mime.ContainsKey($ext)) { $mime[$ext] } else { 'application/octet-stream' }
      $ctx.Response.ContentLength64 = $bytes.Length
      $ctx.Response.OutputStream.Write($bytes, 0, $bytes.Length)
    }
    else {
      $ctx.Response.StatusCode = 404
      $bytes = [System.Text.Encoding]::UTF8.GetBytes("404 - not found: $rel")
      $ctx.Response.ContentType = 'text/plain; charset=utf-8'
      $ctx.Response.ContentLength64 = $bytes.Length
      $ctx.Response.OutputStream.Write($bytes, 0, $bytes.Length)
    }
    $ctx.Response.Close()
  }
  catch {
    # a dropped connection shouldn't kill the server
    Start-Sleep -Milliseconds 50
  }
}
