#!/usr/bin/env pwsh
# Script para executar a aplicação acessível na rede local WiFi

Write-Host "╔════════════════════════════════════════════════╗" -ForegroundColor Cyan
Write-Host "║  RIZZO GTIN - Dashboard Acessível na Rede    ║" -ForegroundColor Cyan
Write-Host "╚════════════════════════════════════════════════╝" -ForegroundColor Cyan

# Obter IP local
$ipLocal = (ipconfig | Select-String "IPv4 Address" | Select-Object -Last 1) -replace '.*:\s*', ''

# Tentar extrair apenas o IP (remove espaços extras)
$ipLocal = $ipLocal.Trim()

Write-Host "`n✅ IP local detectado: $ipLocal`n" -ForegroundColor Green

Write-Host "📱 Para acessar de outro computador na mesma rede WiFi:" -ForegroundColor Yellow
Write-Host "   http://$($ipLocal):5000`n" -ForegroundColor White

Write-Host "ℹ️  Instrução para usar porta 80 (sem :5000):" -ForegroundColor Yellow
Write-Host "   $> `$env:FLASK_PORT=80; python backend/app.py" -ForegroundColor Gray
Write-Host "   (Requer privilégios de administrador)`n" -ForegroundColor Gray

Write-Host "⚠️  Aviso importante:" -ForegroundColor Yellow
Write-Host "   • Ambas as máquinas devem estar conectadas ao MESMO WiFi" -ForegroundColor Gray
Write-Host "   • A aplicação funciona enquanto o notebook estiver ligado" -ForegroundColor Gray
Write-Host "   • Firewall do Windows pode bloquear - veja REDE_LOCAL.md" -ForegroundColor Gray

Write-Host "`n🚀 Iniciando aplicação..." -ForegroundColor Cyan
Write-Host "   Pressione Ctrl+C para parar`n" -ForegroundColor Gray

# Inicie a aplicação em 0.0.0.0
$env:FLASK_HOST = "0.0.0.0"
python backend/app.py
