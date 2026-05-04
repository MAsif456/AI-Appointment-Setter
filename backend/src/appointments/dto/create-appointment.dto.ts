import {
  IsDateString,
  IsMongoId,
  IsNotEmpty,
  IsOptional,
  IsString,
} from "class-validator";

export class CreateAppointmentDto {
  @IsMongoId()
  @IsNotEmpty()
  clinicId: string;

  @IsString()
  @IsNotEmpty()
  contactId: string;

  @IsMongoId()
  @IsNotEmpty()
  conversationId: string;

  @IsMongoId()
  @IsNotEmpty()
  leadId: string;

  @IsDateString()
  @IsNotEmpty()
  startTime: string;

  @IsOptional()
  @IsString()
  serviceType?: string;
}
