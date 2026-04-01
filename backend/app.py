import logging
import os
import sqlite3
from datetime import datetime
from functools import wraps

from flask import Flask, Response, jsonify, render_template, request, session

try:
    from .users_manager import (
        registrar_usuario,
        validar_login,
        contar_pendentes,
        listar_usuarios,
        aprovar_usuario,
        fazer_admin,
        alterar_senha,
        renomear_usuario,
        obter_usuario,
        setup_admin_inicial,
    )
except ImportError:
    from users_manager import (
        registrar_usuario,
        validar_login,
        contar_pendentes,
        listar_usuarios,
        aprovar_usuario,
        fazer_admin,
        alterar_senha,
        renomear_usuario,
        obter_usuario,
        setup_admin_inicial,
    )

BASE_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
FRONTEND_DIR = os.path.join(BASE_DIR, "frontend")
DEFAULT_DATABASE_PATH = os.path.join(BASE_DIR, "inventario.db")

app = Flask(
    __name__,
    template_folder=os.path.join(FRONTEND_DIR, "templates"),
    static_folder=os.path.join(FRONTEND_DIR, "static"),
)
app.config["SECRET_KEY"] = os.getenv("SECRET_KEY", "dev-secret-change-me")
app.config["DATABASE_PATH"] = os.getenv("DATABASE_PATH", DEFAULT_DATABASE_PATH)
app.config["JSON_AS_ASCII"] = False
app.config["DB_INITIALIZED"] = False


def conectar():
    conn = sqlite3.connect(app.config["DATABASE_PATH"])
    conn.row_factory = sqlite3.Row
    return conn


def resposta_ok(data=None, status=200):
    return jsonify({"ok": True, "data": data or {}}), status


def resposta_erro(mensagem, status=400):
    return jsonify({"ok": False, "error": mensagem}), status


def csv_escape(valor):
    if valor is None:
        return '""'
    texto = str(valor).replace('"', '""')
    return f'"{texto}"'


def usuario_atual():
    return session.get("usuario")


def admin_atual():
    return bool(session.get("is_admin"))


def sincronizar_sessao_usuario():
    usuario = usuario_atual()
    if not usuario:
        return None

    dados_usuario = obter_usuario(usuario)
    if not dados_usuario or not dados_usuario.get("aprovado", False):
        session.clear()
        return None

    # Mantem a sessão atualizada mesmo após renomear usuário ou alterar cargo.
    session["usuario"] = dados_usuario["usuario"]
    session["is_admin"] = bool(dados_usuario.get("is_admin", False))
    return dados_usuario


def login_obrigatorio(func):
    @wraps(func)
    def wrapper(*args, **kwargs):
        if not sincronizar_sessao_usuario():
            return resposta_erro("Nao autenticado", 401)
        return func(*args, **kwargs)

    return wrapper


def admin_obrigatorio(func):
    @wraps(func)
    def wrapper(*args, **kwargs):
        dados_usuario = sincronizar_sessao_usuario()
        if not dados_usuario or not bool(dados_usuario.get("is_admin", False)):
            return resposta_erro("Acesso restrito ao administrador", 403)
        return func(*args, **kwargs)

    return wrapper


def timestamp_atual():
    return datetime.now().strftime("%d/%m/%Y %H:%M")


def inicializar_banco():
    conn = conectar()
    c = conn.cursor()

    c.execute(
        """
        CREATE TABLE IF NOT EXISTS relatorios (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            usuario TEXT,
            titulo TEXT,
            conteudo TEXT,
            data TEXT
        )
    """
    )

    c.execute("PRAGMA table_info(relatorios)")
    colunas_relatorios = {row[1] for row in c.fetchall()}

    # Migrate legacy report table schemas to match the current API contract.
    if "id" not in colunas_relatorios:
        c.execute("ALTER TABLE relatorios RENAME TO relatorios_legado")
        c.execute(
            """
            CREATE TABLE relatorios (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                usuario TEXT,
                titulo TEXT,
                conteudo TEXT,
                data TEXT
            )
            """
        )

        colunas_copiaveis = [
            nome
            for nome in ["usuario", "titulo", "conteudo", "data"]
            if nome in colunas_relatorios
        ]
        if colunas_copiaveis:
            colunas_sql = ", ".join(colunas_copiaveis)
            c.execute(
                f"INSERT INTO relatorios ({colunas_sql}) SELECT {colunas_sql} FROM relatorios_legado"
            )
        c.execute("DROP TABLE relatorios_legado")
    else:
        for coluna in ["usuario", "titulo", "conteudo", "data"]:
            if coluna not in colunas_relatorios:
                c.execute(f"ALTER TABLE relatorios ADD COLUMN {coluna} TEXT")

    c.execute("SELECT name FROM sqlite_master WHERE type='table'")
    tabelas = {row[0] for row in c.fetchall()}

    # Indexes speed up dashboard filters and text search fields.
    if "inventario" in tabelas:
        c.execute("CREATE INDEX IF NOT EXISTS idx_inventario_usuario ON inventario(usuario)")
        c.execute("CREATE INDEX IF NOT EXISTS idx_inventario_computador ON inventario(computador)")
        c.execute("CREATE INDEX IF NOT EXISTS idx_inventario_serial ON inventario(serial)")
        c.execute("CREATE INDEX IF NOT EXISTS idx_inventario_ip ON inventario(ip)")
    if "inventario_historico" in tabelas:
        c.execute("CREATE INDEX IF NOT EXISTS idx_historico_computador ON inventario_historico(computador)")

    conn.commit()
    conn.close()


@app.before_request
def garantir_banco_inicializado():
    if app.config["DB_INITIALIZED"]:
        return
    inicializar_banco()
    setup_admin_inicial()  # Configura admin inicial se não existir
    app.config["DB_INITIALIZED"] = True


def obter_colunas_inventario(cursor):
    cursor.execute("PRAGMA table_info(inventario)")
    return [coluna[1] for coluna in cursor.fetchall()]


def linha_para_dict(colunas, linha):
    return {colunas[i]: linha[i] for i in range(len(colunas))}


def historico_por_computadores(cursor, computadores):
    historico = {}
    nomes = [nome for nome in computadores if nome]
    if not nomes:
        return historico

    placeholders = ",".join(["?"] * len(nomes))
    cursor.execute(
        f"""
        SELECT computador, data, mudanca
        FROM inventario_historico
        WHERE computador IN ({placeholders})
        ORDER BY id DESC
        """,
        tuple(nomes),
    )

    for row in cursor.fetchall():
        computador = row[0]
        historico.setdefault(computador, []).append(
            {"data": row[1], "mudanca": row[2]}
        )

    return historico


def expressao_cpu_categoria():
    return """
        CASE
            WHEN LOWER(COALESCE(cpu, '')) LIKE '%i3%' THEN 'i3'
            WHEN LOWER(COALESCE(cpu, '')) LIKE '%i5%' THEN 'i5'
            WHEN LOWER(COALESCE(cpu, '')) LIKE '%i7%' THEN 'i7'
            WHEN LOWER(COALESCE(cpu, '')) LIKE '%i9%' THEN 'i9'
            WHEN LOWER(COALESCE(cpu, '')) LIKE '%ryzen 3%' THEN 'Ryzen 3'
            WHEN LOWER(COALESCE(cpu, '')) LIKE '%ryzen 5%' THEN 'Ryzen 5'
            WHEN LOWER(COALESCE(cpu, '')) LIKE '%ryzen 7%' THEN 'Ryzen 7'
            WHEN LOWER(COALESCE(cpu, '')) LIKE '%ryzen 9%' THEN 'Ryzen 9'
            WHEN TRIM(COALESCE(cpu, '')) = '' THEN 'Nao informado'
            ELSE 'Outros'
        END
    """


def coluna_windows_disponivel(colunas):
    mapa_colunas = {str(coluna).lower(): coluna for coluna in colunas}
    for nome in ["windows", "sistema_operacional", "sistema", "so", "os"]:
        coluna_real = mapa_colunas.get(nome)
        if coluna_real:
            return coluna_real
    return None


def expressao_windows_origem(colunas):
    mapa_colunas = {str(coluna).lower(): coluna for coluna in colunas}
    candidatas = [
        mapa_colunas[nome]
        for nome in ["windows", "sistema_operacional", "sistema", "so", "os"]
        if nome in mapa_colunas
    ]
    if not candidatas:
        return "''"

    partes = [f"NULLIF(TRIM({nome}), '')" for nome in candidatas]
    if len(partes) == 1:
        return partes[0]
    return f"COALESCE({', '.join(partes)})"


def expressao_windows_categoria(colunas):
    if not coluna_windows_disponivel(colunas):
        return "'Nao informado'"

    origem = expressao_windows_origem(colunas)
    origem_sem_espaco = (
        f"LOWER(REPLACE(REPLACE(REPLACE(COALESCE({origem}, ''), ' ', ''), '-', ''), '_', ''))"
    )

    return f"""
        CASE
            WHEN TRIM(COALESCE({origem}, '')) = '' THEN 'Nao informado'
            WHEN {origem_sem_espaco} LIKE '%windows11%' OR {origem_sem_espaco} LIKE '%win11%' THEN 'Windows 11'
            WHEN {origem_sem_espaco} LIKE '%windows10%' OR {origem_sem_espaco} LIKE '%win10%' THEN 'Windows 10'
            ELSE TRIM(COALESCE({origem}, 'Nao informado'))
        END
    """


def lista_strings_unicas(valor):
    if not isinstance(valor, list):
        return []
    limpo = []
    vistos = set()
    for item in valor:
        texto = (str(item) if item is not None else "").strip()
        if not texto or texto in vistos:
            continue
        vistos.add(texto)
        limpo.append(texto)
    return limpo


def placeholders_sql(qtd):
    return ",".join(["?"] * qtd)


def filtro_descricao(filtros):
    partes = []
    if filtros.get("ram"):
        partes.append("RAM: " + ", ".join(filtros["ram"]))
    if filtros.get("cpu"):
        partes.append("CPU: " + ", ".join(filtros["cpu"]))
    if filtros.get("windows"):
        partes.append("Windows: " + ", ".join(filtros["windows"]))
    return " | ".join(partes) if partes else "Nenhum"

@app.route("/")
def home():
    return render_template("index.html")

# =====================
# AUTENTICACAO
# =====================
@app.route("/registrar", methods=["POST"])
def registrar():
    dados = request.json or {}
    usuario = (dados.get("usuario") or "").strip()
    senha = (dados.get("senha") or "").strip()

    if len(usuario) < 2:
        return resposta_erro("Usuario precisa ter ao menos 2 caracteres", 400)
    if len(usuario) > 60:
        return resposta_erro("Usuario muito longo", 400)
    if len(senha) < 3:
        return resposta_erro("Senha precisa ter ao menos 3 caracteres", 400)
    if len(senha) > 120:
        return resposta_erro("Senha muito longa", 400)

    sucesso, mensagem = registrar_usuario(usuario, senha)
    if not sucesso:
        return resposta_erro(mensagem, 409)

    return resposta_ok({"mensagem": mensagem}, 201)


@app.route("/login", methods=["POST"])
def login():
    dados = request.json or {}
    usuario = (dados.get("usuario") or "").strip()
    senha = (dados.get("senha") or "").strip()

    if len(usuario) < 2:
        return resposta_erro("Usuario precisa ter ao menos 2 caracteres", 400)
    if len(usuario) > 60:
        return resposta_erro("Usuario muito longo", 400)
    if not senha:
        return resposta_erro("Senha obrigatoria", 400)

    sucesso, mensagem, usuario_dados = validar_login(usuario, senha)
    if not sucesso:
        return resposta_erro(mensagem, 401 if "invalido" in mensagem.lower() else 403)

    session["usuario"] = usuario_dados["usuario"]
    session["is_admin"] = usuario_dados.get("is_admin", False)

    pendentes = contar_pendentes() if usuario_dados.get("is_admin", False) else 0
    return resposta_ok(
        {
            "usuario": usuario_dados["usuario"],
            "is_admin": usuario_dados.get("is_admin", False),
            "pendentes_aprovacao": pendentes,
        }
    )


@app.route("/logout", methods=["POST"])
def logout():
    session.clear()
    return resposta_ok({"mensagem": "Logout realizado"})


@app.route("/session")
def sessao_atual():
    dados_usuario = sincronizar_sessao_usuario()
    if not dados_usuario:
        return resposta_erro("Nao autenticado", 401)

    is_admin = bool(dados_usuario.get("is_admin", False))
    pendentes = 0
    if is_admin:
        pendentes = contar_pendentes()

    return resposta_ok(
        {
            "usuario": dados_usuario["usuario"],
            "is_admin": is_admin,
            "pendentes_aprovacao": pendentes,
        }
    )


@app.route("/admin/usuarios")
@admin_obrigatorio
def admin_listar_usuarios():
    usuarios = listar_usuarios()
    pendentes = contar_pendentes()
    return resposta_ok({"usuarios": usuarios, "pendentes_aprovacao": pendentes})


@app.route("/admin/usuarios/<string:nome_usuario>/aprovar", methods=["PATCH"])
@admin_obrigatorio
def admin_aprovar_usuario(nome_usuario):
    dados = request.json or {}
    aprovado = bool(dados.get("aprovado"))

    sucesso, mensagem = aprovar_usuario(nome_usuario, aprovado, usuario_atual())
    if not sucesso:
        return resposta_erro(mensagem, 404 if "nao encontrado" in mensagem.lower() else 400)

    pendentes = contar_pendentes()
    return resposta_ok(
        {"mensagem": mensagem, "aprovado": aprovado, "pendentes_aprovacao": pendentes}
    )


@app.route("/admin/usuarios/<string:nome_usuario>/admin", methods=["PATCH"])
@admin_obrigatorio
def admin_fazer_admin(nome_usuario):
    dados = request.json or {}
    eh_admin = bool(dados.get("eh_admin"))

    sucesso, mensagem = fazer_admin(nome_usuario, eh_admin, usuario_atual())
    if not sucesso:
        return resposta_erro(mensagem, 404 if "nao encontrado" in mensagem.lower() else 400)

    return resposta_ok(
        {"mensagem": mensagem, "eh_admin": eh_admin}
    )


@app.route("/admin/usuarios/<string:nome_usuario>/senha", methods=["PATCH"])
@admin_obrigatorio
def admin_alterar_senha(nome_usuario):
    dados = request.json or {}
    senha_nova = (dados.get("senha") or "").strip()

    if not senha_nova:
        return resposta_erro("Senha obrigatoria", 400)

    sucesso, mensagem = alterar_senha(nome_usuario, senha_nova)
    if not sucesso:
        return resposta_erro(mensagem, 404 if "nao encontrado" in mensagem.lower() else 400)

    return resposta_ok({"mensagem": mensagem})


@app.route("/admin/usuarios/<string:nome_usuario>/renomear", methods=["PATCH"])
@admin_obrigatorio
def admin_renomear_usuario(nome_usuario):
    dados = request.json or {}
    nome_novo = (dados.get("nome_novo") or "").strip()

    if not nome_novo:
        return resposta_erro("Novo usuario obrigatorio", 400)

    sucesso, mensagem = renomear_usuario(nome_usuario, nome_novo)
    if not sucesso:
        return resposta_erro(mensagem, 404 if "nao encontrado" in mensagem.lower() else 400)

    return resposta_ok({"mensagem": mensagem, "nome_novo": nome_novo})

# =====================
# DASHBOARD
# =====================
@app.route("/dashboard")
@login_obrigatorio
def dashboard():
    conn = conectar()
    c = conn.cursor()
    colunas = obter_colunas_inventario(c)
    windows_expr = expressao_windows_categoria(colunas)

    c.execute("""
        SELECT
            COALESCE(NULLIF(TRIM(ram), ''), 'Nao informado') AS categoria,
            COUNT(*) AS total
        FROM inventario
        GROUP BY categoria
        ORDER BY total DESC, categoria ASC
    """)
    ram = [{"categoria": r[0], "total": r[1]} for r in c.fetchall()]

    c.execute(f"""
        SELECT
            {expressao_cpu_categoria()} AS categoria,
            COUNT(*) AS total
        FROM inventario
        GROUP BY categoria
        ORDER BY total DESC, categoria ASC
    """)
    cpu = [{"categoria": r[0], "total": r[1]} for r in c.fetchall()]

    c.execute(f"""
        SELECT
            {windows_expr} AS categoria,
            COUNT(*) AS total
        FROM inventario
        GROUP BY categoria
        ORDER BY total DESC, categoria ASC
    """)
    windows = [{"categoria": r[0], "total": r[1]} for r in c.fetchall()]

    c.execute("SELECT COUNT(*) FROM inventario")
    total_maquinas = c.fetchone()[0]

    conn.close()

    return resposta_ok(
        {
            "ram": ram,
            "cpu": cpu,
            "windows": windows,
            "totais": {"maquinas": total_maquinas},
        }
    )


@app.route("/dashboard/filtrar_multiplos", methods=["POST"])
@login_obrigatorio
def dashboard_filtrar_multiplos():
    dados = request.json or {}
    filtros = {
        "ram": lista_strings_unicas(dados.get("ram")),
        "cpu": lista_strings_unicas(dados.get("cpu")),
        "windows": lista_strings_unicas(dados.get("windows")),
    }
    mostrar_todos = bool(dados.get("mostrar_todos"))

    conn = conectar()
    c = conn.cursor()
    colunas = obter_colunas_inventario(c)
    windows_expr = expressao_windows_categoria(colunas)

    where = []
    params = []

    if not mostrar_todos:
        if filtros["ram"]:
            where.append(
                f"COALESCE(NULLIF(TRIM(ram), ''), 'Nao informado') IN ({placeholders_sql(len(filtros['ram']))})"
            )
            params.extend(filtros["ram"])

        if filtros["cpu"]:
            where.append(
                f"{expressao_cpu_categoria()} IN ({placeholders_sql(len(filtros['cpu']))})"
            )
            params.extend(filtros["cpu"])

        if filtros["windows"]:
            where.append(
                f"{windows_expr} IN ({placeholders_sql(len(filtros['windows']))})"
            )
            params.extend(filtros["windows"])

    sql = "SELECT * FROM inventario"
    if where:
        sql += " WHERE " + " AND ".join(where)
    sql += " ORDER BY computador ASC"

    c.execute(sql, tuple(params))
    maquinas = [linha_para_dict(colunas, linha) for linha in c.fetchall()]
    conn.close()

    return resposta_ok(
        {
            "filtro": "Todos os computadores" if mostrar_todos else filtro_descricao(filtros),
            "filtros": filtros,
            "mostrar_todos": mostrar_todos,
            "total": len(maquinas),
            "maquinas": maquinas,
        }
    )


@app.route("/dashboard/filtrar", methods=["POST"])
@login_obrigatorio
def dashboard_filtrar():
    dados = request.json or {}
    tipo = (dados.get("tipo") or "").lower()
    categoria = (dados.get("categoria") or "").strip()

    if tipo not in ["ram", "cpu"] or not categoria:
        return resposta_erro("Filtro invalido", 400)

    conn = conectar()
    c = conn.cursor()
    colunas = obter_colunas_inventario(c)

    if tipo == "ram":
        c.execute("""
            SELECT * FROM inventario
            WHERE COALESCE(NULLIF(TRIM(ram), ''), 'Nao informado') = ?
            ORDER BY computador ASC
        """, (categoria,))
    else:
        c.execute(f"""
            SELECT * FROM inventario
            WHERE {expressao_cpu_categoria()} = ?
            ORDER BY computador ASC
        """, (categoria,))

    resultados = [linha_para_dict(colunas, linha) for linha in c.fetchall()]
    conn.close()

    return resposta_ok(
        {
            "tipo": tipo,
            "categoria": categoria,
            "total": len(resultados),
            "maquinas": resultados,
        }
    )


@app.route("/dashboard/listar_todos")
@login_obrigatorio
def dashboard_listar_todos():
    conn = conectar()
    c = conn.cursor()
    colunas = obter_colunas_inventario(c)

    c.execute("SELECT * FROM inventario ORDER BY computador ASC")
    maquinas = [linha_para_dict(colunas, linha) for linha in c.fetchall()]

    conn.close()
    return resposta_ok({"total": len(maquinas), "maquinas": maquinas})


@app.route("/computadores/<string:nome_computador>")
@login_obrigatorio
def computador_detalhe(nome_computador):
    nome = (nome_computador or "").strip()
    if not nome:
        return resposta_erro("Computador invalido", 400)

    conn = conectar()
    c = conn.cursor()
    colunas = obter_colunas_inventario(c)

    c.execute(
        """
        SELECT * FROM inventario
        WHERE LOWER(COALESCE(computador, '')) = LOWER(?)
        ORDER BY id DESC
        LIMIT 1
        """,
        (nome,),
    )
    linha = c.fetchone()

    if not linha:
        conn.close()
        return resposta_erro("Computador nao encontrado", 404)

    registro = linha_para_dict(colunas, linha)
    historico = historico_por_computadores(c, [registro.get("computador")]).get(
        registro.get("computador"), []
    )

    conn.close()
    return resposta_ok({"registro": registro, "historico": historico})

# =====================
# BUSCA NOTEBOOKS
# =====================
@app.route("/buscar", methods=["POST"])
@login_obrigatorio
def buscar():
    termo = ((request.json or {}).get("termo") or "").strip()
    if not termo:
        return resposta_erro("Termo de busca obrigatorio", 400)
    if len(termo) > 100:
        return resposta_erro("Termo de busca muito longo", 400)

    conn = conectar()
    c = conn.cursor()
    colunas = obter_colunas_inventario(c)

    c.execute("""
        SELECT * FROM inventario 
        WHERE usuario LIKE ?
        OR computador LIKE ?
        OR serial LIKE ?
        OR ip LIKE ?
    """, (f"%{termo}%", f"%{termo}%", f"%{termo}%", f"%{termo}%"))

    resultados = c.fetchall()
    dados = []

    computadores = []
    for linha in resultados:
        registro = linha_para_dict(colunas, linha)
        computador = registro.get("computador")
        if computador:
            computadores.append(computador)
        dados.append({"registro": registro, "historico": []})

    historico_por_computador = historico_por_computadores(c, computadores)

    for item in dados:
        comp = item["registro"].get("computador")
        item["historico"] = historico_por_computador.get(comp, [])

    conn.close()
    return resposta_ok({"total": len(dados), "resultados": dados})

# =====================
# RELATÓRIOS
# =====================
@app.route("/salvar_relatorio", methods=["POST"])
@login_obrigatorio
def salvar_relatorio():
    dados = request.json or {}
    titulo = (dados.get("titulo") or "").strip()
    conteudo = (dados.get("conteudo") or "").strip()

    if not titulo or not conteudo:
        return resposta_erro("Titulo e conteudo sao obrigatorios", 400)
    if len(titulo) > 120:
        return resposta_erro("Titulo muito longo", 400)
    if len(conteudo) > 5000:
        return resposta_erro("Conteudo muito longo", 400)

    conn = conectar()
    c = conn.cursor()

    c.execute("""
        INSERT INTO relatorios (usuario, titulo, conteudo, data)
        VALUES (?, ?, ?, ?)
    """, (
        usuario_atual(),
        titulo,
        conteudo,
        datetime.now().strftime("%d/%m/%Y %H:%M")
    ))

    relatorio_id = c.lastrowid
    conn.commit()
    conn.close()

    return resposta_ok({"id": relatorio_id}, 201)

@app.route("/listar_relatorios")
@login_obrigatorio
def listar_relatorios():
    conn = conectar()
    c = conn.cursor()

    c.execute("SELECT id, usuario, titulo, conteudo, data FROM relatorios ORDER BY id DESC")
    dados = [
        {
            "id": row["id"],
            "usuario": row["usuario"],
            "titulo": row["titulo"],
            "conteudo": row["conteudo"],
            "data": row["data"],
        }
        for row in c.fetchall()
    ]

    conn.close()
    return resposta_ok({"relatorios": dados})


@app.route("/deletar_relatorio/<int:relatorio_id>", methods=["DELETE"])
@login_obrigatorio
def deletar_relatorio(relatorio_id):
    dados = request.json or {}
    senha = (dados.get("senha") or "").strip()

    SENHA_DELETE = "123"
    if senha != SENHA_DELETE:
        return resposta_erro("Senha incorreta", 403)

    conn = conectar()
    c = conn.cursor()

    c.execute("SELECT id FROM relatorios WHERE id = ?", (relatorio_id,))
    if not c.fetchone():
        conn.close()
        return resposta_erro("Relatorio nao encontrado", 404)

    c.execute("DELETE FROM relatorios WHERE id = ?", (relatorio_id,))
    conn.commit()
    conn.close()

    return resposta_ok({"mensagem": "Relatorio deletado com sucesso"})


@app.route("/exportar_relatorios.csv")
@login_obrigatorio
def exportar_relatorios_csv():
    conn = conectar()
    c = conn.cursor()

    c.execute("SELECT id, usuario, titulo, conteudo, data FROM relatorios ORDER BY id DESC")
    linhas = c.fetchall()
    conn.close()

    header = "id,usuario,titulo,conteudo,data"
    corpo = [header]
    for row in linhas:
        corpo.append(
            ",".join(
                [
                    csv_escape(row["id"]),
                    csv_escape(row["usuario"]),
                    csv_escape(row["titulo"]),
                    csv_escape(row["conteudo"]),
                    csv_escape(row["data"]),
                ]
            )
        )

    csv_texto = "\n".join(corpo)
    return Response(
        csv_texto,
        mimetype="text/csv",
        headers={"Content-Disposition": "attachment; filename=relatorios.csv"},
    )


@app.route("/health")
def health():
    return resposta_ok({"status": "healthy"})


@app.errorhandler(404)
def not_found(_error):
    return resposta_erro("Rota nao encontrada", 404)


@app.errorhandler(500)
def internal_error(error):
    app.logger.exception("Erro interno nao tratado: %s", error)
    return resposta_erro("Erro interno no servidor", 500)

# =====================
if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    inicializar_banco()
    host = os.getenv("FLASK_HOST", "127.0.0.1")
    port = int(os.getenv("FLASK_PORT", "5000"))
    debug = os.getenv("FLASK_DEBUG", "0") == "1"
    app.run(host=host, port=port, debug=debug)