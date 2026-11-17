#!/usr/bin/env node
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const TAIL_BYTES = 8 * 1024 * 1024;
const root = path.join(os.homedir(), '.claude', 'projects');
const sessionId = process.env.CLAUDE_CODE_SESSION_ID;

const newestTranscript = (dir) => {
  if (!fs.existsSync(dir)) return null;
  const files = fs
    .readdirSync(dir)
    .filter((name) => name.endsWith('.jsonl'))
    .map((name) => path.join(dir, name))
    .map((file) => ({ file, modified: fs.statSync(file).mtimeMs }))
    .sort((a, b) => b.modified - a.modified);
  return files.length ? files[0].file : null;
};

const findTranscript = () => {
  if (!fs.existsSync(root)) return null;
  if (sessionId) {
    for (const name of fs.readdirSync(root)) {
      const file = path.join(root, name, `${sessionId}.jsonl`);
      if (fs.existsSync(file)) return file;
    }
  }
  return newestTranscript(path.join(root, process.cwd().replace(/[^a-zA-Z0-9]/g, '-')));
};

const readTail = (file) => {
  const { size } = fs.statSync(file);
  const length = Math.min(size, TAIL_BYTES);
  const buffer = Buffer.alloc(length);
  const descriptor = fs.openSync(file, 'r');
  fs.readSync(descriptor, buffer, 0, length, size - length);
  fs.closeSync(descriptor);
  return buffer.toString('utf8').split('\n');
};

const lastContextSize = (lines) => {
  for (let index = lines.length - 1; index >= 0; index -= 1) {
    let entry;
    try {
      entry = JSON.parse(lines[index]);
    } catch {
      continue;
    }
    const usage = entry?.message?.usage;
    if (entry?.type !== 'assistant' || entry?.isSidechain || !usage) continue;
    return (
      (usage.input_tokens ?? 0) +
      (usage.cache_read_input_tokens ?? 0) +
      (usage.cache_creation_input_tokens ?? 0)
    );
  }
  return null;
};

const transcript = findTranscript();
const tokens = transcript ? lastContextSize(readTail(transcript)) : null;

console.log(
  tokens === null ? 'context: unknown' : `context: ${Math.round(tokens / 1000)}K tokens`,
);
