from sqlmodel import Session, create_engine

try:
    from .config import settings
except ImportError:
    from config import settings

engine = create_engine(settings.database_url, echo=True)


def get_session():
    with Session(engine) as session:
        yield session
