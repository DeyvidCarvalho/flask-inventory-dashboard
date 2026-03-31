# Acessar aplicação na rede local (WiFi)

Siga os passos abaixo para que outras máquinas na mesma rede WiFi acessem sua aplicação enquanto o notebook estiver ligado.

## Passo 1: Descobrir o IP local do notebook

No PowerShell, execute:

```powershell
ipconfig
```

Procure na seção da sua conexão WiFi (geralmente "Wireless LAN adapter" ou "Wi-Fi") pela linha **IPv4 Address**. Exemplo:

```
   IPv4 Address. . . . . . . . . : 192.168.1.100
```

Anote esse número (192.168.1.100 no exemplo acima).

## Passo 2: Iniciar a aplicação em modo acessível

Na pasta do projeto, execute:

```powershell
$env:FLASK_HOST="0.0.0.0"
python backend/app.py
```

A aplicação iniciará e você verá algo como:

```
 * Running on http://0.0.0.0:5000
```

## Passo 3: Acessar de outro computador na rede

Abra o navegador **de outro computador** conectado ao **mesmo WiFi** e digite:

```
http://192.168.1.100:5000
```

(Substitua `192.168.1.100` pelo IP que você anotou no Passo 1)

## Opção extra: Usar a porta padrão HTTP (80)

Se quiser acessar sem digitar a porta (http://192.168.1.100), execute como administrador:

```powershell
$env:FLASK_HOST="0.0.0.0"
$env:FLASK_PORT="80"
python backend/app.py
```

Mas isso requer privilégios de administrador no Windows.

## Dicas importantes

- ✅ **Certifique-se que você está no mesmo WiFi** - outras redes não funcionarão
- ✅ **Deixe o notebook/computador ligado** - a aplicação só roda enquanto está ativa
- ⚠️ **Firewall do Windows** - pode bloquear a conexão. Se não funcionar, adicione a aplicação às exceções:
  - Painel de Controle → Windows Defender Firewall → Permitir um aplicativo
  - Selecione Python e marque "Rede Privada"

- ⚠️ **Sessões separadas** - cada navegador mantém sua própria sessão de login

## Parar de compartilhar

Basta fechar a aplicação (Ctrl+C no PowerShell).
