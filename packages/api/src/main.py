from db.database import get_session
from fastapi import Depends, FastAPI
from mangum import Mangum
from sqlmodel import Session, text

from .routers import todos

app = FastAPI(title="API", version="0.1.0")

app.include_router(todos.router, prefix="/api/v1", tags=["todos"])

# Lambda統合用ハンドラー
handler = Mangum(app)


@app.get("/")
def read_root():
    return {"message": "API"}


@app.get("/health")
def health_check(session: Session = Depends(get_session)):
    try:
        session.exec(text("SELECT 1"))
        return {"status": "ok", "database": "connected"}
    except Exception as e:
        return {"status": "error", "database": "disconnected", "error": str(e)}
