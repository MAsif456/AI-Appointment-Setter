import {
  Controller,
  Get,
  Query,
  Req,
  Sse,
  UseGuards,
  UnauthorizedException,
  ForbiddenException,
  MessageEvent,
} from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { Observable, filter, map, merge, interval } from "rxjs";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import {
  NotificationBusService,
  EscalationEvent,
} from "./notification-bus.service";

/** Lifetime of the short-lived stream token (seconds). */
const STREAM_TOKEN_TTL_SEC = 60;

/** SSE heartbeat period — keeps proxies from closing idle streams. */
const HEARTBEAT_MS = 25_000;

/**
 * SSE + stream-token endpoints for the staff escalation bell.
 *
 * Why a separate stream token: `EventSource` cannot send the usual
 * `Authorization` header, so we mint a narrow-scoped JWT (only
 * usable against `/notifications/stream`) and the client passes it
 * as a query string parameter.
 */
@Controller("notifications")
export class NotificationsController {
  constructor(
    private readonly bus: NotificationBusService,
    private readonly jwtService: JwtService,
  ) {}

  /** Mint a short-lived token for use in the SSE URL. */
  @UseGuards(JwtAuthGuard)
  @Get("stream-token")
  async getStreamToken(@Req() req: any) {
    const user = req.user;
    if (user.role !== "staff") {
      throw new ForbiddenException("Only staff can subscribe to escalations");
    }
    const token = this.jwtService.sign(
      {
        sub: user._id.toString(),
        scope: "notifications-stream",
        role: user.role,
        // Denormalise assigned clinics onto the token so the stream
        // handler can filter without re-fetching the user.
        assignedClinics:
          user.assignedClinics?.map((id: any) => id.toString()) ?? [],
      },
      { expiresIn: `${STREAM_TOKEN_TTL_SEC}s` },
    );
    return { token, expiresInSec: STREAM_TOKEN_TTL_SEC };
  }

  /**
   * Live escalation stream for the authenticated staff member.
   * The query token is verified manually here because the standard
   * `JwtAuthGuard` only reads from the Authorization header.
   */
  @Sse("stream")
  stream(@Query("token") token: string): Observable<MessageEvent> {
    if (!token) {
      throw new UnauthorizedException("Missing stream token");
    }

    let payload: any;
    try {
      payload = this.jwtService.verify(token);
    } catch {
      throw new UnauthorizedException("Invalid or expired stream token");
    }

    if (payload.scope !== "notifications-stream") {
      throw new UnauthorizedException("Token not scoped for this endpoint");
    }
    if (payload.role !== "staff") {
      throw new ForbiddenException("Only staff can subscribe to escalations");
    }

    const allowedClinics: Set<string> = new Set(
      payload.assignedClinics ?? [],
    );

    // Real events — filtered by clinic membership.
    const events$: Observable<MessageEvent> = this.bus.asObservable().pipe(
      filter((e: EscalationEvent) => allowedClinics.has(e.clinicId)),
      map((e) => ({ type: "escalation", data: e })),
    );

    // Heartbeat keeps long-lived proxies from killing the connection.
    // Represented as a distinct event type the client can ignore.
    const heartbeats$: Observable<MessageEvent> = interval(HEARTBEAT_MS).pipe(
      map(() => ({ type: "ping", data: { t: Date.now() } })),
    );

    return merge(events$, heartbeats$);
  }
}
