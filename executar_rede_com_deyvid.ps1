# Script para executar a aplicação na rede local com usuário Deyvid
# Acesso: http://SEU_IP_LOCAL:5000
# Login: Deyvid / deyvid66

Write-Host "=====================================" -ForegroundColor Green
Write-Host "Inventário Dashboard - Modo Rede" -ForegroundColor Green
Write-Host "=====================================" -ForegroundColor Green
Write-Host ""

# Obter IP local
$ipAddress = (Get-NetIPAddress -AddressFamily IPv4 -ErrorAction SilentlyContinue | Where-Object {$_.AddressState -eq "Preferred"} -ErrorAction SilentlyContinue | Select-Object -First 1).IPAddress

Write-Host "Usuário: Deyvid" -ForegroundColor Yellow
Write-Host "Senha: senhaqualquer" -ForegroundColor Yellow
Write-Host ""

if ($ipAddress) {
    Write-Host "Acesse em seu computador/celular:" -ForegroundColor Cyan
    Write-Host "http://$($ipAddress):5000" -ForegroundColor Cyan
} else {
    Write-Host "Acesse em seu computador/celular:" -ForegroundColor Cyan
    Write-Host "http://SEU_IP_LOCAL:5000" -ForegroundColor Cyan
    Write-Host "(Substitua SEU_IP_LOCAL pelo seu IP local)" -ForegroundColor Gray
}

Write-Host ""
Write-Host "Iniciando aplicação..." -ForegroundColor Yellow
Write-Host ""

# Configurar variáveis de ambiente
$env:FLASK_HOST="0.0.0.0"
$env:FLASK_PORT="5000"

# Executar a aplicação
.venv\Scripts\python.exe backend/app.py
