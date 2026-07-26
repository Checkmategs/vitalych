from __future__ import annotations
import os
import unittest
from sqlalchemy import text
from src.db import get_engine

class DbConnectTest(unittest.TestCase):
    def test_select_one(self) -> None:
        engine = get_engine()
        with engine.connect() as conn:
            self.assertEqual(conn.execute(text("SELECT 1")).scalar_one(), 1)

if __name__ == "__main__":
    unittest.main()
