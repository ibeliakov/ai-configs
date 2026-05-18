# automation

Node.js/TypeScript утиліти для автоматизації рутинних задач: code review через Claude AI та збір дайджесту зі Slack.

## Встановлення

```bash
npm install
cp .env.example .env
# відкрити .env і заповнити потрібні змінні (див. таблицю нижче)
```

---

## Модулі

### PR Reviewer

Аналізує git diff між двома гілками через Claude API і виводить структурований code review.

```bash
npm run review <project-path> <base-branch> <compare-branch>
```

**Аргументи:**

| # | Аргумент | Опис | Приклад |
|---|----------|------|---------|
| 1 | `project-path` | Абсолютний шлях до кореня проєкту | `/home/user/my-app` |
| 2 | `base-branch` | Базова гілка (куди мержимо) | `main` |
| 3 | `compare-branch` | Гілка для review | `feature/auth` |

**Контекст проєкту:** скрипт автоматично підхоплює `CLAUDE.md` та всі `.md` файли з `.claude/rules/` в директорії проєкту.

**Потребує:** `ANTHROPIC_API_KEY`

---

### Slack Digest Fetch

Забирає повідомлення зі Slack каналів та DM за вказаний період і виводить структурований JSON у stdout. Використовується командою `/slack-digest` з `common/.claude/commands/`.

```bash
npm run slack-digest-fetch [--period <duration>] [--date <date>] [--channels <channels>]
```

**Аргументи (всі опціональні):**

| Аргумент | Опис | Приклад | За замовчуванням |
|----------|------|---------|-----------------|
| `--period` | Вікно від поточного моменту | `24h`, `2d`, `48h` | `24h` |
| `--date` | Конкретна дата (весь день) | `18.05.2026` | — |
| `--channels` | Канали через кому (без `#`). Замінює `SLACK_DEFAULT_CHANNELS`; PM DM виключається | `general,dev-bugs` | з `.env` |

`--date` перекриває `--period`. Якщо нічого не вказано — останні 24 години.

**Потребує:** `SLACK_USER_TOKEN`, `SLACK_WORKSPACE_DOMAIN`

**Повний pipeline** (fetch → AI-аналіз → збереження JSON) запускається через команду `/slack-digest` в Claude Code.

---

## Змінні середовища

| Змінна | Модуль | Обов'язкова | Формат | Де взяти |
|--------|--------|------------|--------|----------|
| `ANTHROPIC_API_KEY` | pr-reviewer | Так | `sk-ant-...` | [console.anthropic.com](https://console.anthropic.com) → API Keys |
| `SLACK_USER_TOKEN` | slack-digest | Так | `xoxp-...` | [api.slack.com](https://api.slack.com) → Your Apps → OAuth & Permissions → User OAuth Token |
| `SLACK_WORKSPACE_DOMAIN` | slack-digest | Так | `mycompany` | Частина URL перед `.slack.com` |
| `SLACK_DEFAULT_CHANNELS` | slack-digest | Так | `ch1,D0123456789` | Назви каналів (без `#`) або Slack channel ID — можна змішувати. DM ID: відкрити DM у браузері → скопіювати з URL після `/archives/` |
| `SLACK_PM_USERNAME` | slack-digest | Ні | `firstname.lastname` | Застарілий спосіб для DM. Краще використовувати DM channel ID в `SLACK_DEFAULT_CHANNELS` |
| `SLACK_TZ_OFFSET` | slack-digest | Ні | `+02:00` | Зміщення часового поясу для `--date`. Дефолт: `+02:00` (Україна) |

### Scopes для `SLACK_USER_TOKEN`

```
channels:history  channels:read
groups:history    groups:read
im:history        im:read
users:read        reactions:read
```
