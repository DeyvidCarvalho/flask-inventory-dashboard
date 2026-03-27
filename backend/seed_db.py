import argparse
import os
import sqlite3
from datetime import datetime, timedelta

from init_db import BASE_DIR, DEFAULT_DATABASE_PATH, init_db


DEFAULT_DEMO_DATABASE_PATH = os.path.join(BASE_DIR, "inventario_demo.db")


INVENTARIO_FICTICIO = [
    ("Ana Silva", "NB-RIZZO-001", "SN-A1B2C3", "10.0.0.11", "8GB", "Intel i5"),
    ("Bruno Costa", "NB-RIZZO-002", "SN-D4E5F6", "10.0.0.12", "16GB", "Intel i7"),
    ("Carla Souza", "NB-RIZZO-003", "SN-G7H8I9", "10.0.0.13", "8GB", "Ryzen 5"),
    ("Daniel Lima", "NB-RIZZO-004", "SN-J1K2L3", "10.0.0.14", "32GB", "Ryzen 7"),
    ("Eduarda Alves", "NB-RIZZO-005", "SN-M4N5O6", "10.0.0.15", "16GB", "Intel i5"),
    ("Felipe Rocha", "NB-RIZZO-006", "SN-P7Q8R9", "10.0.0.16", "8GB", "Intel i3"),
    ("Gabriela Nunes", "NB-RIZZO-007", "SN-S1T2U3", "10.0.0.17", "16GB", "Ryzen 5"),
    ("Henrique Melo", "NB-RIZZO-008", "SN-V4W5X6", "10.0.0.18", "32GB", "Intel i9"),
    ("Isabela Freitas", "NB-RIZZO-009", "SN-Y7Z8A9", "10.0.0.19", "16GB", "Intel i7"),
    ("Joao Pedro", "NB-RIZZO-010", "SN-B1C2D3", "10.0.0.20", "8GB", "Ryzen 3"),
]

RELATORIOS_FICTICIOS = [
    (
        "sistema",
        "Padrao inicial de inventario",
        "Base de teste criada para demonstracao no portfolio.",
    ),
    (
        "sistema",
        "Checklist de manutencao",
        "Conferir BIOS, armazenamento e temperatura em cada revisao preventiva.",
    ),
]

MUDANCAS_PADRAO = [
    "Troca de memoria RAM",
    "Atualizacao de BIOS",
    "Substituicao de SSD",
    "Reconfiguracao de rede",
]


def timestamp(days_ago: int, hour: int) -> str:
    dt = datetime.now() - timedelta(days=days_ago)
    dt = dt.replace(hour=hour, minute=0, second=0, microsecond=0)
    return dt.strftime("%d/%m/%Y %H:%M")


def reset_tables(cursor: sqlite3.Cursor) -> None:
    cursor.execute("DELETE FROM inventario_historico")
    cursor.execute("DELETE FROM inventario")
    cursor.execute("DELETE FROM relatorios")


def insert_inventario(cursor: sqlite3.Cursor) -> None:
    cursor.executemany(
        """
        INSERT INTO inventario (usuario, computador, serial, ip, ram, cpu)
        VALUES (?, ?, ?, ?, ?, ?)
        """,
        INVENTARIO_FICTICIO,
    )


def insert_historico(cursor: sqlite3.Cursor) -> None:
    linhas = []
    for idx, (_usuario, computador, _serial, _ip, _ram, _cpu) in enumerate(INVENTARIO_FICTICIO):
        mudanca_a = MUDANCAS_PADRAO[idx % len(MUDANCAS_PADRAO)]
        mudanca_b = MUDANCAS_PADRAO[(idx + 1) % len(MUDANCAS_PADRAO)]
        linhas.append((computador, timestamp(30 - idx, 9), mudanca_a))
        linhas.append((computador, timestamp(10 - (idx % 5), 15), mudanca_b))

    cursor.executemany(
        """
        INSERT INTO inventario_historico (computador, data, mudanca)
        VALUES (?, ?, ?)
        """,
        linhas,
    )


def insert_relatorios(cursor: sqlite3.Cursor) -> None:
    agora = datetime.now().strftime("%d/%m/%Y %H:%M")
    linhas = [(usuario, titulo, conteudo, agora) for usuario, titulo, conteudo in RELATORIOS_FICTICIOS]
    cursor.executemany(
        """
        INSERT INTO relatorios (usuario, titulo, conteudo, data)
        VALUES (?, ?, ?, ?)
        """,
        linhas,
    )


def popular_banco(db_path: str, reset: bool) -> None:
    init_db(db_path)
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()

    if reset:
        reset_tables(cursor)

    insert_inventario(cursor)
    insert_historico(cursor)
    insert_relatorios(cursor)

    conn.commit()
    conn.close()


def main() -> None:
    parser = argparse.ArgumentParser(description="Popula o banco SQLite com dados ficticios.")
    parser.add_argument(
        "--db",
        dest="db_path",
        default=os.getenv("DEMO_DATABASE_PATH", DEFAULT_DEMO_DATABASE_PATH),
    )
    parser.add_argument("--reset", action="store_true", help="Apaga dados atuais antes de popular.")
    parser.add_argument(
        "--allow-main-db",
        action="store_true",
        help="Permite usar explicitamente o inventario.db principal.",
    )
    args = parser.parse_args()

    db_name = os.path.basename(args.db_path).lower()
    if db_name == os.path.basename(DEFAULT_DATABASE_PATH).lower() and not args.allow_main_db:
        raise SystemExit(
            "Operacao bloqueada: para proteger os dados reais, use um banco de demo ou passe --allow-main-db."
        )

    popular_banco(args.db_path, args.reset)
    print(f"Banco ficticio preparado em: {args.db_path}")
    print(f"Maquinas inseridas: {len(INVENTARIO_FICTICIO)}")


if __name__ == "__main__":
    main()
