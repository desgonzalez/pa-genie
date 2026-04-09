# backend/db.py

from sqlmodel import SQLModel, create_engine, Session
import models  # Ensure models are loaded so tables can be created

# SQLite DB file name (it will be created in the backend folder)
sqlite_file_name = "pa_genie.db"
sqlite_url = f"sqlite:///{sqlite_file_name}"

# echo=True prints SQL queries in the terminal (useful while developing)
engine = create_engine(sqlite_url, echo=True)


def create_db_and_tables() -> None:
    """
    Create all tables defined on SQLModel models.
    Called once at app startup.
    """
    SQLModel.metadata.create_all(engine)


def get_session():
    """
    FastAPI dependency: gives a new DB session to each request.
    """
    with Session(engine) as session:
        yield session
