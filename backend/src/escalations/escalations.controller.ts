import {
  Controller,
  Get,
  Post,
  Param,
  Req,
  HttpCode,
  UseGuards,
  ForbiddenException,
} from "@nestjs/common";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { SensitiveData } from "../security-headers/sensitive-data.decorator";
import { EscalationsService } from "./escalations.service";

/**
 * REST endpoints for the staff escalation queue.
 *
 * Every handler is staff-only; admins hit 403 here by design — the
 * expectation in the user story is that clinic staff, not admins,
 * action these escalations. Every handler also enforces access by
 * `assignedClinics` membership via the service layer.
 */
@SensitiveData()
@Controller("escalations")
@UseGuards(JwtAuthGuard)
export class EscalationsController {
  constructor(private readonly escalationsService: EscalationsService) {}

  /** List every unresolved escalation across the staff's clinics. */
  @Get()
  async list(@Req() req: any) {
    const user = req.user;
    this.requireStaff(user);
    const assigned = this.resolveAssignedClinics(user);
    const items = await this.escalationsService.listUnresolved(
      user._id.toString(),
      assigned,
    );
    return { items };
  }

  /** Full detail for a single escalation — includes transcript + lead. */
  @Get(":id")
  async getOne(@Param("id") id: string, @Req() req: any) {
    const user = req.user;
    this.requireStaff(user);
    const assigned = this.resolveAssignedClinics(user);
    return this.escalationsService.getWithTranscript(
      id,
      user._id.toString(),
      assigned,
    );
  }

  /** Dismiss the notification from the calling user's own bell. */
  @Post(":id/acknowledge")
  @HttpCode(204)
  async acknowledge(@Param("id") id: string, @Req() req: any) {
    const user = req.user;
    this.requireStaff(user);
    const assigned = this.resolveAssignedClinics(user);
    await this.escalationsService.acknowledge(
      id,
      user._id.toString(),
      assigned,
    );
  }

  /** Mark the escalation resolved clinic-wide. */
  @Post(":id/resolve")
  @HttpCode(204)
  async resolve(@Param("id") id: string, @Req() req: any) {
    const user = req.user;
    this.requireStaff(user);
    const assigned = this.resolveAssignedClinics(user);
    await this.escalationsService.resolve(id, assigned);
  }

  /** Guard: admins are explicitly out of the loop for this feature. */
  private requireStaff(user: any): void {
    if (user.role !== "staff") {
      throw new ForbiddenException(
        "Only staff can action escalation notifications",
      );
    }
  }

  /** Normalises assignedClinics to a flat string array. */
  private resolveAssignedClinics(user: any): string[] {
    return (user.assignedClinics ?? []).map((id: any) => id.toString());
  }
}
