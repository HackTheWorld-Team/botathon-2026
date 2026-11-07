# Script de restauración directa en (localdb)\BluePrismLocalDB
# Uso: powershell -ExecutionPolicy Bypass -File bot/blueprism/restore_blueprism.ps1

$ErrorActionPreference = "Stop"
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$mdfPath = "$env:LOCALAPPDATA\Blue Prism Limited\databases\BluePrism.mdf"

if (-not (Test-Path $mdfPath)) {
    Write-Error "No se encontro la base de datos de Blue Prism en: $mdfPath"
    exit 1
}

$items = @(
    @{
        Id   = "25b8b6a8-fb7c-4845-8aae-e19db80bfc2c"
        Name = "BOT - Archivos"
        Type = "O"
        File = Join-Path $scriptDir "BOT - Archivos.bpobject"
        Desc = "Object de archivos y ejecucion de worker Python (Issue #52)"
    },
    @{
        Id   = "9d337fe1-e888-4a6a-a981-2481764ac0f2"
        Name = "BOT - Ingesta Asistencial"
        Type = "P"
        File = Join-Path $scriptDir "BOT - Ingesta Asistencial.bpprocess"
        Desc = "Proceso principal de ingesta asistencial BUK/SIC con aislamiento de rechazos (Issue #52)"
    },
    @{
        Id   = "e5b784f4-a262-4da4-9246-0f1b053e93de"
        Name = "Proceso_Teleton"
        Type = "P"
        File = Join-Path $scriptDir "Proceso_Teleton.bpprocess"
        Desc = "Proceso base de respaldo"
    }
)

$connStr = "Server=(localdb)\BluePrismLocalDB;Integrated Security=true;AttachDbFileName=$mdfPath"
$conn = New-Object System.Data.SqlClient.SqlConnection($connStr)
$conn.Open()

try {
    foreach ($item in $items) {
        if (-not (Test-Path $item.File)) { continue }
        $xml = [System.IO.File]::ReadAllText($item.File, [System.Text.Encoding]::UTF8)
        $cmd = $conn.CreateCommand()
        $cmd.CommandText = @"
IF EXISTS (SELECT 1 FROM BPAProcess WHERE name = @name)
BEGIN
    UPDATE BPAProcess
    SET processxml = @xml,
        lastmodifieddate = GETDATE()
    WHERE name = @name
END
ELSE
BEGIN
    INSERT INTO BPAProcess (processid, processtype, name, description, version, createdate, lastmodifieddate, processxml, AttributeID)
    VALUES (@id, @type, @name, @desc, '1.0', GETDATE(), GETDATE(), @xml, 0)
END
"@
        $cmd.Parameters.AddWithValue("@id", [Guid]$item.Id) | Out-Null
        $cmd.Parameters.AddWithValue("@type", $item.Type) | Out-Null
        $cmd.Parameters.AddWithValue("@name", $item.Name) | Out-Null
        $cmd.Parameters.AddWithValue("@desc", $item.Desc) | Out-Null
        $cmd.Parameters.AddWithValue("@xml", $xml) | Out-Null
        $cmd.ExecuteNonQuery() | Out-Null
        Write-Host "[OK] Restaurado en BluePrismLocalDB: $($item.Name) ($($item.Type))"
    }
}
finally {
    $conn.Close()
}
