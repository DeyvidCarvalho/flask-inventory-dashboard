# Buscar Banco de dados

Aplicacao Flask para consulta de inventario, filtros por dashboard e registro de relatorios tecnicos.

## Melhorias implementadas

- Autenticacao por sessao com login, validacao de sessao e logout.
- Protecao de rotas sensiveis com middleware de autenticacao.
- Padronizacao de respostas da API (`ok`, `data`, `error`).
- Validacao de entrada em busca e relatorios.
- Otimizacao da busca de historico (eliminacao de padrao N+1).
- Inicializacao segura de banco e criacao de indices para performance.
- Tratamento de erros 404 e 500 com resposta JSON consistente.
- Frontend separado em `frontend/static` e `frontend/templates`.
- Renderizacao mais eficiente no cliente com `DocumentFragment`.
- Exportacao de relatorios em CSV.
- Suite de testes com pytest cobrindo fluxos principais.

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

## Publicar no GitHub (seguro)

- O arquivo `.env` nao deve ser versionado (contendo segredos).
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

Se voce adicionou `.env` por engano:

```powershell
git rm --cached .env
git commit -m "Remove .env do versionamento"
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

## Rotas principais

- `POST /login`
- `POST /logout`
- `GET /session`
- `GET /dashboard`
- `POST /dashboard/filtrar`
- `POST /buscar`
- `POST /salvar_relatorio`
- `GET /listar_relatorios`
- `GET /exportar_relatorios.csv`
- `GET /health`
