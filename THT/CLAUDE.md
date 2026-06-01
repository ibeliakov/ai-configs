# CLAUDE.md — THT Umbrella Workspace

Кореневий воркспейс THT-проекту. Звідси можна запускати QA-команди по будь-якому підпроекту та навігувати між ними.

## Project map

| Папка | Роль | Порт (local) | Стек |
|---|---|---|---|
| `THT-myAccount/` | Особистий кабінет клієнта | `localhost:3000` | React 18 + RTK + AntD 4 |
| `THT-management/` | Адмінка / менеджмент (внутрішній інструмент) | `localhost:3030` | React 18 + Redux legacy + AntD 3 |
| `THT-applicant/` | Апліканська частина, SSR | `localhost:3080` | Next.js 13 + Redux legacy + AntD 3 |
| `THT-mobile-app/` | Мобільний застосунок | — (Expo, запуск `expo start`) | React Native 0.81 + Expo 54 + RTK |
| `THT-html-reports/` | Переглядач звітів (статика + Node сервер) | `localhost:8080` | Node.js server |

## Shared directories

| Папка | Призначення |
|---|---|
| `THT-testcases/` | Markdown тест-кейси, git-трековано. Структура: `THT-testcases/<project-name>/<feature>.md` |
| `qa-reports/` | Playwright QA звіти (не в git). Структура: `qa-reports/<project-name>/<feature>__<date>/` |

Env-змінні задані в `.claude/settings.local.json`:
- `QA_TESTCASES_DIR` — абс. шлях до `THT-testcases/`
- `QA_REPORTS_DIR` — абс. шлях до `qa-reports/`
- `AI_CONFIGS_DIR` — шлях до `ai-configs` репо

## Rules

Детальний опис проектів та інструкції по тестуванню:

@.claude/rules/project-map.md
@.claude/rules/multi-project-testing.md

## Commands

- `/qa-diff [гілка або uncommitted]` — тестування за git diff
- `/qa-feature [опис фічі]` — тестування конкретної фічі
- `/commit` — коміт зі стандартним форматом `{task}: {description}`
- `/slack-digest` — дайджест Slack повідомлень

> Перед роботою з кодом конкретного підпроекту — прочитай його `CLAUDE.md` та `.claude/rules/`.
