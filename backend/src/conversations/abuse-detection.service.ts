import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

/**
 * Default profanity blocklist.
 * Extended at runtime via the ABUSE_BLOCKLIST_EXTRA environment variable
 * (comma-separated words).
 */
const DEFAULT_BLOCKLIST: readonly string[] = [
  "fuck",
  "fucking",
  "shit",
  "bitch",
  "asshole",
  "bastard",
  "cunt",
  "dick",
  "piss",
  "moron",
  "idiot",
  "retard",
  "twat",
  "wanker",
  "bollocks",
  "arse",
  "prick",
  "useless",
  "stupid",
  "pathetic",
];

/**
 * Target indicators that turn casual swearing into directed hostility.
 * If profanity appears alongside any of these, the message is classified
 * as directed hostile rather than casual venting.
 *
 * Examples:
 *   "my back is fucking killing me"  → no target → casual → ignored
 *   "you're fucking useless"         → target "you're" → directed → flagged
 *   "this service is shit"           → target "this service" → directed → flagged
 */
const DIRECTED_TARGET_PATTERNS: readonly RegExp[] = [
  /\byou\b/i,
  /\byou'?re\b/i,
  /\byour\b/i,
  /\bthis (service|bot|system|ai|chat|app)\b/i,
  /\bwhat a\b/i,
  /\bterrible\b/i,
  /\bwaste of\b/i,
  /\bhorrible\b/i,
  /\bawful\b/i,
];

/**
 * Phrases that indicate the lead is accepting the human-offer.
 * Checked only when offerWasPending is true.
 */
const HUMAN_REQUEST_PATTERNS: readonly RegExp[] = [
  /\byes\b/i,
  /\bsure\b/i,
  /\byeah\b/i,
  /\bok(ay)?\b/i,
  /\bplease\b/i,
  /\bspeak to (a|someone|a human|a person|the team)\b/i,
  /\breal person\b/i,
  /\bhuman\b/i,
  /\bteam\b/i,
  /\bsomeone\b/i,
];

/**
 * Number of directed-hostile messages before the system offers
 * to connect the lead with a human team member.
 */
const DIRECTED_HOSTILITY_THRESHOLD = 5;

/** Sent for each directed-hostile message below the threshold. */
const CALM_REDIRECT_RESPONSE =
  "I understand you may be frustrated — I'm here to help you book an appointment. " +
  "How can I assist you today?";

/**
 * Sent once the threshold is reached, and repeated on every subsequent
 * directed-hostile message until the lead explicitly responds.
 */
const HUMAN_OFFER_RESPONSE =
  "I want to help, but I'm not able to continue if the language remains " +
  "inappropriate. As this conversation isn't going anywhere, would you like " +
  "me to have someone from the team reach out instead?";

/** Sent when the lead accepts the human offer. */
const ESCALATION_CONFIRMATION_RESPONSE =
  "Great, I'll have a team member reach out to you directly. They'll be in touch soon.";

export type AbuseClassification = "none" | "casual" | "directed";

export interface AbuseCheckResult {
  classification: AbuseClassification; // How the message was classified
  matchedWords: string[]; // Blocklisted words that were matched in the message (for logging/debugging)

  response: string | null; // Canned response to send instead of calling the AI

  shouldEscalate: boolean; // True when the lead has accepted the human offer and should be escalated
  newDirectedCount: number; // Updated count to store on the conversation (incremented for directed hostility)

  offerIsPending: boolean; // True when the human offer is active and awaiting a response
}

/**
 * Classifies incoming lead messages as casual swearing, directed hostility,
 * or clean, and returns the appropriate canned response.
 *
 * Escalation flow:
 *   Casual swearing               → ignored, AI responds normally
 *   Directed hostility (1 to 4)   → calm professional redirect
 *   Directed hostility (5+)       → offer human team member, repeated every hostile message
 *   Lead accepts offer            → shouldEscalate = true, triggers escalation flow
 */
@Injectable()
export class AbuseDetectionService {
  private readonly logger = new Logger(AbuseDetectionService.name);
  private readonly blocklist: Set<string>;

  constructor(private readonly configService: ConfigService) {
    const extra = this.configService.get<string>("ABUSE_BLOCKLIST_EXTRA") ?? "";
    const extraWords = extra
      .split(",")
      .map((w) => w.trim().toLowerCase())
      .filter(Boolean);
    this.blocklist = new Set([...DEFAULT_BLOCKLIST, ...extraWords]);
    this.logger.log(
      `Abuse blocklist loaded with ${this.blocklist.size} entries`,
    );
  }

  /**
   * Checks a message and returns the detection result.
   *
   * @param message         - Raw message text from the lead
   * @param directedCount   - Current directed-hostility count stored on the conversation
   * @param offerWasPending - Whether the human-offer was already made and awaiting response
   */
  check(
    message: string,
    directedCount: number,
    offerWasPending: boolean,
  ): AbuseCheckResult {
    // If the offer was already made, check whether this message is an acceptance
    if (offerWasPending && this.isAcceptingOffer(message)) {
      return {
        classification: "none",
        matchedWords: [],
        response: ESCALATION_CONFIRMATION_RESPONSE,
        shouldEscalate: true,
        newDirectedCount: directedCount,
        offerIsPending: false,
      };
    }

    const classification = this.classify(message);

    // Casual swearing or clean message — pass through to the AI
    if (classification !== "directed") {
      return {
        classification,
        matchedWords: [],
        response: null,
        shouldEscalate: false,
        newDirectedCount: directedCount,
        offerIsPending: offerWasPending,
      };
    }

    // Directed hostility — increment count and select the correct response
    const normalised = message.toLowerCase().replace(/[^a-z\s]/g, " ");
    const matchedWords = normalised
      .split(/\s+/)
      .filter((w) => this.blocklist.has(w));

    const newDirectedCount = directedCount + 1;
    const offerShouldBeActive =
      newDirectedCount >= DIRECTED_HOSTILITY_THRESHOLD || offerWasPending;

    this.logger.warn(
      `Directed hostility detected — directedCount now: ${newDirectedCount}, ` +
        `offerActive: ${offerShouldBeActive}, matched: [${matchedWords.join(", ")}]`,
    );

    return {
      classification: "directed",
      matchedWords,
      response: offerShouldBeActive
        ? HUMAN_OFFER_RESPONSE
        : CALM_REDIRECT_RESPONSE,
      shouldEscalate: false,
      newDirectedCount,
      offerIsPending: offerShouldBeActive,
    };
  }

  /**
   * Classifies a message as 'none', 'casual', or 'directed'.
   * A message is 'directed' only if it contains a blocklisted word AND
   * at least one directed-target pattern.
   * A message with profanity but no target is 'casual' and is ignored.
   */
  private classify(message: string): AbuseClassification {
    const normalised = message.toLowerCase().replace(/[^a-z\s]/g, " ");
    const words = normalised.split(/\s+/).filter(Boolean);
    const hasBlocklistWord = words.some((w) => this.blocklist.has(w));

    if (!hasBlocklistWord) return "none";

    const isDirected = DIRECTED_TARGET_PATTERNS.some((p) => p.test(message));
    return isDirected ? "directed" : "casual";
  }

  /**
   * Checks whether a message is accepting the human-offer.
   * Only called when offerWasPending is true on the conversation.
   */
  private isAcceptingOffer(message: string): boolean {
    return HUMAN_REQUEST_PATTERNS.some((p) => p.test(message));
  }
}
