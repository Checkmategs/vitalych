# Vitalych

Генератор техдокументации: шаблоны **ТЗ** и **ПЗ** по ГОСТ.

Проекты и версии хранятся в PostgreSQL. Редактор собирает Markdown / DOCX из шаблонов с переменными `{{ }}`.

## Что умеет

- Трёхпанельный React-редактор: оглавление · шаблон · переменные
- Проекты и версии в Postgres (создание, переименование, мягкое удаление)
- Генерация в Markdown и DOCX (оформление через `style-profile.yaml`)
- API на FastAPI + UI в одном приложении

## Стек

- **Backend:** Python, FastAPI, SQLAlchemy, Alembic, PostgreSQL
- **Frontend:** React (Vite)
- **Документы:** Markdown → DOCX

`ui/` (Streamlit) — legacy-редактор YAML на диске; актуальный путь — React `web/` + API + Postgres.
