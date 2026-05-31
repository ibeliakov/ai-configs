import { WebClient } from "@slack/web-api";
import * as dotenv from "dotenv";
import * as fs from "fs";
import * as path from "path";
import type { FetchResult, RawFile, RawMessage } from "./types.js";

// Load Slack credentials from automation .env
const automationEnvPath = process.env.AI_CONFIGS_DIR
  ? path.join(process.env.AI_CONFIGS_DIR, "automation", ".env")
  : path.resolve(process.cwd(), ".env"); // fallback: called with cd to automation/
dotenv.config({ path: automationEnvPath });

// Load project-specific settings (SLACK_DIGEST_OUTPUT_DIR etc.) from project .env
// Won't override vars already loaded above (SLACK_USER_TOKEN, SLACK_WORKSPACE_DOMAIN etc.)
dotenv.config({ path: path.resolve(process.cwd(), ".env") });

const TOKEN = process.env.SLACK_USER_TOKEN;
const WORKSPACE_DOMAIN = process.env.SLACK_WORKSPACE_DOMAIN;
const DEFAULT_CHANNELS = (process.env.SLACK_DEFAULT_CHANNELS ?? "").split(",").map((s) => s.trim()).filter(Boolean);
const PM_USERNAME = process.env.SLACK_PM_USERNAME ?? "";
const TZ_OFFSET = process.env.SLACK_TZ_OFFSET ?? "+02:00";

if (!TOKEN) {
  process.stderr.write("Error: SLACK_USER_TOKEN is not set in .env\n");
  process.exit(1);
}

if (!WORKSPACE_DOMAIN) {
  process.stderr.write("Error: SLACK_WORKSPACE_DOMAIN is not set in .env\n");
  process.exit(1);
}

const slack = new WebClient(TOKEN);

const IMAGE_EXTS = /\.(png|jpg|jpeg|gif|webp)$/i;

async function callWithRetry<T>(fn: () => Promise<T>, retries = 3): Promise<T> {
  for (let i = 0; i < retries; i++) {
    try {
      return await fn();
    } catch (e: any) {
      if (e.code === "slack_webapi_rate_limited") {
        const wait = (e.retryAfter ?? 1) * 1000;
        process.stderr.write(`Rate limited, retrying in ${e.retryAfter ?? 1}s...\n`);
        await new Promise((r) => setTimeout(r, wait));
      } else if (i === retries - 1) {
        throw e;
      }
    }
  }
  throw new Error("Max retries exceeded");
}

function isBot(msg: any): boolean {
  return msg.subtype === "bot_message" || !!msg.bot_id;
}

function isChannelId(s: string): boolean {
  return /^[CDGW][A-Z0-9]{6,}$/i.test(s);
}

function formatTimestamp(unixSecs: number, tzOffset: string): string {
  const offsetMatch = tzOffset.match(/([+-])(\d{2}):(\d{2})/);
  const offsetMins = offsetMatch
    ? (offsetMatch[1] === "+" ? 1 : -1) * (parseInt(offsetMatch[2]) * 60 + parseInt(offsetMatch[3]))
    : 0;
  const d = new Date((unixSecs + offsetMins * 60) * 1000);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}_${pad(d.getUTCHours())}-${pad(d.getUTCMinutes())}`;
}

function msgLink(channelId: string, ts: string): string {
  return `https://${WORKSPACE_DOMAIN}.slack.com/archives/${channelId}/p${ts.replace(".", "")}`;
}

async function downloadImage(
  urlPrivate: string,
  filename: string,
  channelId: string,
  msgTs: string,
  imagesDir: string
): Promise<string | undefined> {
  try {
    fs.mkdirSync(imagesDir, { recursive: true });
    const safeName = `${channelId}-${msgTs.replace(".", "")}-${filename}`;
    const destPath = path.join(imagesDir, safeName);
    const res = await fetch(urlPrivate, {
      headers: { Authorization: `Bearer ${TOKEN}` },
    });
    if (!res.ok) {
      process.stderr.write(`  Warning: failed to download ${filename} (HTTP ${res.status})\n`);
      return undefined;
    }
    const buffer = await res.arrayBuffer();
    fs.writeFileSync(destPath, Buffer.from(buffer));
    return destPath;
  } catch (e: any) {
    process.stderr.write(`  Warning: failed to download ${filename}: ${e.message}\n`);
    return undefined;
  }
}

async function buildFiles(rawFiles: any[], channelId: string, msgTs: string, imagesDir: string | undefined): Promise<RawFile[]> {
  return Promise.all(
    rawFiles
      .filter((f: any) => f.permalink)
      .map(async (f: any): Promise<RawFile> => {
        const name = f.name ?? f.title ?? "file";
        let local_path: string | undefined;
        if (imagesDir && IMAGE_EXTS.test(name) && f.url_private_download) {
          local_path = await downloadImage(f.url_private_download, name, channelId, msgTs, imagesDir);
        }
        return local_path
          ? { name, permalink: f.permalink, local_path }
          : { name, permalink: f.permalink };
      })
  );
}

function parseArgs(): { oldest: number; latest: number; channels: string[]; outputDir: string } {
  const args = process.argv.slice(2);
  let oldest: number | undefined;
  let latest = Math.floor(Date.now() / 1000);
  let channelNames: string[] = [];
  let outputDir = process.env.SLACK_DIGEST_OUTPUT_DIR
    ? path.resolve(process.cwd(), process.env.SLACK_DIGEST_OUTPUT_DIR)
    : process.cwd();

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    if (arg === "--period" && args[i + 1]) {
      const val = args[++i];
      const match = val.match(/^(\d+)(h|d)$/);
      if (!match) {
        process.stderr.write(`Error: invalid --period value "${val}". Use e.g. 24h or 2d\n`);
        process.exit(1);
      }
      const n = parseInt(match[1]);
      const unit = match[2];
      const seconds = unit === "h" ? n * 3600 : n * 86400;
      oldest = latest - seconds;
    } else if (arg === "--date" && args[i + 1]) {
      const val = args[++i];
      const match = val.match(/^(\d{2})\.(\d{2})\.(\d{4})$/);
      if (!match) {
        process.stderr.write(`Error: invalid --date value "${val}". Use DD.MM.YYYY\n`);
        process.exit(1);
      }
      const [, dd, mm, yyyy] = match;
      const startLocal = new Date(`${yyyy}-${mm}-${dd}T00:00:00${TZ_OFFSET}`);
      const endLocal = new Date(`${yyyy}-${mm}-${dd}T23:59:59${TZ_OFFSET}`);
      oldest = Math.floor(startLocal.getTime() / 1000);
      latest = Math.floor(endLocal.getTime() / 1000);
    } else if (arg === "--channels" && args[i + 1]) {
      channelNames = args[++i].split(",").map((s) => s.trim()).filter(Boolean);
    } else if (arg === "--output-dir" && args[i + 1]) {
      outputDir = args[++i];
    }
  }

  if (!oldest) {
    oldest = latest - 86400;
  }

  return { oldest, latest, channels: channelNames, outputDir };
}

async function resolveChannelIds(names: string[]): Promise<Map<string, string>> {
  const result = new Map<string, string>();
  let cursor: string | undefined;

  do {
    const resp = await callWithRetry(() =>
      slack.conversations.list({
        types: "public_channel,private_channel",
        limit: 200,
        cursor,
        exclude_archived: true,
      })
    );

    for (const ch of resp.channels ?? []) {
      if (ch.name && ch.id && names.includes(ch.name)) {
        result.set(ch.name, ch.id);
      }
    }

    cursor = resp.response_metadata?.next_cursor;
  } while (cursor && result.size < names.length);

  return result;
}

async function resolveUserDM(username: string): Promise<{ id: string; name: string } | null> {
  const usernameLower = username.toLowerCase().trim();
  let cursor: string | undefined;

  do {
    const resp = await callWithRetry(() => slack.users.list({ limit: 200, cursor }));

    const user = (resp.members ?? []).find((m) => {
      if (m.deleted || m.is_bot) return false;
      const candidates = [
        m.name,
        m.profile?.display_name,
        m.profile?.display_name_normalized,
        m.profile?.real_name,
        m.profile?.real_name_normalized,
      ].filter(Boolean).map((s) => s!.toLowerCase().trim());
      return candidates.includes(usernameLower);
    });

    if (user?.id) {
      const dm = await callWithRetry(() => slack.conversations.open({ users: user.id! }));
      const channelId = dm.channel?.id;
      if (channelId) {
        return { id: channelId, name: `DM:${username}` };
      }
    }

    cursor = resp.response_metadata?.next_cursor;
  } while (cursor);

  return null;
}

async function fetchMessages(
  channelId: string,
  oldest: number,
  latest: number,
  imagesDir: string | undefined
): Promise<RawMessage[]> {
  const messages: RawMessage[] = [];
  let cursor: string | undefined;

  do {
    const resp = await callWithRetry(() =>
      slack.conversations.history({
        channel: channelId,
        oldest: String(oldest),
        latest: String(latest),
        limit: 200,
        cursor,
      })
    );

    for (const msg of resp.messages ?? []) {
      if (isBot(msg) && !msg.text?.trim()) continue;

      const userName = await resolveUserName(msg.user);
      const thread: RawMessage[] = [];

      if (msg.reply_count && msg.reply_count > 0 && msg.ts) {
        let replyCursor: string | undefined;
        do {
          const replies = await callWithRetry(() =>
            slack.conversations.replies({
              channel: channelId,
              ts: msg.ts!,
              cursor: replyCursor,
              limit: 200,
            })
          );

          for (const reply of (replies.messages ?? []).slice(replyCursor ? 0 : 1)) {
            if (isBot(reply) && !reply.text?.trim()) continue;
            const replyTs = reply.ts ?? "";
            thread.push({
              ts: replyTs,
              message_link: msgLink(channelId, replyTs),
              user_name: await resolveUserName(reply.user),
              text: reply.text ?? "",
              thread: [],
              reactions: [],
              files: await buildFiles((reply as any).files ?? [], channelId, replyTs, imagesDir),
            });
          }

          replyCursor = replies.response_metadata?.next_cursor;
        } while (replyCursor);
      }

      const msgTs = msg.ts ?? "";
      messages.push({
        ts: msgTs,
        message_link: msgLink(channelId, msgTs),
        user_name: userName,
        text: msg.text ?? "",
        thread,
        reactions: (msg.reactions ?? []).map((r) => ({
          name: r.name ?? "",
          count: r.count ?? 0,
        })),
        files: await buildFiles((msg as any).files ?? [], channelId, msgTs, imagesDir),
      });
    }

    cursor = resp.response_metadata?.next_cursor;
  } while (cursor);

  return messages;
}

const userCache = new Map<string, string>();

async function resolveUserName(userId: string | undefined): Promise<string> {
  if (!userId) return "unknown";
  if (userCache.has(userId)) return userCache.get(userId)!;

  try {
    const resp = await callWithRetry(() => slack.users.info({ user: userId }));
    const name =
      resp.user?.profile?.display_name ||
      resp.user?.profile?.real_name ||
      resp.user?.name ||
      userId;
    userCache.set(userId, name);
    return name;
  } catch {
    return userId;
  }
}

async function main() {
  const { oldest, latest, channels: customChannels, outputDir } = parseArgs();

  const fromStr = formatTimestamp(oldest, TZ_OFFSET);
  const toStr = formatTimestamp(latest, TZ_OFFSET);
  const digestName = `slack-digest-${fromStr}--${toStr}`;
  const imagesDir = path.join(outputDir, digestName);

  const channelNames = customChannels.length > 0 ? customChannels : DEFAULT_CHANNELS;
  const result: FetchResult = {
    workspace_domain: WORKSPACE_DOMAIN!,
    digest_name: digestName,
    period: { from: oldest, to: latest },
    channels: [],
  };

  const directIds = channelNames.filter(isChannelId);
  const nameList  = channelNames.filter((n) => !isChannelId(n) && !n.startsWith("DM:") && n !== PM_USERNAME);

  const channelMap = await resolveChannelIds(nameList);

  for (const name of nameList) {
    const id = channelMap.get(name);
    if (!id) {
      process.stderr.write(`Warning: channel "${name}" not found, skipping\n`);
      continue;
    }
    process.stderr.write(`Fetching #${name}...\n`);
    const messages = await fetchMessages(id, oldest, latest, imagesDir);
    process.stderr.write(`  → ${messages.length} messages\n`);
    result.channels.push({ id, name, messages });
  }

  for (const id of directIds) {
    process.stderr.write(`Fetching ${id}...\n`);
    const messages = await fetchMessages(id, oldest, latest, imagesDir);
    process.stderr.write(`  → ${messages.length} messages\n`);
    result.channels.push({ id, name: id, messages });
  }

  if (PM_USERNAME && customChannels.length === 0) {
    try {
      process.stderr.write(`Fetching DM:${PM_USERNAME}...\n`);
      const dm = await resolveUserDM(PM_USERNAME);
      if (dm) {
        const messages = await fetchMessages(dm.id, oldest, latest, imagesDir);
        process.stderr.write(`  → ${messages.length} messages\n`);
        result.channels.push({ id: dm.id, name: dm.name, messages });
      } else {
        process.stderr.write(`Warning: PM user "${PM_USERNAME}" not found, skipping DM\n`);
      }
    } catch (e: any) {
      process.stderr.write(`Warning: DM fetch failed (${e.message}), skipping. Check im:history / im:read scopes in Slack token.\n`);
    }
  }

  const totalMessages = result.channels.reduce((sum, ch) => sum + ch.messages.length, 0);
  process.stderr.write(`Done: ${result.channels.length} channels, ${totalMessages} messages total\n`);

  process.stdout.write(JSON.stringify(result, null, 2));
}

main().catch((err) => {
  process.stderr.write(`Fatal: ${err.message}\n`);
  process.exit(1);
});
