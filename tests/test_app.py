import json
import os
import sqlite3

import pytest

from backend.app import app


@pytest.fixture
def client(tmp_path, monkeypatch):
    db_path = tmp_path / "test_inventario.db"
    users_file = tmp_path / "users.json"

    # Configurar arquivo de usuários usando monkeypatch para sobrescrever a função
    monkeypatch.setenv("USERS_FILE", str(users_file))
    
    # Recarregar módulo após configurar variável de ambiente
    import importlib
    from backend import users_manager
    importlib.reload(users_manager)

    conn = sqlite3.connect(db_path)
    c = conn.cursor()

    c.execute(
        """
        CREATE TABLE inventario (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            usuario TEXT,
            computador TEXT,
            serial TEXT,
            ip TEXT,
            ram TEXT,
            cpu TEXT
        )
        """
    )

    c.execute(
        """
        CREATE TABLE inventario_historico (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            computador TEXT,
            data TEXT,
            mudanca TEXT
        )
        """
    )

    c.execute(
        """
        INSERT INTO inventario (usuario, computador, serial, ip, ram, cpu)
        VALUES
            ('Maria', 'PC-001', 'SN001', '10.0.0.1', '8GB', 'Intel i5'),
            ('Joao', 'PC-002', 'SN002', '10.0.0.2', '16GB', 'Ryzen 5')
        """
    )

    c.execute(
        """
        INSERT INTO inventario_historico (computador, data, mudanca)
        VALUES
            ('PC-001', '01/01/2026 10:00', 'Troca de RAM'),
            ('PC-001', '02/01/2026 09:00', 'Atualizacao de BIOS')
        """
    )

    conn.commit()
    conn.close()

    app.config.update(
        TESTING=True,
        DATABASE_PATH=str(db_path),
        SECRET_KEY="test-secret",
        DB_INITIALIZED=False,
    )

    with app.test_client() as test_client:
        yield test_client


def login(client):
    response = client.post("/login", json={"usuario": "admin", "senha": "admin123"})
    assert response.status_code == 200


def test_login_and_session(client):
    response = client.post("/login", json={"usuario": "admin", "senha": "admin123"})
    assert response.status_code == 200
    payload = response.get_json()
    assert payload["ok"] is True
    assert payload["data"]["usuario"] == "admin"
    assert payload["data"]["is_admin"] is True

    response = client.get("/session")
    assert response.status_code == 200


def test_registro_pendente_e_aprovacao_admin(client):
    register_response = client.post(
        "/registrar",
        json={"usuario": "colaborador", "senha": "123456"},
    )
    assert register_response.status_code == 201

    pending_login = client.post(
        "/login",
        json={"usuario": "colaborador", "senha": "123456"},
    )
    assert pending_login.status_code == 403

    login(client)

    list_response = client.get("/admin/usuarios")
    assert list_response.status_code == 200
    payload = list_response.get_json()
    assert payload["ok"] is True
    usuario = next((u for u in payload["data"]["usuarios"] if u["usuario"] == "colaborador"), None)
    assert usuario is not None
    assert usuario["aprovado"] is False

    approve_response = client.patch(
        f"/admin/usuarios/{usuario['usuario']}/aprovar",
        json={"aprovado": True},
    )
    assert approve_response.status_code == 200

    client.post("/logout", json={})

    approved_login = client.post(
        "/login",
        json={"usuario": "colaborador", "senha": "123456"},
    )
    assert approved_login.status_code == 200


def test_dashboard_requires_auth(client):
    response = client.get("/dashboard")
    assert response.status_code == 401


def test_dashboard_and_filter(client):
    login(client)

    response = client.get("/dashboard")
    assert response.status_code == 200
    payload = response.get_json()
    assert payload["ok"] is True
    assert payload["data"]["totais"]["maquinas"] == 2

    response = client.post("/dashboard/filtrar", json={"tipo": "ram", "categoria": "8GB"})
    assert response.status_code == 200
    payload = response.get_json()
    assert payload["data"]["total"] == 1


def test_dashboard_filtro_multiplos_and(client):
    login(client)

    response = client.post(
        "/dashboard/filtrar_multiplos",
        json={"ram": ["8GB"], "cpu": ["i5"], "windows": [], "mostrar_todos": False},
    )
    assert response.status_code == 200
    payload = response.get_json()
    assert payload["ok"] is True
    assert payload["data"]["total"] == 1
    assert payload["data"]["maquinas"][0]["computador"] == "PC-001"

    response = client.post(
        "/dashboard/filtrar_multiplos",
        json={"ram": ["8GB"], "cpu": ["Ryzen 5"], "windows": [], "mostrar_todos": False},
    )
    assert response.status_code == 200
    payload = response.get_json()
    assert payload["ok"] is True
    assert payload["data"]["total"] == 0


def test_dashboard_filtro_multiplos_mostrar_todos(client):
    login(client)

    response = client.post(
        "/dashboard/filtrar_multiplos",
        json={"ram": ["8GB"], "cpu": ["i5"], "windows": ["Windows 11"], "mostrar_todos": True},
    )
    assert response.status_code == 200
    payload = response.get_json()
    assert payload["ok"] is True
    assert payload["data"]["mostrar_todos"] is True
    assert payload["data"]["total"] == 2


def test_dashboard_listar_todos(client):
    login(client)

    response = client.get("/dashboard/listar_todos")
    assert response.status_code == 200
    payload = response.get_json()
    assert payload["ok"] is True
    assert payload["data"]["total"] == 2
    assert payload["data"]["maquinas"][0]["computador"] == "PC-001"


def test_computador_detalhe_com_historico(client):
    login(client)

    response = client.get("/computadores/PC-001")
    assert response.status_code == 200
    payload = response.get_json()
    assert payload["ok"] is True
    assert payload["data"]["registro"]["computador"] == "PC-001"
    assert len(payload["data"]["historico"]) == 2


def test_computador_detalhe_nao_encontrado(client):
    login(client)

    response = client.get("/computadores/PC-999")
    assert response.status_code == 404
    payload = response.get_json()
    assert payload["ok"] is False


def test_busca_com_historico(client):
    login(client)

    response = client.post("/buscar", json={"termo": "PC-001"})
    assert response.status_code == 200
    payload = response.get_json()
    assert payload["ok"] is True
    assert payload["data"]["total"] == 1
    assert len(payload["data"]["resultados"][0]["historico"]) == 2


def test_relatorios_flow_and_csv_export(client):
    login(client)

    save_response = client.post(
        "/salvar_relatorio",
        json={"titulo": "Falha de rede", "conteudo": "Reset no switch da sala."},
    )
    assert save_response.status_code == 201

    list_response = client.get("/listar_relatorios")
    assert list_response.status_code == 200
    payload = list_response.get_json()
    assert payload["ok"] is True
    assert payload["data"]["relatorios"][0]["titulo"] == "Falha de rede"

    export_response = client.get("/exportar_relatorios.csv")
    assert export_response.status_code == 200
    assert "text/csv" in export_response.content_type
    assert "Falha de rede" in export_response.get_data(as_text=True)


def test_deletar_relatorio(client):
    login(client)

    save_response = client.post(
        "/salvar_relatorio",
        json={"titulo": "Relatorio a deletar", "conteudo": "Conteudo teste."},
    )
    assert save_response.status_code == 201
    relatorio_id = save_response.get_json()["data"]["id"]

    # Test wrong password
    delete_response = client.delete(
        f"/deletar_relatorio/{relatorio_id}",
        json={"senha": "wrongpass"},
    )
    assert delete_response.status_code == 403

    # Test correct password
    delete_response = client.delete(
        f"/deletar_relatorio/{relatorio_id}",
        json={"senha": "123"},
    )
    assert delete_response.status_code == 200
    payload = delete_response.get_json()
    assert payload["ok"] is True

    # Verify report is deleted
    list_response = client.get("/listar_relatorios")
    assert list_response.status_code == 200
    payload = list_response.get_json()
    assert len(payload["data"]["relatorios"]) == 0


def test_relatorios_migracao_esquema_legado(client):
    conn = sqlite3.connect(app.config["DATABASE_PATH"])
    c = conn.cursor()

    c.execute("DROP TABLE IF EXISTS relatorios")
    c.execute(
        """
        CREATE TABLE relatorios (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            titulo TEXT,
            conteudo TEXT,
            data TEXT
        )
        """
    )
    c.execute(
        """
        INSERT INTO relatorios (titulo, conteudo, data)
        VALUES ('Legado', 'Registro antigo', '01/01/2026 10:00')
        """
    )

    conn.commit()
    conn.close()

    app.config["DB_INITIALIZED"] = False

    login(client)

    list_response = client.get("/listar_relatorios")
    assert list_response.status_code == 200
    payload = list_response.get_json()
    assert payload["ok"] is True
    assert payload["data"]["relatorios"][0]["titulo"] == "Legado"
    assert payload["data"]["relatorios"][0]["usuario"] is None

    save_response = client.post(
        "/salvar_relatorio",
        json={"titulo": "Novo", "conteudo": "Apos migracao"},
    )
    assert save_response.status_code == 201

