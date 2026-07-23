# Vitalych web — редактор ТЗ/ПЗ

```bash
# API (из корня репозитория)
uvicorn api.main:app --reload --port 8000

# UI
cd web && npm install && npm run dev
```

Откройте http://localhost:5173 — `/api` проксируется на `http://127.0.0.1:8000`.
