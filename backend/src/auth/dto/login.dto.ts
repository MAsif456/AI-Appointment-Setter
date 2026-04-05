import { IsEmail, IsString, IsNotEmpty } from "class-validator";

/** DTO for the POST /auth/login endpoint. */
export class LoginDto {
  @IsEmail({}, { message: "Valid email is required" })
  email: string;

  @IsString()
  @IsNotEmpty({ message: "Password is required" })
  password: string;
}
