import { Type } from "class-transformer";
import {
  ArrayMaxSize,
  IsArray,
  ValidateNested,
} from "class-validator";
import { SanitisedString } from "../../common/validation/sanitised-string.decorator";
import {
  ChatMessageDto,
  ClinicConfigDto,
  LeadInfoDto,
} from "./chat-shared.dto";

/**
 * Request body for POST /chat/message.
 *
 * - `message` is capped at 5000 characters (the SMS/WhatsApp practical
 *   ceiling and the value called out in the validation acceptance
 *   criterion).
 * - `history` is capped at 200 entries to stop pathological clients
 *   from blowing up the LLM context window or memory pressure.
 */
export class SendMessageDto {
  @ValidateNested()
  @Type(() => LeadInfoDto)
  leadInfo!: LeadInfoDto;

  @ValidateNested()
  @Type(() => ClinicConfigDto)
  clinicConfig!: ClinicConfigDto;

  @IsArray()
  @ArrayMaxSize(200)
  @ValidateNested({ each: true })
  @Type(() => ChatMessageDto)
  history!: ChatMessageDto[];

  @SanitisedString({ max: 5000 })
  message!: string;
}
