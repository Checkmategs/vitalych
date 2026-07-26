"""Unit tests for LocalArtifactStore."""

from __future__ import annotations

import tempfile
import unittest
import uuid
from pathlib import Path

from src.artifacts import LocalArtifactStore


class ArtifactsTest(unittest.TestCase):
    def test_write_and_path(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            store = LocalArtifactStore(Path(tmp))
            ws = uuid.uuid4()
            path = store.write(ws, "demo", "tz.docx", b"PK\x03\x04")
            self.assertTrue(path.is_file())
            self.assertEqual(path, store.path_for(ws, "demo", "tz.docx"))
            self.assertEqual(path.read_bytes(), b"PK\x03\x04")
            self.assertEqual(path.parent, store.dir_for(ws, "demo"))


if __name__ == "__main__":
    unittest.main()
