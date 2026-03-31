import json
import os
from datetime import datetime
from pathlib import Path

from werkzeug.security import check_password_hash, generate_password_hash

# Arquivo de usuários não é commitado (vai no .gitignore)
def _get_users_file():
    """Retorna o caminho do arquivo de usuários (permite sobrescrever em testes)"""
    custom_path = os.getenv("USERS_FILE")
    if custom_path:
        return custom_path
    return os.path.join(os.path.dirname(__file__), "..", "users.json")


# Para compatibilidade com imports que esperam USERS_FILE
USERS_FILE = _get_users_file()


def gerar_hash_senha(senha):
    """Gera hash de senha com pbkdf2:sha256"""
    return generate_password_hash(senha, method="pbkdf2:sha256:60000", salt_length=16)


def timestamp_atual():
    """Retorna timestamp no formato dd/mm/yyyy HH:MM"""
    return datetime.now().strftime("%d/%m/%Y %H:%M")


def carregar_usuarios():
    """Carrega usuários do arquivo JSON"""
    users_file = _get_users_file()
    if not os.path.exists(users_file):
        return {}
    try:
        with open(users_file, "r", encoding="utf-8") as f:
            dados = json.load(f)
        return dados if isinstance(dados, dict) else {}
    except (json.JSONDecodeError, IOError):
        return {}


def salvar_usuarios(usuarios):
    """Salva usuários no arquivo JSON"""
    users_file = _get_users_file()
    os.makedirs(os.path.dirname(users_file), exist_ok=True)
    with open(users_file, "w", encoding="utf-8") as f:
        json.dump(usuarios, f, ensure_ascii=False, indent=2)


def usuario_existe(nome_usuario):
    """Verifica se usuário existe (case-insensitive)"""
    usuarios = carregar_usuarios()
    nome_lower = nome_usuario.lower()
    return any(u.lower() == nome_lower for u in usuarios.keys())


def obter_usuario(nome_usuario):
    """Obtém dados do usuário (case-insensitive)"""
    usuarios = carregar_usuarios()
    nome_lower = nome_usuario.lower()
    for chave, dados in usuarios.items():
        if chave.lower() == nome_lower:
            return {"usuario": chave, **dados}
    return None


def registrar_usuario(nome_usuario, senha):
    """Registra novo usuário com aprovação pendente"""
    usuarios = carregar_usuarios()

    # Verifica se usuário já existe
    if usuario_existe(nome_usuario):
        return False, "Usuario ja cadastrado"

    # Cria novo usuário em estado pendente
    usuarios[nome_usuario] = {
        "senha_hash": gerar_hash_senha(senha),
        "aprovado": False,
        "is_admin": False,
        "data_cadastro": timestamp_atual(),
        "aprovado_em": None,
        "aprovado_por": None,
    }

    salvar_usuarios(usuarios)
    return True, "Registro concluido, aguarde um Administrador aprovar seu acesso."


def validar_login(nome_usuario, senha):
    """
    Valida login do usuário.
    Retorna: (sucesso, mensagem, dados_usuario ou None)
    """
    usuario = obter_usuario(nome_usuario)

    if not usuario or not check_password_hash(usuario["senha_hash"], senha):
        return False, "Usuario ou senha invalidos", None

    if not usuario.get("aprovado", False):
        return False, "Registro concluido, aguarde um Administrador aprovar seu acesso.", None

    return True, "Login valido", usuario


def contar_pendentes():
    """Conta usuários pendentes de aprovação (não admin)"""
    usuarios = carregar_usuarios()
    return sum(1 for u in usuarios.values() if not u.get("aprovado", False) and not u.get("is_admin", False))


def listar_usuarios():
    """Lista todos os usuários para gestão administrativa"""
    usuarios = carregar_usuarios()
    lista = []

    for nome, dados in usuarios.items():
        lista.append({
            "usuario": nome,
            "aprovado": dados.get("aprovado", False),
            "is_admin": dados.get("is_admin", False),
            "data_cadastro": dados.get("data_cadastro"),
            "aprovado_em": dados.get("aprovado_em"),
            "aprovado_por": dados.get("aprovado_por"),
        })

    # Ordena: pendentes primeiro, depois não-admin, depois por nome
    lista.sort(key=lambda x: (x["aprovado"], x["is_admin"], x["usuario"].lower()))
    return lista


def aprovar_usuario(nome_usuario, aprovado, admin_que_aprovou):
    """Aprova ou rejeita acesso do usuário"""
    usuarios = carregar_usuarios()

    # Busca usuário (case-insensitive)
    chave_exata = None
    for chave in usuarios.keys():
        if chave.lower() == nome_usuario.lower():
            chave_exata = chave
            break

    if not chave_exata:
        return False, "Usuario nao encontrado"

    usuario = usuarios[chave_exata]

    # Não permite alterar admin
    if usuario.get("is_admin", False):
        return False, "Nao e permitido alterar usuario administrador"

    if aprovado:
        usuario["aprovado"] = True
        usuario["aprovado_em"] = timestamp_atual()
        usuario["aprovado_por"] = admin_que_aprovou
        mensagem = "Acesso aprovado"
    else:
        usuario["aprovado"] = False
        usuario["aprovado_em"] = None
        usuario["aprovado_por"] = None
        mensagem = "Acesso desativado"

    salvar_usuarios(usuarios)
    return True, mensagem


def fazer_admin(nome_usuario, eh_admin, admin_que_alterou):
    """Promove ou rebaixa um usuário como administrador"""
    usuarios = carregar_usuarios()

    # Busca usuário (case-insensitive)
    chave_exata = None
    for chave in usuarios.keys():
        if chave.lower() == nome_usuario.lower():
            chave_exata = chave
            break

    if not chave_exata:
        return False, "Usuario nao encontrado"

    usuario = usuarios[chave_exata]

    if eh_admin:
        usuario["is_admin"] = True
        if not usuario.get("aprovado"):
            usuario["aprovado"] = True
            usuario["aprovado_em"] = timestamp_atual()
            usuario["aprovado_por"] = admin_que_alterou
        mensagem = f"{chave_exata} promovido a administrador"
    else:
        usuario["is_admin"] = False
        mensagem = f"{chave_exata} rebaixado a usuário comum"

    salvar_usuarios(usuarios)
    return True, mensagem


def alterar_senha(nome_usuario, senha_nova):
    """Altera a senha de um usuário"""
    usuarios = carregar_usuarios()

    # Busca usuário (case-insensitive)
    chave_exata = None
    for chave in usuarios.keys():
        if chave.lower() == nome_usuario.lower():
            chave_exata = chave
            break

    if not chave_exata:
        return False, "Usuario nao encontrado"

    if len(senha_nova) < 3:
        return False, "Senha precisa ter ao menos 3 caracteres"
    if len(senha_nova) > 120:
        return False, "Senha muito longa"

    usuario = usuarios[chave_exata]
    usuario["senha_hash"] = gerar_hash_senha(senha_nova)

    salvar_usuarios(usuarios)
    return True, "Senha alterada com sucesso"


def renomear_usuario(nome_atual, nome_novo):
    """Renomeia um usuário"""
    usuarios = carregar_usuarios()

    # Validações básicas
    if len(nome_novo) < 2:
        return False, "Usuario precisa ter ao menos 2 caracteres"
    if len(nome_novo) > 60:
        return False, "Usuario muito longo"

    # Verifica se novo nome já existe
    if usuario_existe(nome_novo):
        return False, "Usuario ja cadastrado"

    # Busca usuário atual (case-insensitive)
    chave_exata = None
    for chave in usuarios.keys():
        if chave.lower() == nome_atual.lower():
            chave_exata = chave
            break

    if not chave_exata:
        return False, "Usuario nao encontrado"

    # Move os dados para novo nome
    usuario_dados = usuarios.pop(chave_exata)
    usuarios[nome_novo] = usuario_dados

    salvar_usuarios(usuarios)
    return True, f"Usuario {chave_exata} renomeado para {nome_novo}"


def criar_admin(nome_usuario, senha):
    """Cria um usuário administrador (aprovado automaticamente)"""
    usuarios = carregar_usuarios()

    # Se já existe, atualiza para admin
    if usuario_existe(nome_usuario):
        chave_exata = None
        for chave in usuarios.keys():
            if chave.lower() == nome_usuario.lower():
                chave_exata = chave
                break
        
        if chave_exata:
            usuarios[chave_exata]["is_admin"] = True
            usuarios[chave_exata]["aprovado"] = True
            if not usuarios[chave_exata].get("aprovado_em"):
                usuarios[chave_exata]["aprovado_em"] = timestamp_atual()
                usuarios[chave_exata]["aprovado_por"] = "sistema"
            salvar_usuarios(usuarios)
            return True, "Admin criado/atualizado"

    # Novo admin
    usuarios[nome_usuario] = {
        "senha_hash": gerar_hash_senha(senha),
        "aprovado": True,
        "is_admin": True,
        "data_cadastro": timestamp_atual(),
        "aprovado_em": timestamp_atual(),
        "aprovado_por": "sistema",
    }

    salvar_usuarios(usuarios)
    return True, "Admin criado com sucesso"


def setup_admin_inicial(nome_admin=None, senha_admin=None):
    """
    Configura admin inicial se não existir.
    Usa variáveis de ambiente ou parâmetros.
    """
    if nome_admin is None:
        nome_admin = os.getenv("ADMIN_USER", "admin").strip() or "admin"
    if senha_admin is None:
        senha_admin = os.getenv("ADMIN_PASSWORD", "admin123")

    # Verifica se algum admin já existe
    usuarios = carregar_usuarios()
    if any(u.get("is_admin", False) for u in usuarios.values()):
        return False, "Admin ja existe no sistema"

    # Cria admin inicial
    sucesso, msg = criar_admin(nome_admin, senha_admin)
    return sucesso, msg
