# 📊 Flask Inventory Dashboard

Aplicação Flask para consulta de inventário, filtros por dashboard e registro de relatórios técnicos com sistema completo de autenticação, autorização e administração de usuários.

## ✨ Melhorias implementadas

### Autenticação e Autorização
- ✅ Autenticação por sessão com login por usuário/senha e registro
- ✅ Aprovação de acesso por administrador com interface visual
- ✅ Sistema inteligente de permissões em tempo real (sincronização via polling a cada 5s)
- ✅ Proteção de rotas sensíveis com middleware de autenticação e validação de admin
- ✅ Hash de senhas seguro com `pbkdf2:sha256:60000`

### Conveniences e UX
- ✅ **Seletor de contas**: Histórico de usuários já logados (localStorage)
- ✅ **Sugestões de senha**: Mostra password salvo quando usuário é selecionado
- ✅ **Prompt inteligente**: Pergunta para salvar senha apenas na primeira vez ou quando alterada
- ✅ **Preferência do usuário**: Lembra decisão de salvar/não salvar por usuário
- ✅ **Atalhos de teclado**: Enter para login e busca
- ✅ **Autocomplete desativado**: Evita sugestões do navegador conflitando com custom dropdowns

### Administração de Usuários
- ✅ Gerenciamento completo: criar, aprovar, renomear, alterar senha, promover/revogar admin
- ✅ Interface inteligente com toggles on/off para aprovação e admin status
- ✅ Validação de permissões em tempo real em cada requisição

### Backend e Dados
- ✅ Padronização de respostas da API (`ok`, `data`, `error`)
- ✅ Validação de entrada em busca e relatórios
- ✅ Otimização da busca de histórico (eliminação de padrão N+1)
- ✅ Inicialização segura de banco e criação de índices para performance
- ✅ Tratamento de erros 404 e 500 com resposta JSON consistente
- ✅ Arquivo de usuários em JSON com sincronização em tempo real

### Frontend
- ✅ Frontend separado em `frontend/static` e `frontend/templates`
- ✅ Renderização mais eficiente no cliente com `DocumentFragment`
- ✅ Dropdowns animados para sugestões de usuários/senhas
- ✅ Prompt animado para decisão de salvar senha (slide-up com scale)

### Relatórios
- ✅ Exportação de relatórios em CSV
- ✅ Suite de testes com pytest cobrindo fluxos principais

## Requisitos

- Python 3.10+

## Instalacao

```powershell
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
```

## Variaveis de ambiente

Use `.env.example` como base:

- `SECRET_KEY`: chave de sessao da aplicacao.
- `DATABASE_PATH`: caminho do banco SQLite.
- `FLASK_HOST`: host de bind do servidor (padrao: `127.0.0.1`).
- `FLASK_PORT`: porta do servidor (padrao: `5000`).
- `FLASK_DEBUG`: `1` para debug local, `0` para execucao normal.
- `ADMIN_USER`: nome do admin bootstrap criado na inicializacao (padrao: `admin`).
- `ADMIN_PASSWORD`: senha do admin bootstrap criado na inicializacao (padrao: `admin123`).

## 🔐 Segurança: HTTP, Senhas em Rede e localStorage

**⚠️ LEIA COM ATENÇÃO - IMPORTANTE PARA SEGURANÇA**

A aplicação funciona sobre **HTTP puro** (não HTTPS), o que significa:

### Riscos em Rede Compartilhada
- ❌ **Senhas viajam em texto plano** na rede durante login
- ❌ **Sniffer de rede** pode interceptar usuario/senha entre cliente e servidor
- ⚠️ **Somente seguro em:**
  - Rede WiFi/cabo privado ou corporativo confiável
  - Localhost (127.0.0.1)
  - Redes com acesso físico restrito

### Armazenamento Local (localStorage)
O sistema inclui **persistência inteligente de senhas no navegador**:
- **Senhas**: Armazenadas em `localStorage` em **texto plano** com chave `CHAVE_SENHAS_SALVAS`
- **Usuários**: Histórico de contas em `localStorage` com chave `CHAVE_USUARIOS_SALVOS` (máximo 8)
- **Preferências**: Decisão sobre salvar em `localStorage` com chave `CHAVE_PREF_SALVAR_SENHA`

⚠️ **localStorage é acessível por:**
- Qualquer script rodando na mesma aba
- Malware ou extensões de navegador maliciosas
- Qualquer pessoa com acesso físico ao computador ligado/desbloqueado
- **Nunca é criptografado pelo navegador**

### ✅ Seguro para usar se:
- [x] Computador pessoal/dedicado (não compartilhado)
- [x] Rede corporativa confiável ou privada
- [x] Sem risco de malware
- [x] Você confía nas pessoas com acesso ao computador

### ❌ Não use salvamento de senhas se:
- [ ] Computador compartilhado com várias pessoas
- [ ] Computador público (ciber café, biblioteca, etc)
- [ ] Rede WiFi pública/aberta
- [ ] Risco de malware ou extensões não confiáveis

### 🛡️ Como aumentar segurança:

**Opção 1: Desabilitar salvamento de senhas**
Edite `frontend/static/js/app.js` e comente essas funções:
```javascript
// registrarSenhaSalva(...) 
// obterSenhasSalvas()
// configurarSugestaoSenhaLogin()
```

**Opção 2: Usar HTTPS em produção**
Para rede corporativa real, configure:
1. Gere certificado SSL/TLS (self-signed ou via Let's Encrypt)
2. Configure Flask ou use Waitress com HTTPS
3. Acesse via `https://seu-ip:5000`

**Opção 3: Usar VPN/SSH Tunnel** (recomendado)
```powershell
# Tunnel local para servidor remoto:
ssh -L 5000:localhost:5000 usuario@servidor
# Depois acesse: http://localhost:5000
```

## Sincronização em Tempo Real de Permissões

O sistema faz polling a cada **5 segundos** para detectar mudanças de permissão em tempo real:
- Se um admin remove sua permissão → você é redirecionado para login
- Se um admin lhe promove a admin → menu de admin aparece automaticamente
- Isso funciona **simultaneamente em múltiplas abas/dispositivos**

Implementado via `GET /session` que lê diretamente de `users.json` (não usa cache)

## Cadastro e aprovacao de acesso

- Usuario novo usa o botao **Registrar** com usuario e senha.
- O sistema cria o cadastro como pendente e mostra:
	`Registro concluido, aguarde um Administrador aprovar seu acesso.`
- Enquanto estiver pendente, o usuario nao acessa dashboard, busca e relatorios.
- Administradores recebem notificacao no menu lateral (`Aprovacoes (N)`) e podem liberar pelo toggle na tela de aprovacoes.
- Ao aprovar, o usuario passa a acessar tudo apos atualizar a sessao/pagina.

### !important: Como criar o primeiro usuário Admin

O arquivo de usuários (`users.json`) é gerado automaticamente e **não é versionado** (adicionado ao `.gitignore`).

Na primeira execução, siga estes passos:

1. **Configure as variáveis de ambiente** para seu admin inicial:

```powershell
$env:ADMIN_USER="seu_usuario_admin"
$env:ADMIN_PASSWORD="uma_senha_forte"
python backend/app.py
```

2. **Acesse a aplicação** em `http://127.0.0.1:5000`

3. **Faça login** com o usuário e senha que configurou nas variáveis de ambiente

4. **Registre outros usuários** que receberão aprovação via dashboard

---

**Importante:**
- A variável `ADMIN_PASSWORD` em `users.json` é **hasheada** e armazenada com segurança (pbkdf2:sha256)
- Nunca coloque senhas em plain text no código ou `.env`
- Em ambiente de produção, use senhas fortes
- Se não definir `ADMIN_USER` e `ADMIN_PASSWORD`, o padrão será `admin` / `admin123`

### Arquivo de usuários (users.json)

Todos os usuários são salvos em `users.json` na raiz do projeto:
- **Nunca é commitado** (está em `.gitignore`)
- Contém senhas hasheadas com `pbkdf2:sha256:60000`
- Armazena informações de aprovação e permissões
- Exemplo de estrutura:

```json
{
  "admin": {
    "senha_hash": "pbkdf2:sha256:60000$...",
    "aprovado": true,
    "is_admin": true,
    "data_cadastro": "01/01/2026 10:00",
    "aprovado_em": "01/01/2026 10:00",
    "aprovado_por": "sistema"
  },
  "colaborador": {
    "senha_hash": "pbkdf2:sha256:60000$...",
    "aprovado": false,
    "is_admin": false,
    "data_cadastro": "01/01/2026 11:00",
    "aprovado_em": null,
    "aprovado_por": null
  }
}
```

## Publicar no GitHub (seguro)

- O arquivo `.env` nao deve ser versionado (contendo segredos).
- O arquivo `users.json` nao deve ser versionado (contendo senhas hasheadas de usuarios).
- O banco local `inventario.db` nao deve ser versionado.
- O repositório inclui `.env.example` para documentar as variaveis necessarias.

Fluxo sugerido:

```powershell
git init
git add .
git commit -m "Primeiro commit"
git branch -M main
git remote add origin https://github.com/SEU_USUARIO/NOME_DO_REPO.git
git push -u origin main
```

Se voce adicionou `.env` ou `users.json` por engano:

```powershell
git rm --cached .env users.json
git commit -m "Remove .env e users.json do versionamento"
git push
```

Se havia segredo real no historico, gere um novo segredo imediatamente.

## Banco local (sem versionar arquivo .db)

Para evitar subir `inventario.db` e ainda permitir executar o projeto, inicialize um banco vazio local:

```powershell
python backend/init_db.py
```

Depois, rode a aplicacao normalmente. Assim o repositório fica limpo e reproduzivel sem expor dados.

## Banco ficticio para demonstracao

Para gerar dados de teste (inventario, historico e relatorios) no banco local:

```powershell
python backend/seed_db.py --reset
```

O `--reset` limpa os dados atuais antes de inserir os dados ficticios.
Se preferir apenas adicionar mais dados sem limpar, rode sem esse parametro.

Importante: agora o seed usa por padrao o arquivo `inventario_demo.db`, evitando sobrescrever `inventario.db`.

Para subir a aplicacao usando o banco de demonstracao:

```powershell
$env:DATABASE_PATH="inventario_demo.db"
python backend/app.py
```

Se realmente quiser popular o banco principal, use conscientemente:

```powershell
python backend/seed_db.py --db inventario.db --reset --allow-main-db
```

## Executar

```powershell
python backend/app.py
```

A aplicacao sobe em `http://127.0.0.1:5000`.

Para permitir acesso de outros dispositivos na mesma rede WiFi:

```powershell
$env:FLASK_HOST="0.0.0.0"
python backend/app.py
```

Nesse caso, o acesso externo fica em `http://SEU_IP_LOCAL:5000`.

## Testes

```powershell
pytest -q
```

## ⌨️ Atalhos de Teclado

| Atalho | Função |
|--------|--------|
| `Enter` (na tela de login) | Faz login |
| `Enter` (na tela de busca) | Executa busca |

## 💡 Dicas de Uso

### Seletor de Contas
- Clique no campo de usuário ou comece a digitar para ver histórico de contas usadas
- Clique em uma conta para preencher automaticamente
- Sugestão de senha aparece automaticamente quando conta é selecionada

### Salvar Senhas
- Na primeira vez, um prompt aparece perguntando se deseja salvar a senha
- Você pode escolher "Sempre salvar", "Nunca perguntar" ou "Não" 
- Sua escolha é lembrada indefinidamente por usuário
- Se alterar a senha, o sistema detecta e pergunta novamente

### Sincronização em Tempo Real
- Se um admin mudar suas permissões, você será redirecionado automaticamente (em até 5 segundos)
- Múltiplas abas sincronizam em tempo real
- Funciona também entre diferentes dispositivos na rede

### Acesso de Rede
Para acessar de outro dispositivo na mesma rede:

```powershell
# Em Windows
$env:FLASK_HOST="0.0.0.0"
python backend/app.py
```

Depois, acesse via: `http://IP_DO_COMPUTADOR:5000`

## Rotas principais

### Autenticação
- `POST /registrar` - Registrar novo usuário (pendente de aprovação)
- `POST /login` - Fazer login
- `POST /logout` - Fazer logout
- `GET /session` - Sincronizar sessão (verifica status em tempo real, com polling a cada 5s)

### Administração de Usuários
- `GET /admin/usuarios` - Listar todos os usuários com status de aprovação e admin
- `PATCH /admin/usuarios/<nome_usuario>/aprovar` - Aprovar/rejeitar acesso de novo usuário
- `PATCH /admin/usuarios/<nome_usuario>/admin` - Promover/revogar permissão de admin
- `PATCH /admin/usuarios/<nome_usuario>/senha` - Alterar senha do usuário
- `PATCH /admin/usuarios/<nome_usuario>/renomear` - Renomear usuário

### Dashboard e Dados
- `GET /dashboard` - Obter dados do dashboard
- `POST /dashboard/filtrar` - Filtrar dados por critério único
- `POST /dashboard/filtrar_multiplos` - Filtrar dados por múltiplos critérios

### Busca e Relatórios
- `POST /buscar` - Buscar inventário
- `POST /salvar_relatorio` - Salvar novo relatório
- `GET /listar_relatorios` - Listar relatórios salvos
- `GET /exportar_relatorios.csv` - Exportar relatórios em CSV

### Saúde
- `GET /health` - Health check da API
