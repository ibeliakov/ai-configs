export interface RawFile {
  name: string;
  permalink: string;
  local_path?: string;
}

export interface RawMessage {
  ts: string;
  message_link: string;
  user_name: string;
  text: string;
  thread: RawMessage[];
  reactions: { name: string; count: number }[];
  files: RawFile[];
}

export interface RawChannel {
  id: string;
  name: string;
  messages: RawMessage[];
}

export interface FetchResult {
  workspace_domain: string;
  digest_name: string;
  period: { from: number; to: number };
  channels: RawChannel[];
}

export interface ReproSteps {
  environment?: string;
  steps: string[];
  expected?: string;
  actual?: string;
  code_location?: string;
}

export interface DigestEntry {
  channel_id: string;
  message_link: string;
  summary: string;
  status: "bug" | "info" | "question" | "task" | "announcement";
  use_case: string;
  participants: string[];
  resources: string[];
  repro_steps?: ReproSteps;
}
