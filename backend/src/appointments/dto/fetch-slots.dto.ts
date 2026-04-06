import { IsNotEmpty, IsString, IsDateString } from "class-validator";

export class FetchSlotsQueryDto {
  @IsNotEmpty()
  @IsString()
  clinicId: string;

  @IsNotEmpty()
  @IsDateString()
  startDate: string; // ISO date string

  @IsNotEmpty()
  @IsDateString()
  endDate: string; // ISO date string
}
