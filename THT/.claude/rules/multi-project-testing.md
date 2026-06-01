# Multi-project testing

Правила для запуску QA-команд (`/qa-diff`, `/qa-feature`) з кореневої папки `~/Desktop/THT/`.

---

## MCP сервери

З кореневої папки доступні два MCP сервери (налаштовані в `.mcp.json`):

| Сервер | Пакет | Для чого |
|---|---|---|
| `playwright` | `@playwright/mcp@latest` | Веб-тестування: myAccount, management, applicant, html-reports |
| `mobile-mcp` | `@mobilenext/mobile-mcp@latest` | Нативне мобільне тестування: THT-mobile-app (iOS/Android) |

### Playwright MCP

Використовувати для всіх веб-проектів. Не потребує додаткового налаштування.

### mobile-mcp

Використовувати для тестування `THT-mobile-app` на iOS Simulator або Android Emulator.

Перед запуском тестів через `mobile-mcp`:
1. Запустити Expo: `npx expo start` в директорії `~/Desktop/THT/THT-mobile-app/`
2. Обрати платформу (натиснути `i` для iOS або `a` для Android) — симулятор/емулятор має запуститись
3. Тестування виконується через `mobile-mcp` інструменти, не через Playwright browser

---

## Визначення цільового проекту

Якщо цільовий проект не вказано явно і незрозуміло з контексту — запитати:

> "Який проект тестуємо?"
> 1. THT-myAccount — `localhost:3000`
> 2. THT-management — `localhost:3030`
> 3. THT-applicant — `localhost:3080`
> 4. THT-mobile-app — (Expo)
> 5. THT-html-reports — `localhost:8080`

---

## Git-операції по підпроектам

Оскільки кожен підпроект — окремий git-репозиторій, всі git-команди виконувати з директорії відповідного проекту:

```bash
# Diff для конкретного проекту
git -C ~/Desktop/THT/THT-myAccount diff main..HEAD

# Uncommitted changes
git -C ~/Desktop/THT/THT-management diff HEAD

# Читання CLAUDE.md перед роботою з проектом
cat ~/Desktop/THT/THT-applicant/CLAUDE.md
```

---

## Читання контексту підпроекту

Перед генерацією тест-кейсів або Playwright-коду для конкретного проекту — прочитати:
1. `~/Desktop/THT/<project>/CLAUDE.md` — стек, патерни, конвенції
2. `~/Desktop/THT/<project>/.claude/rules/` — детальні правила (компоненти, роутінг тощо)

Це важливо щоб Playwright-код відповідав архітектурі проекту.

---

## Тест-кейси та звіти

Шляхи беруться з env-змінних (`QA_TESTCASES_DIR`, `QA_REPORTS_DIR`):

```
$QA_TESTCASES_DIR/
  THT-myAccount/
    login-flow.md
    user-profile.md
  THT-management/
    candidate-list.md
  THT-applicant/
    assessment-submission.md

$QA_REPORTS_DIR/
  THT-myAccount/
    login-flow__2026-06-01_14-30/
      report.md
      01-tc001-login-fail.png
```

---

## Тестування кількох проектів за один сеанс

Коли сценарій торкається більше одного проекту (напр. applicant + myAccount):

1. Виконати тести першого проекту повністю → зберегти звіт
2. Переключитись на другий проект — прочитати його CLAUDE.md
3. Виконати тести другого проекту → зберегти звіт
4. У підсумку в чаті вивести результати по обох проектах

Не намагатись запускати тести двох проектів паралельно — Playwright browser instance один.

---

## Порти за замовчуванням (local)

| Проект | URL |
|---|---|
| THT-myAccount | `http://localhost:3000` |
| THT-management | `http://localhost:3030` |
| THT-applicant | `http://localhost:3080` |
| THT-html-reports | `http://localhost:8080` |
| THT-mobile-app | запустити `expo start`, обрати платформу |

---

## Запуск dev-серверів

Перед запуском тестів переконатись що сервер запущено. Команди:

| Проект | Команда | Директорія |
|---|---|---|
| THT-myAccount | `yarn start` | `~/Desktop/THT/THT-myAccount` |
| THT-management | `yarn start` | `~/Desktop/THT/THT-management` |
| THT-applicant | `yarn dev` | `~/Desktop/THT/THT-applicant` |
| THT-html-reports | `node ./server/app.js` | `~/Desktop/THT/THT-html-reports` |
| THT-mobile-app | `npx expo start` | `~/Desktop/THT/THT-mobile-app` |

Якщо URL не відповідає — запитати у користувача чи запущений сервер і на якому порту.
