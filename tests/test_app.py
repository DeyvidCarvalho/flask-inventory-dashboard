import sqlite3

import pytest

from backend.app import app


@pytest.fixture
def client(tmp_path):
    db_path = tmp_path / "test_inventario.db"

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
    response = client.post("/login", json={"usuario": "tester"})
    assert response.status_code == 200


def test_login_and_session(client):
    response = client.post("/login", json={"usuario": "tester"})
    assert response.status_code == 200
    payload = response.get_json()
    assert payload["ok"] is True
    assert payload["data"]["usuario"] == "tester"

    response = client.get("/session")
    assert response.status_code == 200


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

