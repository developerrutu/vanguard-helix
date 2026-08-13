import { appendFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  FEEDBACK_KINDS,
  NOTES,
  SEASONS,
  activeEvents,
  livePublic,
  scrubFeedback,
  type BugSev,
  type FeedbackKind,
} from "../../../shared/src/index";

export interface Ticket {
  id: string;
  at: number;
  from: string;
  kind: FeedbackKind;
  sev: BugSev;
  text: string;
}

const here = dirname(fileURLToPath(import.meta.url));
const logFile = join(here, "../../../../.data/feedback.log");

export class LiveDesk {
  private tickets: Ticket[] = [];

  public() {
    return {
      ...livePublic(),
      tickets: this.tickets.length,
    };
  }

  file(from: string, kind: string, sev: string, raw: string): Ticket | string {
    if (/\bpassword\b/i.test(raw) && /[:=]/.test(raw)) return "never_send_password";
    const k = (FEEDBACK_KINDS as string[]).includes(kind) ? (kind as FeedbackKind) : "suggest";
    const s: BugSev = (["critical", "high", "medium", "low", "cosmetic"] as BugSev[]).includes(sev as BugSev)
      ? (sev as BugSev)
      : "medium";
    const text = scrubFeedback(raw);
    if (!text) return "empty";
    const row: Ticket = {
      id: "fb_" + Date.now().toString(36),
      at: Date.now(),
      from,
      kind: k,
      sev: s,
      text,
    };
    this.tickets.push(row);
    if (this.tickets.length > 200) this.tickets.shift();
    try {
      mkdirSync(dirname(logFile), { recursive: true });
      appendFileSync(logFile, JSON.stringify(row) + "\n");
    } catch {
      /* disk */
    }
    return row;
  }

  list(limit = 20): Ticket[] {
    return this.tickets.slice(-limit);
  }

  season() {
    return SEASONS.find((s) => s.state === "live") || SEASONS[0];
  }

  events() {
    return activeEvents();
  }

  notes() {
    return NOTES;
  }
}

export const liveDesk = new LiveDesk();
