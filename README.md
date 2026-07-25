# Vitalych — шаблоны ТЗ и ПЗ по ГОСТ

MVP генерации техдокументации: проекты в PostgreSQL → Markdown / DOCX (ТЗ / ПЗ).

## Быстрый старт (локально)

```bash
cp .env.example .env   # при необходимости смените пароль и DATABASE_URL

docker compose up -d
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
alembic upgrade head
python scripts/seed_from_files.py   # no-op, если проекты уже есть

# API + UI (dev)
uvicorn api.main:app --reload --port 8010
# в другом терминале:
cd web && npm install && npm run dev
```

Откройте http://localhost:5173. Данные проектов хранятся в Postgres, не в `data/project.yaml`.

### CLI

Файл YAML (как раньше):

```bash
python -m src.render --template all --data data/project.example.yaml --out out/ --format both
```

Или проект из БД:

```bash
python -m src.render --project default --out out/default/ --format both
# либо:
python -m src.render --project-id <uuid> --out out/...
```

Флаги: `--template tz|pz|all`, `--format md|docx|both`, `--style-profile`, `--templates-dir`.  
`--data` / `--project` / `--project-id` — взаимно исключающие источники.

Оформление `.docx` — [`style-profile.yaml`](style-profile.yaml) (A4, Times New Roman 12 pt, …).

Проверка:

```bash
python -m unittest discover -s tests -v
```

## React-редактор

Трёхпанельный UI + выбор проекта / версии: оглавление | шаблон с чипами `{{ }}` | переменные.

Кнопка «Сгенерировать» сохраняет проект в БД и пишет `out/{slug}/`.

### Откат к Streamlit MVP

Тег **`streamlit-mvp`** — чекпоинт до React UI:

```bash
git checkout streamlit-mvp
# или:
git switch -c restore-streamlit streamlit-mvp
```

## UI заполнения переменных (Streamlit, fallback)

Файловый режим (без Postgres UI):

```bash
source .venv/bin/activate
pip install -r requirements.txt
streamlit run ui/app.py --server.headless false
```

Обычно http://localhost:8501 — правки в `data/project.yaml`, генерация в `out/`.

## Production (LAN: 10.91.0.142)

Один процесс FastAPI отдаёт API и собранный UI (`web/dist`) на порту **8080**.  
Авторизация на LAN **пока отсутствует** — сервис открыт всем, кто достучится до порта.

### Один раз на сервере

После первой синхронизации (или вручную):

```bash
cd ~/vitalych   # или /opt/vitalych
cp .env.example .env
# задайте сильный POSTGRES_PASSWORD и тот же пароль в DATABASE_URL
# не коммитьте реальные пароли
```

`docker-compose.yml` сейчас использует те же дефолты, что `.env.example` (`vitalych`/`vitalych`).  
Если меняете пароль в `.env`, синхронизируйте учётные данные Postgres в compose (или держите дефолты только в доверенной LAN).

### Деплой с рабочей машины

```bash
chmod +x scripts/deploy.sh
./scripts/deploy.sh
# или:
./scripts/deploy.sh nineone@10.91.0.142
```

Скрипт: сборка UI → rsync (`.env` на сервере **не** перезаписывается) → `docker compose up -d` → venv/pip → `alembic upgrade head` → `seed_from_files` → restart systemd (`EnvironmentFile=…/.env`).

После деплоя: http://10.91.0.142:8080/  
Health: http://10.91.0.142:8080/api/health  
Projects: http://10.91.0.142:8080/api/projects

На сервере:

```bash
# user-сервис (без sudo) — EnvironmentFile=-%h/vitalych/.env
systemctl --user status vitalych
systemctl --user restart vitalych

# root-unit (/opt/vitalych):
sudo systemctl status vitalych
sudo systemctl restart vitalych
```
