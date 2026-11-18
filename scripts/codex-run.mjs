#!/usr/bin/env node
import { spawn, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const USAGE = [
  'Usage:',
  '  node codex-run.mjs check',
  '  node codex-run.mjs review --repo <worktree> --base <ref> --rules <main checkout> --out <findings.md>',
  '                            [--plan <file>] [--timeout <minutes>] [--model <model>] [--dry-run]',
  '  node codex-run.mjs qa --task-dir <dir> --inputs <file> --agent <task-qa.md> --run <name> --ui browser|mobile|none',
  '                        [--test-users <settings file>] [--report <file>] [--screenshots <dir>]',
  '                        [--watch <worktree>]... [--timeout <minutes>] [--model <model>] [--dry-run]',
].join('\n');

const isWindows = process.platform === 'win32';
const CODEX = isWindows ? 'codex.cmd' : 'codex';
const codexDir = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'common', 'codex');
const STDIN_PROMPT = 'Follow the instructions given on standard input.';
const LIMIT_PATTERN = /usage limit|rate limit|quota|too many requests|insufficient/i;
const QA_STATUSES = ['done', 'partial', 'open-questions', 'blocked'];

const fail = (message, code = 1) => {
  console.error(message);
  process.exit(code);
};

const readText = (file) => fs.readFileSync(file, 'utf8').replace(/\r\n/g, '\n');

const windowsQuote = (argument) => `"${argument.replace(/"/g, '\\"')}"`;

const parseOptions = (argv) => {
  const options = {};
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (!token.startsWith('--')) fail(`Unexpected argument "${token}".\n${USAGE}`);
    const key = token.slice(2);
    const next = argv[index + 1];
    const value = next === undefined || next.startsWith('--') ? true : next;
    if (value !== true) index += 1;
    options[key] = key in options ? [].concat(options[key], value) : value;
  }
  return options;
};

const required = (options, keys) => {
  const missing = keys.filter((key) => typeof options[key] !== 'string');
  if (missing.length) fail(`Missing ${missing.map((key) => `--${key}`).join(', ')}.\n${USAGE}`);
};

const minutes = (options, fallback) => {
  const value = options.timeout === undefined ? fallback : Number(options.timeout);
  if (!Number.isFinite(value) || value <= 0) fail('--timeout takes a positive number of minutes.');
  return value;
};

const mcpServer = (name, packageArgs) => {
  const command = isWindows ? 'cmd' : 'npx';
  const args = isWindows ? ['/c', 'npx', ...packageArgs] : packageArgs;
  return [
    '-c', `mcp_servers.${name}.command=${JSON.stringify(command)}`,
    '-c', `mcp_servers.${name}.args=${JSON.stringify(args)}`,
    '-c', `mcp_servers.${name}.startup_timeout_sec=120`,
    '-c', `mcp_servers.${name}.default_tools_approval_mode="approve"`,
  ];
};

const runCodex = (args, prompt, logFile, timeoutMinutes) =>
  new Promise((resolve) => {
    const log = fs.createWriteStream(logFile);
    const stdio = ['pipe', 'pipe', 'pipe'];
    const child = isWindows
      ? spawn(`${CODEX} ${args.map(windowsQuote).join(' ')}`, { stdio, shell: true })
      : spawn(CODEX, args, { stdio, detached: true });
    let timedOut = false;
    const stopTree = (signal) => {
      try {
        if (isWindows) spawnSync('taskkill', ['/pid', String(child.pid), '/T', '/F']);
        else process.kill(-child.pid, signal);
      } catch {
        child.kill(signal);
      }
    };
    const timer = setTimeout(() => {
      timedOut = true;
      stopTree('SIGTERM');
      setTimeout(() => stopTree('SIGKILL'), 5000).unref();
    }, timeoutMinutes * 60 * 1000);
    for (const signal of ['SIGINT', 'SIGTERM']) process.once(signal, () => stopTree('SIGTERM'));
    child.stdout.pipe(log, { end: false });
    child.stderr.pipe(log, { end: false });
    child.on('error', (error) => {
      clearTimeout(timer);
      log.end(`\n${error.message}\n`, () => resolve({ code: 127, timedOut }));
    });
    child.on('close', (code) => {
      clearTimeout(timer);
      log.end(() => resolve({ code, timedOut }));
    });
    child.stdin.on('error', () => {});
    child.stdin.end(prompt);
  });

const logTail = (logFile, lines = 4) =>
  fs.existsSync(logFile)
    ? fs.readFileSync(logFile, 'utf8').trimEnd().split('\n').slice(-lines).join(' | ').slice(0, 400)
    : '';

const hitLimit = ({ code, timedOut }, logFile) =>
  !timedOut && code !== 0 && LIMIT_PATTERN.test(logTail(logFile, 12));

const endReason = (ended, logFile, timeoutMinutes) => {
  if (ended.timedOut) return `stopped after ${timeoutMinutes} minutes`;
  if (hitLimit(ended, logFile)) return `Codex usage limit: ${logTail(logFile, 2)}`;
  return `codex exited with code ${ended.code}: ${logTail(logFile, 2)}`;
};

const scrub = (files, secrets) => {
  const values = secrets.filter((value) => typeof value === 'string' && value.length >= 4);
  for (const file of files) {
    if (!values.length || !fs.existsSync(file)) continue;
    const before = fs.readFileSync(file, 'utf8');
    const after = values.reduce((text, value) => text.split(value).join('***'), before);
    if (after !== before) fs.writeFileSync(file, after);
  }
};

const readJson = (file) => {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    return null;
  }
};

const dryRun = (args, prompt) => {
  console.log(`command: ${CODEX} ${args.map((arg) => (/[\s"'=[\]]/.test(arg) ? JSON.stringify(arg) : arg)).join(' ')}`);
  console.log(`prompt: ${prompt.length} characters`);
  console.log(prompt.split('\n').slice(0, 12).join('\n'));
};

const check = () => {
  const version = spawnSync(CODEX, ['--version'], { encoding: 'utf8', shell: isWindows });
  if (version.error || version.status !== 0) {
    console.log('codex: not installed');
    process.exit(1);
  }
  const login = spawnSync(CODEX, ['login', 'status'], { encoding: 'utf8', shell: isWindows });
  const text = `${login.stdout ?? ''}${login.stderr ?? ''}`;
  if (login.status !== 0 || /not logged in/i.test(text) || !/logged in/i.test(text)) {
    console.log('codex: not logged in');
    process.exit(1);
  }
  console.log(`codex: ready (${version.stdout.trim()})`);
};

const findingsMarkdown = (name, base, result) => {
  const lines = [`# Second review by Codex: ${name}`, '', `Base: ${base}`, '', result.summary.trim(), ''];
  result.findings.forEach((finding, index) => {
    lines.push(
      `### X${index + 1}: ${finding.title}`,
      `- Where: \`${finding.file}:${finding.line}\``,
      `- Severity: ${finding.severity}`,
      `- Problem: ${finding.problem}`,
      `- Why it matters: ${finding.why}`,
      `- Required change: ${finding.required_change}`,
      '',
    );
  });
  return `${lines.join('\n').trimEnd()}\n`;
};

const review = async (options) => {
  required(options, ['repo', 'base', 'rules', 'out']);
  const repo = path.resolve(options.repo);
  const out = path.resolve(options.out);
  const timeoutMinutes = minutes(options, 30);
  const planLine =
    typeof options.plan === 'string'
      ? `**The approved plan**, for the intent of a change only: \`${path.resolve(options.plan)}\`. Open the card of a part when you doubt whether something is deliberate.`
      : '';
  const prompt = readText(path.join(codexDir, 'review-instructions.md'))
    .replaceAll('{{base}}', options.base)
    .replaceAll('{{rules}}', path.resolve(options.rules))
    .replace('{{plan}}\n\n', planLine ? `${planLine}\n\n` : '');
  if (prompt.includes('{{')) fail('A placeholder was left in the review instructions.');
  const answerFile = out.replace(/\.md$/, '.json');
  const logFile = out.replace(/\.md$/, '.log');
  const args = [
    'exec', '-C', repo, '-s', 'read-only',
    '--output-schema', path.join(codexDir, 'review.schema.json'),
    '-o', answerFile,
    ...(typeof options.model === 'string' ? ['-m', options.model] : []),
    STDIN_PROMPT,
  ];
  if (options['dry-run']) return dryRun(args, prompt);

  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.rmSync(answerFile, { force: true });
  const ended = await runCodex(args, prompt, logFile, timeoutMinutes);
  const result = readJson(answerFile);
  const valid = result && typeof result.summary === 'string' && Array.isArray(result.findings);

  if (!valid && (ended.code !== 0 || ended.timedOut || !fs.existsSync(answerFile))) {
    console.log('status: failed');
    console.log(`reason: ${endReason(ended, logFile, timeoutMinutes)}`);
    console.log(`log: ${logFile}`);
    process.exit(2);
  }
  if (!valid) {
    fs.writeFileSync(out, `# Second review by Codex: ${path.basename(repo)}\n\nThe answer was not in the required shape. It is given as received.\n\n${fs.readFileSync(answerFile, 'utf8')}\n`);
    console.log('status: unparsed');
    console.log(`file: ${out}`);
    return;
  }
  fs.writeFileSync(out, findingsMarkdown(path.basename(repo), options.base, result));
  const bySeverity = ['high', 'medium', 'low']
    .map((level) => `${result.findings.filter((finding) => finding.severity === level).length} ${level}`)
    .join(', ');
  console.log('status: done');
  console.log(`findings: ${result.findings.length} (${bySeverity})`);
  console.log(`file: ${out}`);
};

const treeState = (worktree) => {
  const run = (args) => spawnSync('git', ['-C', worktree, ...args], { encoding: 'utf8' }).stdout ?? '';
  return `${run(['rev-parse', 'HEAD']).trim()}\n${run(['status', '--porcelain'])}`;
};

const stripFrontmatter = (text) => (text.startsWith('---\n') ? text.slice(text.indexOf('\n---\n', 4) + 5) : text);

const qa = async (options) => {
  required(options, ['task-dir', 'inputs', 'agent', 'run', 'ui']);
  if (!['browser', 'mobile', 'none'].includes(options.ui)) fail('--ui takes browser, mobile or none.');
  const taskDir = path.resolve(options['task-dir']);
  const report = path.resolve(typeof options.report === 'string' ? options.report : path.join(taskDir, '06-qa.md'));
  const screenshots = path.resolve(typeof options.screenshots === 'string' ? options.screenshots : path.join(taskDir, 'qa'));
  const watched = [].concat(options.watch ?? []).filter((item) => typeof item === 'string').map((item) => path.resolve(item));
  const timeoutMinutes = minutes(options, 120);
  const base = path.join(screenshots, `codex-${options.run}`);
  const answerFile = `${base}.json`;
  const logFile = `${base}.log`;

  const testUsers =
    typeof options['test-users'] === 'string'
      ? (readJson(path.resolve(options['test-users']))?.test_users ?? null)
      : null;
  if (typeof options['test-users'] === 'string' && !testUsers) fail(`No "test_users" key in ${options['test-users']}.`);
  const sections = [
    readText(path.join(codexDir, 'qa-preamble.md')).trimEnd(),
    '# Instructions',
    stripFrontmatter(readText(path.resolve(options.agent))).trim(),
    '# Inputs',
    readText(path.resolve(options.inputs)).trim(),
  ];
  const usersNote = 'passed to Codex with the prompt and not stored in this file';
  const prompt = [...sections, ...(testUsers ? ['# Test users', JSON.stringify(testUsers, null, 2)] : [])].join('\n\n');
  const storedPrompt = [...sections, ...(testUsers ? ['# Test users', usersNote] : [])].join('\n\n');
  const secrets = (Array.isArray(testUsers) ? testUsers : []).flatMap((user) =>
    Object.entries(user ?? {})
      .filter(([key]) => /pass|secret|token|pin|code/i.test(key))
      .map(([, value]) => value),
  );

  const servers =
    options.ui === 'browser'
      ? mcpServer('playwright', ['-y', '@playwright/mcp@latest', '--isolated', '--headless', '--output-dir', screenshots])
      : options.ui === 'mobile'
        ? mcpServer('mobile-mcp', ['-y', '@mobilenext/mobile-mcp@latest'])
        : [];
  const args = [
    'exec', '-C', taskDir, '--skip-git-repo-check', '-s', 'workspace-write',
    ...servers,
    '--output-schema', path.join(codexDir, 'qa.schema.json'),
    '-o', answerFile,
    ...(typeof options.model === 'string' ? ['-m', options.model] : []),
    STDIN_PROMPT,
  ];
  if (options['dry-run']) return dryRun(args, prompt);

  fs.mkdirSync(screenshots, { recursive: true });
  fs.rmSync(answerFile, { force: true });
  fs.writeFileSync(`${base}.prompt.md`, `${storedPrompt}\n`);
  const before = watched.map(treeState);
  const startedAt = Date.now();
  const ended = await runCodex(args, prompt, logFile, timeoutMinutes);
  scrub([logFile, answerFile, report], secrets);

  const changed = watched.filter((worktree, index) => treeState(worktree) !== before[index]);
  if (changed.length) {
    console.log('status: failed');
    console.log(`reason: files changed during the run in ${changed.join(', ')}; QA must not change code`);
    process.exit(2);
  }

  const reportWritten =
    fs.existsSync(report) &&
    fs.statSync(report).mtimeMs >= startedAt &&
    /^## Round /m.test(fs.readFileSync(report, 'utf8'));
  const result = readJson(answerFile);
  const valid =
    result &&
    QA_STATUSES.includes(result.status) &&
    result.counts &&
    Array.isArray(result.findings) &&
    Array.isArray(result.open_questions);

  const summaryLine = (text) => `summary: ${String(text ?? '').trim().split('\n').slice(0, 10).join(' / ')}`;

  if (!valid) {
    const cutOff = ended.code !== 0 || ended.timedOut;
    const canContinue = reportWritten && !hitLimit(ended, logFile);
    console.log(canContinue ? 'status: partial' : 'status: failed');
    console.log(`reason: ${cutOff ? endReason(ended, logFile, timeoutMinutes) : 'the final answer was not in the required shape'}`);
    if (reportWritten) console.log(`report: ${report} (a round is written: a new run can continue from it)`);
    else console.log(`log: ${logFile}`);
    process.exit(canContinue ? 0 : 2);
  }
  if (!reportWritten && result.status !== 'blocked') {
    console.log('status: failed');
    console.log(`reason: Codex answered "${result.status}" but wrote no round into ${report}`);
    console.log(summaryLine(result.summary));
    console.log(`log: ${logFile}`);
    process.exit(2);
  }

  const { counts } = result;
  console.log(`status: ${result.status}`);
  console.log(`verdict: ${result.verdict}`);
  console.log(`round: ${result.round}`);
  console.log(`counts: pass ${counts.pass}, fail ${counts.fail}, blocked ${counts.blocked}, not run ${counts.not_run}`);
  result.findings.forEach((finding) => console.log(`finding: ${finding.id} ${finding.type} ${finding.severity}: ${finding.title}`));
  result.open_questions.forEach((question) => console.log(`question: ${question}`));
  console.log(summaryLine(result.summary));
  console.log(reportWritten ? `report: ${report}` : 'report: no round was written');
};

const [command, ...rest] = process.argv.slice(2);
const options = parseOptions(rest);

if (command === 'check') check();
else if (command === 'review') await review(options);
else if (command === 'qa') await qa(options);
else fail(USAGE);
