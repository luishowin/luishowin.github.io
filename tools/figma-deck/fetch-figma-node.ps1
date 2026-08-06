<#
Fetches a single Figma frame/node as JSON, plus a reference PNG render.

Usage:
    $env:FIGMA_TOKEN = '<your token>'      # set this yourself; the script only reads it
    .\fetch-figma-node.ps1 -Url 'https://www.figma.com/design/abc123/My-File?node-id=12-345'

Writes into the script's own directory:
    figma-node.json      full node tree
    figma-render.png     reference render at 2x
    figma-meta.json      file key / node id / name, for convenience

The token is never printed, logged, or written to disk by this script.
#>

[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)]
    [string]$Url,

    [int]$Scale = 2
)

$ErrorActionPreference = 'Stop'
$outDir = $PSScriptRoot

if (-not $env:FIGMA_TOKEN) {
    Write-Error "FIGMA_TOKEN is not set in this shell. Set it, then re-run:`n  `$env:FIGMA_TOKEN = '<token>'"
    exit 1
}

# --- Parse the Figma URL -----------------------------------------------------
# Accepts .../design/<key>/... and .../file/<key>/... with ?node-id=<id>
if ($Url -notmatch '/(?:design|file|proto)/([A-Za-z0-9]+)') {
    Write-Error "Could not find a file key in that URL. Expected something like https://www.figma.com/design/<key>/<name>?node-id=<id>"
    exit 1
}
$fileKey = $Matches[1]

$nodeId = $null
if ($Url -match '[?&]node-id=([^&]+)') {
    # Figma writes 12-345 in share links but the API wants 12:345
    $nodeId = [System.Uri]::UnescapeDataString($Matches[1]) -replace '-', ':'
}
if (-not $nodeId) {
    Write-Error "No node-id in that URL. In Figma, right-click the frame > Copy/Paste as > Copy link to selection."
    exit 1
}

Write-Host "File key : $fileKey"
Write-Host "Node id  : $nodeId"

$headers = @{ 'X-Figma-Token' = $env:FIGMA_TOKEN }

function Invoke-Figma($uri) {
    try {
        return Invoke-RestMethod -Uri $uri -Headers $headers -Method Get
    }
    catch {
        $code = $_.Exception.Response.StatusCode.value__
        switch ($code) {
            403 { Write-Error "403 from Figma. The token is invalid, expired, or lacks the 'file_content:read' scope." }
            404 { Write-Error "404 from Figma. Check the file key, and that this account can open the file." }
            default { Write-Error "Figma API error $code on $uri" }
        }
        exit 1
    }
}

# --- 1. Node tree ------------------------------------------------------------
Write-Host "`nFetching node tree..."
$nodesUri = "https://api.figma.com/v1/files/$fileKey/nodes?ids=$([uri]::EscapeDataString($nodeId))&geometry=paths"
$nodes = Invoke-Figma $nodesUri

$nodeKey = $nodes.nodes.PSObject.Properties.Name | Select-Object -First 1
if (-not $nodeKey) {
    Write-Error "Figma returned no node for id $nodeId. Is the frame in this file?"
    exit 1
}
$doc = $nodes.nodes.$nodeKey.document
Write-Host "  name: $($doc.name)   type: $($doc.type)"

$jsonPath = Join-Path $outDir 'figma-node.json'
$nodes | ConvertTo-Json -Depth 100 -Compress | Set-Content -Path $jsonPath -Encoding UTF8
Write-Host "  wrote $jsonPath ($([math]::Round((Get-Item $jsonPath).Length / 1KB, 1)) KB)"

# --- 2. Reference render -----------------------------------------------------
Write-Host "`nRequesting ${Scale}x PNG render..."
$imgUri = "https://api.figma.com/v1/images/$fileKey" +
          "?ids=$([uri]::EscapeDataString($nodeId))&format=png&scale=$Scale"
$img = Invoke-Figma $imgUri

$renderUrl = $img.images.$nodeId
if ($renderUrl) {
    $pngPath = Join-Path $outDir 'figma-render.png'
    # S3 URL, pre-signed - no auth header here
    Invoke-WebRequest -Uri $renderUrl -OutFile $pngPath | Out-Null
    Write-Host "  wrote $pngPath ($([math]::Round((Get-Item $pngPath).Length / 1KB, 1)) KB)"
}
else {
    Write-Warning "  no render returned (err: $($img.err)). Continuing without it."
}

# --- 3. Image fills ----------------------------------------------------------
Write-Host "`nFetching image fill map..."
$fills = Invoke-Figma "https://api.figma.com/v1/files/$fileKey/images"
$fillPath = Join-Path $outDir 'figma-image-fills.json'
$fills | ConvertTo-Json -Depth 20 | Set-Content -Path $fillPath -Encoding UTF8
$fillCount = @($fills.meta.images.PSObject.Properties).Count
Write-Host "  $fillCount image fill(s) referenced in this file"

# --- 4. Meta -----------------------------------------------------------------
[pscustomobject]@{
    fileKey    = $fileKey
    nodeId     = $nodeId
    nodeName   = $doc.name
    nodeType   = $doc.type
    absBox     = $doc.absoluteBoundingBox
    fetchedAt  = (Get-Date).ToString('o')
} | ConvertTo-Json -Depth 10 | Set-Content -Path (Join-Path $outDir 'figma-meta.json') -Encoding UTF8

Write-Host "`nDone. Frame '$($doc.name)' is $($doc.absoluteBoundingBox.width) x $($doc.absoluteBoundingBox.height)."
