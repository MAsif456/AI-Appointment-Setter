import {
  Body,
  Controller,
  Headers,
  HttpCode,
  HttpStatus,
  Post,
} from "@nestjs/common";
import { CspReportService } from "./csp-report.service";
import type { RawCspReportEnvelope } from "./csp-report.service";

/**
 * Public endpoint that receives Content-Security-Policy violation
 * reports from real browsers, as configured by the `report-uri`
 * directive in the frontend security headers helper.
 *
 * Notes on the design:
 *
 * - The route is intentionally unauthenticated. Browsers send these
 *   reports automatically when a page violates the CSP and they will
 *   not (and cannot) attach a session cookie or bearer token. Adding
 *   auth here would silently break the entire feedback loop.
 *
 * - The endpoint uses a dedicated "csp-report" rate limit tier
 *   (default: 100 req/min per IP). This is generous enough to
 *   capture every legitimate browser violation report — even from a
 *   badly misconfigured page — while preventing abuse of the public
 *   unauthenticated endpoint.
 *
 * - We always return 204 No Content. Browsers do not display the
 *   response body and will retry on 5xx, so a 204 keeps the network
 *   tab clean and prevents retry storms.
 */
@Controller("security")
export class CspReportController {
  constructor(private readonly cspReportService: CspReportService) {}

  /**
   * Accepts a CSP violation report from the browser. Browsers send
   * either `application/csp-report` or `application/json`; Nest's
   * default JSON body parser handles both because the actual payload
   * is JSON either way.
   *
   * @param body - The raw CSP report envelope from the browser.
   * @param userAgent - The User-Agent header captured server-side.
   */
  @Post("csp-report")
  @HttpCode(HttpStatus.NO_CONTENT)
  async report(
    @Body() body: RawCspReportEnvelope,
    @Headers("user-agent") userAgent?: string,
  ): Promise<void> {
    await this.cspReportService.record(body ?? {}, userAgent);
  }
}
