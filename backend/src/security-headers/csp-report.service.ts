import { Injectable, Logger } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model } from "mongoose";
import { CspReport, CspReportDocument } from "./schemas/csp-report.schema";

/**
 * Raw CSP Level 2 report payload as POSTed by browsers.
 *
 * Browsers wrap the actual report inside a top-level "csp-report" key
 * with hyphenated field names. This interface mirrors that exact shape
 * so the controller can validate the payload at the network boundary
 * before handing it off to the service for normalisation.
 */
export interface RawCspReportEnvelope {
  "csp-report"?: {
    "document-uri"?: string;
    referrer?: string;
    "violated-directive"?: string;
    "effective-directive"?: string;
    "original-policy"?: string;
    disposition?: string;
    "blocked-uri"?: string;
    "source-file"?: string;
    "line-number"?: number;
    "column-number"?: number;
    "status-code"?: number;
  };
}

/**
 * Persists Content-Security-Policy violation reports.
 *
 * Kept deliberately small: the controller validates and normalises
 * the payload, and the service writes it to MongoDB. Persistence
 * failures are logged and swallowed (fail-open) so a flood of
 * reports cannot DoS the dashboard, and so a transient database
 * outage cannot turn legitimate browser violation reports into
 * 500 responses that browsers might back off from.
 */
@Injectable()
export class CspReportService {
  private readonly logger = new Logger(CspReportService.name);

  constructor(
    @InjectModel(CspReport.name)
    private readonly cspReportModel: Model<CspReportDocument>,
  ) {}

  /**
   * Normalise a raw browser CSP report envelope into our schema shape
   * and persist it. Logs (but does not throw) on database failure.
   *
   * @param envelope - The raw payload from the browser.
   * @param userAgent - The User-Agent of the reporting browser.
   * @returns The persisted document, or null if the payload was empty
   *   or persistence failed. Callers should treat null as a no-op.
   */
  async record(
    envelope: RawCspReportEnvelope,
    userAgent: string | undefined,
  ): Promise<CspReportDocument | null> {
    const raw = envelope?.["csp-report"];
    if (!raw) {
      return null;
    }

    const normalised: Partial<CspReport> = {
      documentUri: raw["document-uri"],
      referrer: raw.referrer,
      violatedDirective: raw["violated-directive"],
      effectiveDirective: raw["effective-directive"],
      originalPolicy: raw["original-policy"],
      disposition: raw.disposition,
      blockedUri: raw["blocked-uri"],
      sourceFile: raw["source-file"],
      lineNumber: raw["line-number"],
      columnNumber: raw["column-number"],
      statusCode: raw["status-code"],
      userAgent,
    };

    this.logger.warn(
      `CSP violation: directive=${normalised.violatedDirective} blocked=${normalised.blockedUri} document=${normalised.documentUri}`,
    );

    try {
      return await this.cspReportModel.create(normalised);
    } catch (err) {
      // Fail-open: never let a logging failure surface as a 500 to a
      // browser that is trying to do the right thing.
      this.logger.error(
        `Failed to persist CSP violation report: ${(err as Error).message}`,
      );
      return null;
    }
  }
}
