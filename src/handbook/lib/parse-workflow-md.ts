export type WorkflowSectionKey =
  | "purpose"
  | "when"
  | "who"
  | "steps"
  | "followup"
  | "guidance"
  | "other";

export type ParsedWorkflowContent = {
  sections: Record<string, string>;
  purpose: string;
  when: string;
  whoMarkdown: string;
  followUp: string;
  guidance: string;
};

const HEADING_MAP: Record<string, WorkflowSectionKey> = {
  purpose: "purpose",
  "when to use it": "when",
  "when to use": "when",
  "who is responsible": "who",
  "what happens next": "steps",
  "what requires follow-up": "followup",
  "common mistakes": "guidance",
  "if something goes wrong": "guidance",
  "before you close": "guidance",
  "before you approve": "guidance",
  "before you submit": "guidance",
  "what to check": "guidance",
};

function normalizeHeading(line: string): string {
  return line.replace(/^##\s+/, "").trim().toLowerCase();
}

export function parseWorkflowMarkdown(body: string): ParsedWorkflowContent {
  const sections: Record<string, string> = {};
  let currentKey = "other";
  let buffer: string[] = [];

  const flush = () => {
    const text = buffer.join("\n").trim();
    if (text) sections[currentKey] = (sections[currentKey] ? sections[currentKey] + "\n\n" : "") + text;
    buffer = [];
  };

  for (const line of body.split("\n")) {
    if (line.startsWith("## ")) {
      flush();
      const norm = normalizeHeading(line);
      currentKey = HEADING_MAP[norm] ?? "other";
      continue;
    }
    buffer.push(line);
  }
  flush();

  return {
    sections,
    purpose: sections.purpose ?? "",
    when: sections.when ?? "",
    whoMarkdown: sections.who ?? "",
    followUp: sections.followup ?? "",
    guidance: sections.guidance ?? "",
  };
}
