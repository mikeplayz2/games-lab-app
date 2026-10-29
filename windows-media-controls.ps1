param(
  [ValidateSet("get", "play-pause", "previous", "next")]
  [string]$Action = "get"
)

$ErrorActionPreference = "Stop"

Add-Type -AssemblyName System.Runtime.WindowsRuntime

function Wait-WinRtOperation {
  param(
    [object]$Operation,
    [type]$ResultType
  )

  $method = [System.WindowsRuntimeSystemExtensions].GetMethods() |
    Where-Object {
      $_.Name -eq "AsTask" -and
      $_.IsGenericMethod -and
      $_.GetGenericArguments().Count -eq 1 -and
      $_.GetParameters().Count -eq 1 -and
      $_.GetParameters()[0].ParameterType.Name -eq 'IAsyncOperation`1'
    } |
    Select-Object -First 1

  if (-not $method) {
    throw "Windows media controls could not initialize their async bridge."
  }

  $task = $method.MakeGenericMethod($ResultType).Invoke($null, @($Operation))
  return $task.GetAwaiter().GetResult()
}

$managerType = [Windows.Media.Control.GlobalSystemMediaTransportControlsSessionManager, Windows.Media.Control, ContentType=WindowsRuntime]
$managerOperation = $managerType::RequestAsync()
$manager = Wait-WinRtOperation -Operation $managerOperation -ResultType $managerType
$sessions = @($manager.GetSessions())

if ($sessions.Count -eq 0) {
  [ordered]@{
    available = $false
    reason = "no-session"
  } | ConvertTo-Json -Compress
  exit 0
}

$session = $sessions |
  Where-Object { $_.GetPlaybackInfo().PlaybackStatus.ToString() -eq "Playing" } |
  Select-Object -First 1
if (-not $session) {
  $session = $sessions | Select-Object -First 1
}

switch ($Action) {
  "play-pause" {
    $playbackStatus = $session.GetPlaybackInfo().PlaybackStatus.ToString()
    if ($playbackStatus -eq "Playing") {
      $operation = $session.TryPauseAsync()
    } else {
      $operation = $session.TryPlayAsync()
    }
    Wait-WinRtOperation -Operation $operation -ResultType ([bool]) | Out-Null
  }
  "previous" {
    Wait-WinRtOperation -Operation $session.TrySkipPreviousAsync() -ResultType ([bool]) | Out-Null
  }
  "next" {
    Wait-WinRtOperation -Operation $session.TrySkipNextAsync() -ResultType ([bool]) | Out-Null
  }
}

$propertiesType = [Windows.Media.Control.GlobalSystemMediaTransportControlsSessionMediaProperties, Windows.Media.Control, ContentType=WindowsRuntime]
$properties = Wait-WinRtOperation -Operation $session.TryGetMediaPropertiesAsync() -ResultType $propertiesType
$playback = $session.GetPlaybackInfo()
$controls = $playback.Controls
[ordered]@{
  available = $true
  title = [string]$properties.Title
  artist = [string]$properties.Artist
  album = [string]$properties.AlbumTitle
  source = [string]$session.SourceAppUserModelId
  status = $playback.PlaybackStatus.ToString()
  canPlayPause = [bool]($controls.IsPlayEnabled -or $controls.IsPauseEnabled -or $controls.IsPlayPauseToggleEnabled)
  canPrevious = [bool]$controls.IsPreviousEnabled
  canNext = [bool]$controls.IsNextEnabled
} | ConvertTo-Json -Compress
