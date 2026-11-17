#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const USAGE = [
  'Usage:',
  '  node split-plan.mjs <plan file> <task dir>                 first approval',
  '  node split-plan.mjs <plan file> <task dir> --revision <n>  later revision with new and changed sections only',
  '  node split-plan.mjs --legacy <task dir>                    common.md for a run in the older phase layout',
].join('\n');

const FIXED_SECTIONS = new Map([
  ['common', 'common.md'],
  ['documentation', 'documentation.md'],
  ['acceptance criteria mapping', 'acceptance.md'],
  ['qa scenarios', 'qa-scenarios.md'],
]);
const LEGACY_SECTIONS = ['repositories and worktrees', 'tests', 'verification'];

const fail = (message) => {
  console.error(message);
  process.exit(1);
};

const splitSections = (text) => {
  const sections = [];
  let current = null;
  let fence = null;
  for (const line of text.split('\n')) {
    const marker = line.match(/^\s*(`{3,}|~{3,})/);
    if (marker) {
      if (!fence) fence = marker[1];
      else if (marker[1][0] === fence[0] && marker[1].length >= fence.length) fence = null;
    }
    const heading = fence ? null : line.match(/^## +(.+?)\s*$/);
    if (heading) {
      current = { title: heading[1], lines: [`# ${heading[1]}`] };
      sections.push(current);
    } else if (current) {
      current.lines.push(line);
    }
  }
  return sections.map(({ title, lines }) => ({
    title,
    body: `${lines.join('\n').trimEnd()}\n`,
  }));
};

const targetFile = (title) => {
  const part = title.match(/^Part +(\d+)\b/i);
  if (part) return `part-${Number(part[1])}.md`;
  return FIXED_SECTIONS.get(title.toLowerCase()) ?? null;
};

const writeLegacyCommon = (taskDir) => {
  const overview = path.join(taskDir, '02-plan.md');
  if (!fs.existsSync(overview)) fail(`No plan overview at ${overview}`);
  const wanted = splitSections(fs.readFileSync(overview, 'utf8')).filter(({ title }) =>
    LEGACY_SECTIONS.includes(title.toLowerCase()),
  );
  if (!wanted.length) fail(`No Tests or Verification section in ${overview}`);
  const planDir = path.join(taskDir, '02-plan');
  fs.mkdirSync(planDir, { recursive: true });
  const body = wanted.map(({ body: text }) => text.replace(/^# /, '## ')).join('\n');
  fs.writeFileSync(path.join(planDir, 'common.md'), `# Common\n\n${body}`);
  console.log(`files: common.md (from ${wanted.map(({ title }) => title).join(', ')})`);
};

const args = process.argv.slice(2);

if (args[0] === '--legacy') {
  if (!args[1]) fail(USAGE);
  writeLegacyCommon(path.resolve(args[1]));
  process.exit(0);
}

const revisionFlag = args.indexOf('--revision');
const revision = revisionFlag === -1 ? null : args[revisionFlag + 1];
const positional = revisionFlag === -1 ? args : args.filter((_, index) => index !== revisionFlag && index !== revisionFlag + 1);

if (positional.length !== 2 || (revisionFlag !== -1 && !/^\d+$/.test(revision ?? ''))) fail(USAGE);

const planFile = path.resolve(positional[0]);
const taskDir = path.resolve(positional[1]);
if (!fs.existsSync(planFile)) fail(`No plan file at ${planFile}`);

const text = fs.readFileSync(planFile, 'utf8');
const sections = splitSections(text).map(({ title, body }) => ({
  title,
  body,
  file: targetFile(title),
}));

const firstMapped = sections.findIndex(({ file }) => file);
const stray = sections.find(({ file }, index) => !file && firstMapped !== -1 && index > firstMapped);
if (stray) {
  fail(
    `Section "## ${stray.title}" comes after the sections for the agents and maps to no file, so its text would be lost. Use a level-three heading inside a card, or move the section above "## Common". Nothing was written.`,
  );
}

const outputs = sections.filter(({ file }) => file);

const seen = new Set();
for (const { file, title } of outputs) {
  if (seen.has(file)) fail(`Two sections map to ${file} (second: "${title}"). Nothing was written.`);
  seen.add(file);
}

const parts = outputs.filter(({ file }) => file.startsWith('part-'));
if (revision === null) {
  if (!seen.has('common.md')) fail('The plan has no "## Common" section. Nothing was written.');
  if (!parts.length) fail('The plan has no "## Part <n>: ..." section. Nothing was written.');
} else if (!outputs.length) {
  fail('The revision has no section to write. Nothing was written.');
}

const planDir = path.join(taskDir, '02-plan');
fs.mkdirSync(planDir, { recursive: true });

const copyTarget =
  revision === null ? path.join(taskDir, '02-plan.md') : path.join(planDir, `revision-${revision}.md`);
if (copyTarget !== planFile) fs.writeFileSync(copyTarget, text);

for (const { file, body } of outputs) fs.writeFileSync(path.join(planDir, file), body);

const numbers = parts.map(({ file }) => Number(file.match(/\d+/)[0])).sort((a, b) => a - b);
const missing =
  revision === null ? [...FIXED_SECTIONS.values()].filter((file) => !seen.has(file)) : [];

console.log(`plan copy: ${copyTarget}`);
console.log(`parts: ${numbers.length ? numbers.join(', ') : 'none'} (${numbers.length})`);
console.log(`files: ${outputs.map(({ file }) => file).join(', ')}`);
if (missing.length) console.log(`missing sections: ${missing.join(', ')}`);
