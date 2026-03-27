import os
import sqlite3

BASE_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
DEFAULT_DATABASE_PATH = os.path.join(BASE_DIR, "inventario.db")


def init_db(db_path: str) -> None:
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()

    cursor.execute(
        """
        CREATE TABLE IF NOT EXISTS inventario (
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

    cursor.execute(
        """
        CREATE TABLE IF NOT EXISTS inventario_historico (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            computador TEXT,
            data TEXT,
            mudanca TEXT
        )
        """
    )

    cursor.execute(
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

    conn.commit()
    conn.close()


if __name__ == "__main__":
    path = os.getenv("DATABASE_PATH", DEFAULT_DATABASE_PATH)
    init_db(path)
    print(f"Banco inicializado em: {path}")
