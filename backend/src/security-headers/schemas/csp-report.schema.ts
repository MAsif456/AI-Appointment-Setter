import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { Document } from "mongoose";

export type CspReportDocument = CspReport & Document;

/** Retention period for CSP violation reports (30 days). */
const CSP_REPORT_TTL_SECONDS = 30 * 86_400;

/**
 * Structured Content-Security-Policy violation report.
 *
 * Persisted whenever a real browser POSTs a violation to
 * /security/csp-report (the report-uri configured in the frontend
 * security headers helper). Capturing these in MongoDB gives the
 * Lunax team a feedback loop for tuning the CSP without users
 * having to manually report broken pages.
 *
 * The fields below match the standard CSP Level 2 report payload
 * shape. All fields are optional because browsers vary in what
 * they include and we want to fail open rather than reject a
 * valid violation report on a missing field.
 */
@Schema({ timestamps: { createdAt: true, updatedAt: false } })
export class CspReport {
  /** The page on which the violation occurred. */
  @Prop({ index: true })
  documentUri?: string;

  /** The URI of the document or worker that triggered the violation. */
  @Prop()
  referrer?: string;

  /** The directive whose enforcement caused the violation. */
  @Prop({ index: true })
  violatedDirective?: string;

  /** The original policy as specified by the policy header. */
  @Prop()
  effectiveDirective?: string;

  /** The original policy as specified by the policy header. */
  @Prop()
  originalPolicy?: string;

  /** Whether the policy was enforcing or report-only. */
  @Prop()
  disposition?: string;

  /** The URI of the resource that was blocked. */
  @Prop({ index: true })
  blockedUri?: string;

  /** The source file where the violation occurred. */
  @Prop()
  sourceFile?: string;

  /** Line number in the source file. */
  @Prop()
  lineNumber?: number;

  /** Column number in the source file. */
  @Prop()
  columnNumber?: number;

  /** HTTP status of the response that delivered the violating page. */
  @Prop()
  statusCode?: number;

  /** User-Agent of the reporting browser. Captured server-side. */
  @Prop()
  userAgent?: string;
}

export const CspReportSchema = SchemaFactory.createForClass(CspReport);

// TTL: auto-delete after 30 days so the collection does not grow forever.
CspReportSchema.index(
  { createdAt: 1 },
  { expireAfterSeconds: CSP_REPORT_TTL_SECONDS },
);
