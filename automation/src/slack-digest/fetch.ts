import { WebClient } from "@slack/web-api";
import * as dotenv from "dotenv";
import * as path from "path";
import type { FetchResult, RawChannel, RawMessage } from "./types.js";

dotenv.config({ path: path.resolve(process.cwd(), ".env") });

const TOKEN = process.env.SLACK_USER_TOKEN;
const WORKSPACE_DOMAIN = process.env.SLACK_WORKSPACE_DOMAIN;
const DEFAULT_CHANNELS = (process.env.SLACK_DEFAULT_CHANNELS ?? "").split(",").map((s) => s.trim()).filter(Boolean);
const PM_USERNAME = process.env.SLACK_PM_USERNAME ?? "";

if (!TOKEN) {
  process.stderr.write("Error: SLACK_USER_TOKEN is not set in .env\n");
  process.exit(1);
}

if (!WORKSPACE_DOMAIN) {
  process.stderr.write("Error: SLACK_WORKSPACE_DOMAIN is not set in .env\n");
  process.exit(1);
}

const slack = new WebClient(TOKEN);

function parseArgs(): { oldest: number; latest: number; channels: string[] } {
  const args = process.argv.slice(2);
  let oldest: number | undefined;
  let latest = Math.floor(Date.now() / 1000);
  let channelNames: string[] = [];

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
      // DD.MM.YYYY
      const match = val.match(/^(\d{2})\.(\d{2})\.(\d{4})$/);
      if (!match) {
        process.stderr.write(`Error: invalid --date value "${val}". Use DD.MM.YYYY\n`);
        process.exit(1);
      }
      const [, dd, mm, yyyy] = match;
      // Use local Ukraine time (UTC+2), convert to UTC for Slack API
      const startLocal = new Date(`${yyyy}-${mm}-${dd}T00:00:00+02:00`);
      const endLocal = new Date(`${yyyy}-${mm}-${dd}T23:59:59+02:00`);
      oldest = Math.floor(startLocal.getTime() / 1000);
      latest = Math.floor(endLocal.getTime() / 1000);
    } else if (arg === "--channels" && args[i + 1]) {
      channelNames = args[++i].split(",").map((s) => s.trim()).filter(Boolean);
    }
  }

  if (!oldest) {
    oldest = latest - 86400; // default: 24h
  }

  return { oldest, latest, channels: channelNames };
}

async function resolveChannelIds(names: string[]): Promise<Map<string, string>> {
  const result = new Map<string, string>();
  let cursor: string | undefined;

  do {
    const resp = await slack.conversations.list({
      types: "public_channel,private_channel",
      limit: 200,
      cursor,
      exclude_archived: true,
    });

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
  let cursor: string | undefined;

  do {
    const resp = await slack.users.list({ limit: 200, cursor });

    const user = (resp.members ?? []).find((m) => {
      if (m.deleted || m.is_bot) return false;
      return (
        m.name === username ||
        m.profile?.display_name === username ||
        m.profile?.real_name === username
      );
    });

    if (user?.id) {
      const dm = await slack.conversations.open({ users: user.id });
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
  latest: number
): Promise<RawMessage[]> {
  const messages: RawMessage[] = [];
  let cursor: string | undefined;

  do {
    const resp = await slack.conversations.history({
      channel: channelId,
      oldest: String(oldest),
      latest: String(latest),
      limit: 200,
      cursor,
    });

    for (const msg of resp.messages ?? []) {
      // Skip bot messages with no meaningful text
      if (msg.bot_id && !msg.text?.trim()) continue;

      const userName = await resolveUserName(msg.user);
      const thread: RawMessage[] = [];

      if (msg.reply_count && msg.reply_count > 0 && msg.ts) {
        const replies = await slack.conversations.replies({
          channel: channelId,
          ts: msg.ts,
          limit: 50,
        });

        for (const reply of (replies.messages ?? []).slice(1)) {
          if (reply.bot_id && !reply.text?.trim()) continue;
          thread.push({
            ts: reply.ts ?? "",
            user_name: await resolveUserName(reply.user),
            text: reply.text ?? "",
            thread: [],
            reactions: [],
          });
        }
      }

      messages.push({
        ts: msg.ts ?? "",
        user_name: userName,
        text: msg.text ?? "",
        thread,
        reactions: (msg.reactions ?? []).map((r) => ({
          name: r.name ?? "",
          count: r.count ?? 0,
        })),
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
    const resp = await slack.users.info({ user: userId });
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
  const { oldest, latest, channels: customChannels } = parseArgs();

  const channelNames = customChannels.length > 0 ? customChannels : DEFAULT_CHANNELS;
  const result: FetchResult = {
    period: { from: oldest, to: latest },
    channels: [],
  };

  // Resolve regular channels
  const channelMap = await resolveChannelIds(channelNames);
  for (const name of channelNames) {
    if (name.startsWith("DM:") || name === PM_USERNAME) continue;
    const id = channelMap.get(name);
    if (!id) {
      process.stderr.write(`Warning: channel "${name}" not found, skipping\n`);
      continue;
    }
    const messages = await fetchMessages(id, oldest, latest);
    const channel: RawChannel = { id, name, messages };
    result.channels.push(channel);
  }

  // Resolve PM DM (always included unless --channels overrides)
  if (PM_USERNAME && customChannels.length === 0) {
    const dm = await resolveUserDM(PM_USERNAME);
    if (dm) {
      const messages = await fetchMessages(dm.id, oldest, latest);
      result.channels.push({ id: dm.id, name: dm.name, messages });
    } else {
      process.stderr.write(`Warning: PM user "${PM_USERNAME}" not found, skipping DM\n`);
    }
  }

  process.stdout.write(JSON.stringify(result, null, 2));
}

main().catch((err) => {
  process.stderr.write(`Fatal: ${err.message}\n`);
  process.exit(1);
});
