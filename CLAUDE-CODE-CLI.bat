@echo off
chcp 65001 >nul

:: UTF-8 cho terminal (fix loi tieng Viet bi "rÃ¡Â»i" tren Windows)
set "PYTHONUTF8=1"
set "PYTHONIOENCODING=utf-8"
set "LANG=en_US.UTF-8"
set "LC_ALL=en_US.UTF-8"
powershell -NoProfile -ExecutionPolicy Bypass -Command "[Console]::OutputEncoding=[System.Text.Encoding]::UTF8; [Console]::InputEncoding=[System.Text.Encoding]::UTF8; $OutputEncoding=[System.Text.Encoding]::UTF8" >nul 2>&1

title Claude Code CLI - Nghimmo
color 0B

cls
echo.
echo ============================================================
echo          CLAUDE CODE CLI - POWERED BY NGHIMMO
echo ============================================================
echo.
echo  Server : https://api.nghimmo.com
echo  Check  : https://api.nghimmo.com/check
echo.
echo ============================================================
echo.

:: Nhap API key cua khach
set "APIKEY=sk-JCd8FiKolPKiwyv1HLf0RrSV2R7cRxx2b"
set /p "APIKEY=Nhap API Key cua ban (sk-...): "

if "%APIKEY%"=="" (
    echo.
    echo [LOI] Ban chua nhap API Key. Dong cua so va mo lai.
    echo.
    pause
    exit /b
)

:: ============================================================
:: GHI CAU HINH CUNG vao %USERPROFILE%\.claude\settings.json
:: Chua co file -> tao moi. Da co file -> ghi de url/token/model.
:: Nho vay du may khach da co settings.json van bi ghi de key moi.
:: ============================================================
set "BASE_URL=https://api.nghimmo.com"
set "MODEL_MAIN=nghi/claude-opus-4.8"
set "MODEL_OPUS=nghi/claude-opus-5"
set "MODEL_SMALL=nghi/claude-haiku-4.5"
set "SETTINGS_DIR=%USERPROFILE%\.claude"
set "SETTINGS_FILE=%SETTINGS_DIR%\settings.json"

if not exist "%SETTINGS_DIR%" mkdir "%SETTINGS_DIR%" >nul 2>&1

echo.
echo [1/2] Dang ghi cau hinh cung vao settings.json...
powershell -NoProfile -ExecutionPolicy Bypass -Command "$ErrorActionPreference='SilentlyContinue'; $sf=$env:SETTINGS_FILE; $data=$null; if(Test-Path $sf){try{$data=Get-Content $sf -Raw | ConvertFrom-Json}catch{$data=$null}}; if($null -eq $data){$data=[PSCustomObject]@{}}; if(-not($data.PSObject.Properties.Name -contains 'env')){$data | Add-Member -NotePropertyName 'env' -NotePropertyValue ([PSCustomObject]@{}) -Force}; $e=$data.env; if($null -eq $e){$e=[PSCustomObject]@{}; $data.env=$e}; $e | Add-Member -Force -NotePropertyName 'ANTHROPIC_BASE_URL' -NotePropertyValue $env:BASE_URL; $e | Add-Member -Force -NotePropertyName 'ANTHROPIC_AUTH_TOKEN' -NotePropertyValue $env:APIKEY; $e | Add-Member -Force -NotePropertyName 'ANTHROPIC_MODEL' -NotePropertyValue $env:MODEL_MAIN; $e | Add-Member -Force -NotePropertyName 'ANTHROPIC_DEFAULT_OPUS_MODEL' -NotePropertyValue $env:MODEL_OPUS; $e | Add-Member -Force -NotePropertyName 'ANTHROPIC_SMALL_FAST_MODEL' -NotePropertyValue $env:MODEL_SMALL; if($e.PSObject.Properties.Name -contains 'ANTHROPIC_API_KEY'){$e.PSObject.Properties.Remove('ANTHROPIC_API_KEY')}; $enc=New-Object System.Text.UTF8Encoding($false); [System.IO.File]::WriteAllText($sf,($data | ConvertTo-Json -Depth 20),$enc); $cj=Join-Path $env:USERPROFILE '.claude.json'; if(Test-Path $cj){try{$d=Get-Content $cj -Raw | ConvertFrom-Json; foreach($k in @('primaryApiKey','customApiKeyResponses')){if($d.PSObject.Properties.Name -contains $k){$d.PSObject.Properties.Remove($k)}}; [System.IO.File]::WriteAllText($cj,($d | ConvertTo-Json -Depth 20),$enc)}catch{}}"

:: Set them cho phien hien tai (giup Claude Code nhan key ngay)
set "ANTHROPIC_BASE_URL=%BASE_URL%"
set "ANTHROPIC_AUTH_TOKEN=%APIKEY%"
set "ANTHROPIC_MODEL=%MODEL_MAIN%"
set "ANTHROPIC_DEFAULT_OPUS_MODEL=%MODEL_OPUS%"
set "ANTHROPIC_SMALL_FAST_MODEL=%MODEL_SMALL%"

echo.
echo [OK] Da ghi cung key vao: %SETTINGS_FILE%
echo      (Lan sau mo van dung key nay, khong can nhap lai)
echo.
echo [2/2] Dang mo Claude Code tai thu muc nay...
echo      (Thu muc: %CD%)
echo.

:: Mo Claude Code ngay tai thu muc dat file bat
claude

echo.
echo ============================================================
echo  Claude Code da dong. Nhan phim bat ky de thoat.
echo ============================================================
pause >nul
