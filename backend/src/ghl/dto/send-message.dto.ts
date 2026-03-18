import { IsEnum, IsNotEmpty, IsString } from 'class-validator';

export class SendMessageDto {
  @IsEnum(['SMS', 'WhatsApp', 'FB', 'IG', 'Email', 'Live_Chat', 'Custom'])
  type: string;

  @IsString()
  @IsNotEmpty()
  contactId: string;

  @IsString()
  @IsNotEmpty()
  message: string;
}
