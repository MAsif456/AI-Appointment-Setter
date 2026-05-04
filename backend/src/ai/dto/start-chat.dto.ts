import { Type } from "class-transformer";
import { ValidateNested } from "class-validator";
import { ClinicConfigDto, LeadInfoDto } from "./chat-shared.dto";

/**
 * Request body for POST /chat/start.
 *
 * Both nested objects are validated with @ValidateNested, so any
 * NoSQL operator object or oversized text field smuggled into them
 * is rejected at the parse boundary by the global ValidationPipe.
 */
export class StartChatDto {
  @ValidateNested()
  @Type(() => LeadInfoDto)
  leadInfo!: LeadInfoDto;

  @ValidateNested()
  @Type(() => ClinicConfigDto)
  clinicConfig!: ClinicConfigDto;
}
