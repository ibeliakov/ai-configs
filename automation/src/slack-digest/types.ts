export interface RawMessage {
  ts: string;
  user_name: string;
  text: string;
  thread: RawMessage[];
  reactions: { name: string; count: number }[];
  files: { name: string; permalink: string }[];
}

export interface RawChannel {
  id: string;
  name: string;
  messages: RawMessage[];
}

export interface FetchResult {
  period: { from: number; to: number };
  channels: RawChannel[];
}

export interface DigestEntry {
  channel_id: string;
  message_link: string;
  summary: string;
  status: "bug" | "info" | "question" | "task" | "announcement";
  use_case: string;
  resources: string[];
}
