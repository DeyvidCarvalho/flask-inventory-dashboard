# 🔐 Guia de Segurança - Flask Inventory Dashboard

## 1. Avisos Críticos

### ⚠️ HTTP vs HTTPS
- **Versão atual**: Usa HTTP puro (sem criptografia)
- **Senhas em rede**: Viajam em texto plano entre navegador e servidor
- **Risco**: Qualquer pessoa na rede pode interceptar com sniffer de rede

**Recomendação**: 
- ✅ Seguro: Rede corporativa privada/confiável
- ✅ Seguro: WiFi pessoal isolado
- ❌ Perigoso: WiFi público
- ❌ Perigoso: Redes não confiáveis

### 📱 localStorage vs Senhas Criptografadas
- **Senhas salvas**: Armazenadas em texto plano em localStorage
- **Risco**: Malware ou pessoa com acesso ao PC pode ler
- **localStorage**: Não é criptografado pelo navegador
- **Acesso**: Qualquer script rodando no navegador pode acessar

**Para segurança máxima**: Não ative salvamento de senhas em computadores compartilhados

---

## 2. O que Está Protegido ✅

### Senhas No Banco
- ✅ **Hash**: pbkdf2:sha256 com 60.000 iterações
- ✅ **Salt**: 16 bytes aleatórios
- ✅ **Armazenamento**: users.json (não commitado no git)
- ✅ **Irreversível**: Impossível recuperar senha original do hash

### Sessão
- ✅ **Session Cookies**: Identificados por Flask
- ✅ **Validação Real-Time**: Cada requisição sincroniza com users.json
- ✅ **Sem Cache Inseguro**: Permissões sempre relidas do arquivo

### Acesso à API
- ✅ **Autenticação**: `@login_obrigatorio` em rotas sensíveis
- ✅ **Autorização**: `@admin_obrigatorio` para operações admin
- ✅ **Sem exposição de erros**: Erros internos não mostram detalhes

### Logs
- ✅ **Sem senhas**: Senhas nunca são logadas
- ✅ **Console apenas**: Logs não são salvos em arquivo
- ✅ **Erros genéricos**: "Erro interno no servidor" para 500

---

## 3. Exposições Conhecidas ⚠️

### HTTP Puro
**Problema**: Requisição POST com senha em JSON
```json
POST /login HTTP/1.1
Content-Type: application/json

{"usuario": "deyvid", "senha": "minha-senha-aqui"}
```

**Quem pode ver**:
- Qualquer um fazendo sniffer na rede (Wireshark, etc)
- Proxy de rede corporativo
- ISP se não usar VPN

**Mitigação**:
1. Use HTTPS em produção
2. Use VPN/SSH Tunnel
3. Rede corporativa confiável

### localStorage Com Senhas
**Problema**: Senha armazenada em texto plano
```javascript
// No navegador, alguém escreve no console:
JSON.parse(localStorage.getItem("login_senhas_salvas_v1"))
// Retorna: {"deyvid": "minha-senha-aqui"}
```

**Quem pode acessar**:
- Malware/spyware no computador
- Extensões de navegador maliciosas
- Qualquer pessoa com acesso físico ao PC ligado
- Scripts de phishing/XSS

**Mitigação**:
1. Não ative salvamento em PC compartilhado
2. Use antivírus atualizado
3. Confira extensões do navegador
4. Considere criptografar localStorage (veja abaixo)

---

## 4. Como Melhorar Segurança

### Opção 1: Desabilitar Salvamento de Senhas (Recomendado para Shared PCs)

Edite `frontend/static/js/app.js`:

```javascript
// Localize a função logar() (linha ~940)
// Comente ou remova estas linhas:

// const decisaoSenha = devePerguntarSalvarSenha(data.usuario, senha);
// if (decisaoSenha.perguntar) {
//   mostrarPromptSalvarSenha(data.usuario, senha, decisaoSenha.motivo);
// } else {
//   const preferenciaSalvar = obterPreferenciaSalvarSenha(data.usuario);
//   if (preferenciaSalvar) {
//     registrarSenhaSalva(data.usuario, senha);
//   }
// }
```

**Resultado**: Nenhuma senha salva, mas ainda mostra histórico de usuários.

### Opção 2: Implementar HTTPS (Para Produção)

#### Com Self-Signed Certificate (rápido):
```powershell
# Instale pyopenssl
pip install pyopenssl

# Gere certificado (válido 365 dias)
openssl req -x509 -newkey rsa:4096 -nodes -out cert.pem -keyout key.pem -days 365
```

#### Configure Flask para HTTPS:
```python
# No final de backend/app.py
if __name__ == "__main__":
    # Para HTTPS:
    app.run(host=host, port=port, debug=debug, 
            ssl_context=('cert.pem', 'key.pem'))
```

#### Acesse via HTTPS:
```
https://seu-ip:5000
# Navegador vai avisar: certificado não confiável (normal para self-signed)
# Clique em "Avançado" → "Continuar"
```

### Opção 3: Usar SSH Tunnel (Melhor Segurança)

Redirecione porta localmente via SSH criptografado:

```powershell
# Terminal 1: Túnel SSH
ssh -L 5000:localhost:5000 usuario@ip-servidor

# Terminal 2: Inicie Flask
python backend/app.py

# Browser: Acesse
http://localhost:5000
```

**Vantagem**: Setor inteiro viaja criptografado via SSH.

### Opção 4: Usar Waitress + HTTPS (Recomendado)

Melhor que servidor Flask para rede:

```powershell
# Instale
pip install waitress

# Rode com HTTPS
waitress-serve --port=5000 --cert=cert.pem --key=key.pem backend.app:app
```

### Opção 5: Criptografar localStorage (Avançado)

Instale biblioteca de criptografia:

```powershell
pip install pycryptodome
```

Adicione ao `frontend/static/js/app.js`:

```javascript
// Você precisará de uma chave mestra (derive da senha?)
// Importe TweetNaCl.js ou similar
// Criptografe senha antes de salvar:

function registrarSenhaSalvaEncriptada(usuario, senha, chaveMestra) {
  // Criptografe a senha
  // Depois salve em localStorage
}
```

**Nota**: Isso é complexo e a chave precisa ser gerenciada seguramente.

---

## 5. Checklist de Segurança

- [ ] Rede corporativa/privada confiável
- [ ] Antivírus/antimalware atualizado
- [ ] Extensões do navegador auditadas
- [ ] Senha admin forte (não use padrão)
- [ ] Confirme ninguém teve acesso físico ao PC
- [ ] Senhas diferentes para usuários diferentes
- [ ] Não compartilhe credenciais
- [ ] Para rede aberta: Use HTTPS ou SSH Tunnel
- [ ] Para PC compartilhado: Desabilite salvamento de senhas
- [ ] Patches de OS/navegador atualizados

---

## 6. Política de Alteração de Senha

### Primeira Alteração
- Login inicial: Muda senha padrão do admin
- Sistema detecta mudança automáticamente
- Na próxima tentativa de login com senha velha: Falha com "Senha inválida"

### Alterações Futuras (por admin)
- Um admin pode alterar senha de outro usuário
- Usuário detecta mudança no próximo poll (até 5 segundos)
- Se alterar sua própria senha: Sistema pergunta sobre salvamento novamente
- localStorage mantém senha velha até ser salva nova

---

## 7. Variáveis de Ambiente Sensíveis

**Nunca coloque em .env commitado:**

```env
# ❌ ERRADO (commitou?)
SECRET_KEY=super-secreto-aqui
ADMIN_PASSWORD=admin123

# ✅ CORRETO (nunca comita .env)
# Use .env.example como template:
SECRET_KEY=mude-isto-em-producao
ADMIN_PASSWORD=mude-isto-em-producao
```

**Verificar se foi commitado por acidente:**

```powershell
git log --all --full-history -- .env
git log --all --full-history -- users.json
```

Se foi, gere nova SECRET_KEY e ADMIN_PASSWORD imediatamente.

---

## 8. Monitoramento Básico

### Detectar Login Suspeito
Os logs mostram:
```
POST /login - 401 (login falhou)
POST /login - 200 (login sucesso)
```

Se muitos logins 401 de IPs diferentes = possível tentativa de bruteforce.

**Implementar ratelimit (futuro)**:
```python
from flask_limiter import Limiter
limiter = Limiter(app, key_func=lambda: request.remote_addr)

@app.route("/login", methods=["POST"])
@limiter.limit("5 per minute")  # Max 5 tentativas/min
def login():
    ...
```

---

## 9. Referências

- [OWASP: Authentication Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Authentication_Cheat_Sheet.html)
- [Werkzeug Password Hashing](https://werkzeug.palletsprojects.com/en/2.3.x/security/)
- [Flask Security Design](https://flask.palletsprojects.com/en/2.3.x/security/)
- [HTTPS Everywhere](https://www.eff.org/https-everywhere)

---

## 10. Contato de Segurança

Se descobrir uma vulnerabilidade:
1. **Não publique** no GitHub Issues
2. **Crie uma branch privada**
3. **Corrija** e teste nos testes
4. **Commit com mensagem descritiva**: `security: fix XSS vulnerability in...`

---

**Última atualização**: 31 de Março, 2026
**Status**: HTTP puro, localStorage com senhas (seguro apenas para rede corporativa privada)
