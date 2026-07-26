"""Artifact storage for rendered documents (local now, S3-ready later)."""

from __future__ import annotations

import os
import uuid
from pathlib import Path
from typing import Protocol


class ArtifactStore(Protocol):
    def write(
        self,
        workspace_id: uuid.UUID,
        project_slug: str,
        filename: str,
        data: bytes,
    ) -> Path: ...

    def path_for(
        self,
        workspace_id: uuid.UUID,
        project_slug: str,
        filename: str,
    ) -> Path: ...

    def dir_for(self, workspace_id: uuid.UUID, project_slug: str) -> Path: ...


class LocalArtifactStore:
    def __init__(self, root: Path) -> None:
        self.root = root

    def dir_for(self, workspace_id: uuid.UUID, project_slug: str) -> Path:
        return self.root / str(workspace_id) / project_slug

    def path_for(
        self,
        workspace_id: uuid.UUID,
        project_slug: str,
        filename: str,
    ) -> Path:
        name = Path(filename).name
        return self.dir_for(workspace_id, project_slug) / name

    def write(
        self,
        workspace_id: uuid.UUID,
        project_slug: str,
        filename: str,
        data: bytes,
    ) -> Path:
        path = self.path_for(workspace_id, project_slug, filename)
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_bytes(data)
        return path


_DEFAULT_ROOT: Path | None = None


def get_artifact_store(root: Path | None = None) -> LocalArtifactStore:
    global _DEFAULT_ROOT
    if root is not None:
        return LocalArtifactStore(root)
    if _DEFAULT_ROOT is None:
        env = os.environ.get("ARTIFACT_ROOT")
        _DEFAULT_ROOT = Path(env) if env else Path(__file__).resolve().parents[1] / "out"
    return LocalArtifactStore(_DEFAULT_ROOT)
