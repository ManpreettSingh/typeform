from typing import Any

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.db import get_db
from app.models import Workspace
from app.schemas.workspace import WorkspaceCreate, WorkspaceOut, WorkspaceUpdate

router = APIRouter(prefix="/workspaces", tags=["workspaces"])


@router.get("", response_model=list[WorkspaceOut])
def list_workspaces(db: Session = Depends(get_db)) -> Any:
    return db.scalars(select(Workspace).order_by(Workspace.id)).all()


@router.post("", response_model=WorkspaceOut, status_code=201)
def create_workspace(workspace_in: WorkspaceCreate, db: Session = Depends(get_db)) -> Any:
    workspace = Workspace(**workspace_in.model_dump())
    db.add(workspace)
    db.commit()
    db.refresh(workspace)
    return workspace


@router.patch("/{workspace_id}", response_model=WorkspaceOut)
def update_workspace(workspace_id: int, workspace_in: WorkspaceUpdate, db: Session = Depends(get_db)) -> Any:
    workspace = db.get(Workspace, workspace_id)
    if not workspace:
        raise HTTPException(status_code=404, detail="Workspace not found")

    for key, value in workspace_in.model_dump(exclude_unset=True).items():
        setattr(workspace, key, value)
        
    db.commit()
    db.refresh(workspace)
    return workspace


@router.delete("/{workspace_id}", status_code=204)
def delete_workspace(workspace_id: int, db: Session = Depends(get_db)) -> None:
    workspace = db.get(Workspace, workspace_id)
    if not workspace:
        raise HTTPException(status_code=404, detail="Workspace not found")
        
    db.delete(workspace)
    db.commit()
