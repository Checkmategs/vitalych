# Vitalych — шаблоны ТЗ и ПЗ по ГОСТ

MVP генерации техдокументации: общие переменные YAML → Markdown / DOCX (ТЗ / ПЗ).

## Этап A (готово)

- `templates/tz.md.j2` — ТЗ по ГОСТ 34.602-2020 (10 разделов)
- `templates/pz.md.j2` — ПЗ по ГОСТ Р 59795—2021 п. 5.2 (4 раздела)
- `data/project.example.yaml` — единый набор переменных
- Spec: `docs/superpowers/specs/2026-07-23-gost-templates-mvp-design.md`

## Этап B (готово)

CLI: YAML → `out/tz.md` + `out/tz.docx` (и то же для ПЗ).

```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt

python -m src.render --template all --data data/project.example.yaml --out out/ --format both
```

Флаги:

- `--template tz|pz|all` (по умолчанию `all`)
- `--data` — путь к YAML (обязательный)
- `--out` — каталог вывода (по умолчанию `out`)
- `--templates-dir` — каталог шаблонов (по умолчанию `templates`)
- `--format md|docx|both` (по умолчанию `both`)
- `--style-profile` — YAML оформления DOCX (по умолчанию `style-profile.yaml`)

Оформление `.docx` берётся из [`style-profile.yaml`](style-profile.yaml) (поля A4, Times New Roman 12 pt, отступы, заголовки, таблицы, номер страницы).

Свой проект: скопируйте `data/project.example.yaml` → `data/project.yaml`, заполните, затем:

```bash
python -m src.render --data data/project.yaml --out out/
```

Проверка:

```bash
python -m unittest tests.test_render_smoke -v
```

## React-редактор (центр + боковые панели)

Трёхпанельный UI: оглавление ТЗ/ПЗ | Markdown-шаблон с immutable-чипами `{{ }}` | панель переменных.

```bash
# Терминал 1 — API
source .venv/bin/activate
pip install -r requirements.txt
uvicorn api.main:app --reload --port 8010

# Терминал 2 — UI
cd web && npm install && npm run dev
```

Откройте http://localhost:5173. Кнопка «Сгенерировать» сохраняет проект и шаблон, затем пишет `out/`.

### Откат к Streamlit MVP

Тег **`streamlit-mvp`** — чекпоинт до React UI:

```bash
git checkout streamlit-mvp
# или новая ветка от тега:
git switch -c restore-streamlit streamlit-mvp
```

## UI заполнения переменных (Streamlit, fallback)

```bash
source .venv/bin/activate
pip install -r requirements.txt
streamlit run ui/app.py --server.headless false
```

Откроется браузер (обычно http://localhost:8501). В UI можно править секции YAML, сохранить в `data/project.yaml` и сгенерировать ТЗ/ПЗ в `out/` (`.md` и `.docx`).

## Production (LAN: 10.91.0.142)

Один процесс FastAPI отдаёт API и собранный UI (`web/dist`) на порту **8080**.

```bash
# Сборка фронта + rsync + запуск на сервере (по умолчанию nineone@10.91.0.142)
chmod +x scripts/deploy.sh
./scripts/deploy.sh
# или явно:
./scripts/deploy.sh nineone@10.91.0.142
```

После деплоя: http://10.91.0.142:8080/  
Health: http://10.91.0.142:8080/api/health

На сервере:

```bash
# user-сервис (без sudo) — переживает закрытие терминала/SSH
systemctl --user status vitalych
systemctl --user restart vitalych

# если когда-нибудь будет root-unit:
sudo systemctl status vitalych
sudo systemctl restart vitalych
```
