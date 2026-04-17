import "dotenv/config";
import Anthropic from "@anthropic-ai/sdk";
import { execSync } from "child_process";
import * as fs from "fs";
import * as path from "path";

const [, , projectPath, baseBranch, compareBranch] = process.argv;

if (!projectPath || !baseBranch || !compareBranch) {
  console.error(
    "Usage: tsx src/pr-reviewer/index.ts <project-path> <base-branch> <compare-branch>",
  );
  process.exit(1);
}

function readFileIfExists(filePath: string): string | null {
  try {
    return fs.readFileSync(filePath, "utf-8");
  } catch {
    return null;
  }
}

function buildProjectContext(): string {
  const parts: string[] = [];

  const claudeMd = readFileIfExists(path.join(projectPath, "CLAUDE.md"));
  if (claudeMd) {
    parts.push(`### CLAUDE.md\n${claudeMd}`);
  }

  const rulesDir = path.join(projectPath, ".claude", "rules");
  if (fs.existsSync(rulesDir)) {
    const ruleFiles = fs.readdirSync(rulesDir).filter((f) => f.endsWith(".md"));
    for (const file of ruleFiles) {
      const content = readFileIfExists(path.join(rulesDir, file));
      if (content) {
        parts.push(`### ${file}\n${content}`);
      }
    }
  }

  if (parts.length === 0) {
    console.warn(
      "⚠ Warning: no project context found (CLAUDE.md or .claude/rules/*.md). Continuing without context.",
    );
    return "";
  }

  return parts.join("\n\n");
}

function getDiff(): string {
  try {
    return execSync(`git diff ${baseBranch}...${compareBranch}`, {
      cwd: projectPath,
      encoding: "utf-8",
      maxBuffer: 10 * 1024 * 1024,
    });
  } catch (err) {
    console.error("Failed to get git diff:", err);
    process.exit(1);
  }
}

function saveReview(content: string): void {
  const reviewsDir = path.join(projectPath, ".reviews");
  fs.mkdirSync(reviewsDir, { recursive: true });

  const timestamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  const safeBranch = compareBranch.replace(/\//g, "-");
  const fileName = `review-${safeBranch}-${timestamp}.md`;
  const filePath = path.join(reviewsDir, fileName);

  fs.writeFileSync(filePath, content, "utf-8");
  console.log(`\n📄 Review saved to: ${filePath}`);
}

async function main(): Promise<void> {
  const projectContext = buildProjectContext();

  const diff = getDiff();
  if (!diff.trim()) {
    console.log(`No changes found between ${baseBranch} and ${compareBranch}.`);
    process.exit(0);
  }

  const systemPrompt = `Ти — senior розробник. Виконай code review git diff.

${projectContext ? `Контекст проекту (правила і стек з конфігів):\n${projectContext}\n\nLegacy-зони описані в контексті вище — ігноруй їх повністю.` : ""}

Для кожної знайденої проблеми використовуй точний формат:

**[СТУПІНЬ СЕРЙОЗНОСТІ] Категорія — Коротка назва**
- **Чому це проблема:** реальні наслідки
- **Код:** проблемний фрагмент
- **Виправлення:** виправлена версія з поясненням
- **Компроміс:** недоліки виправлення (якщо є)

В кінці розділ **Підсумок**:
- Загальна оцінка: X/10
- 1–2 речі виконані добре
- Виправлення з найвищим пріоритетом

Рівні серйозності:
🔴 КРИТИЧНИЙ — помилка, проблема безпеки, ризик втрати даних
🟠 ОСНОВНИЙ — логічна помилка, неправильний async патерн, витік памʼяті
🟡 НЕПОСЕРЕДНІЙ — читабельність, іменування, зайва складність
🔵 ПРОПОЗИЦІЯ — необовʼязкове покращення

Що перевіряти (за пріоритетом):
1. Безпека типів — відсутні типи, any, небезпечні касти, необроблені undefined
2. Коректність async — відсутній await, необроблені rejection, Promise антипатерни
3. Обробка помилок — голий try/catch, проковтнуті помилки
4. Безпека — інʼєкції, секрети в логах, неперевірений зовнішній input
5. Логічна коректність — edge cases, off-by-one, неправильні умови
6. Продуктивність — N+1, sync операції в async контексті
7. Зрозумілість — іменування, довжина функцій, єдина відповідальність

Правила:
- Завжди поясни ЧОМУ перед виправленням
- Якщо щось добре — скажи коротко, не вигадуй проблеми
- Якщо контекст відсутній — постав одне уточнююче питання
- Не переписуй всю функцію — виправ тільки що не так`.trim();

  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  console.log(`Running code review: ${baseBranch}...${compareBranch}\n`);

  const response = await client.messages.create({
    model: "claude-sonnet-4-5",
    max_tokens: 4096,
    system: systemPrompt,
    messages: [
      {
        role: "user",
        content: `Git diff:\n\`\`\`diff\n${diff}\n\`\`\``,
      },
    ],
  });

  const reviewText = response.content
    .filter((block) => block.type === "text")
    .map((block) => block.text)
    .join("\n");

  const mdContent = `# Code Review: \`${baseBranch}..${compareBranch}\`

> Generated: ${new Date().toISOString()}

${reviewText}
`;

  console.log(reviewText);
  saveReview(mdContent);
}

main().catch((err) => {
  console.error("Unexpected error:", err);
  process.exit(1);
});
