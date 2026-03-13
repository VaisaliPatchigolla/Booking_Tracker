import sqlite3

DATABASE = "database.db"


def get_db():
    conn = sqlite3.connect(DATABASE)
    conn.row_factory = sqlite3.Row
    return conn


def init_db():
    conn = sqlite3.connect(DATABASE)
    c = conn.cursor()

    c.execute('''
        CREATE TABLE IF NOT EXISTS travels (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            destination TEXT,
            start_date TEXT,
            end_date TEXT,
            from_location TEXT,
            to_location TEXT,
            travel_date TEXT,
            number_of_persons INTEGER,
            person_names TEXT,
            budget REAL DEFAULT 0,
            spent REAL DEFAULT 0,
            notes TEXT,
            status TEXT DEFAULT 'upcoming',
            created_at TEXT,
            updated_at TEXT
        )
    ''')

    conn.commit()
    conn.close()
