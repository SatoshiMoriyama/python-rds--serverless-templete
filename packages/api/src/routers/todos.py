from datetime import UTC, datetime
from uuid import UUID

from db.database import get_session
from db.models.todo import Todo
from fastapi import APIRouter, Depends, HTTPException, Query, Response
from pydantic import BaseModel, Field
from sqlalchemy.exc import IntegrityError
from sqlmodel import Session, select

router = APIRouter()


class TodoCreate(BaseModel):
    title: str = Field(..., max_length=255, description="タイトル")

    model_config = {"json_schema_extra": {"examples": [{"title": "牛乳を買う"}]}}


class TodoUpdate(BaseModel):
    title: str | None = Field(default=None, max_length=255, description="タイトル")
    completed: bool | None = Field(default=None, description="完了フラグ")


class TodoResponse(BaseModel):
    id: UUID
    title: str
    completed: bool
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


@router.get("/todos", response_model=list[TodoResponse])
def list_todos(
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    session: Session = Depends(get_session),
):
    """Todo一覧を取得"""
    todos = session.exec(select(Todo).offset(skip).limit(limit)).all()
    return todos


@router.post("/todos", response_model=TodoResponse, status_code=201)
def create_todo(
    data: TodoCreate,
    session: Session = Depends(get_session),
):
    """Todoを作成"""
    todo = Todo(title=data.title)
    session.add(todo)
    try:
        session.commit()
        session.refresh(todo)
    except IntegrityError as e:
        session.rollback()
        raise HTTPException(status_code=400, detail=str(e.orig)) from e
    return todo


@router.get("/todos/{todo_id}", response_model=TodoResponse)
def get_todo(todo_id: UUID, session: Session = Depends(get_session)):
    """Todoを取得"""
    todo = session.get(Todo, todo_id)
    if not todo:
        raise HTTPException(status_code=404, detail="Todo not found")
    return todo


@router.patch("/todos/{todo_id}", response_model=TodoResponse)
def update_todo(
    todo_id: UUID,
    data: TodoUpdate,
    session: Session = Depends(get_session),
):
    """Todoを更新"""
    todo = session.get(Todo, todo_id)
    if not todo:
        raise HTTPException(status_code=404, detail="Todo not found")

    for key, value in data.model_dump(exclude_unset=True).items():
        setattr(todo, key, value)
    todo.updated_at = datetime.now(UTC)

    try:
        session.add(todo)
        session.commit()
        session.refresh(todo)
    except IntegrityError as e:
        session.rollback()
        raise HTTPException(status_code=400, detail=str(e.orig)) from e
    return todo


@router.delete("/todos/{todo_id}", status_code=204)
def delete_todo(todo_id: UUID, session: Session = Depends(get_session)):
    """Todoを削除"""
    todo = session.get(Todo, todo_id)
    if not todo:
        raise HTTPException(status_code=404, detail="Todo not found")
    session.delete(todo)
    session.commit()
    return Response(status_code=204)
