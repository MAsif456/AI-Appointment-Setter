import {
  IsEmail, IsNotEmpty, MinLength, Matches, IsIn,
  IsOptional, IsArray, IsMongoId,
} from 'class-validator';

const PASSWORD_REGEX = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/;
const PASSWORD_MESSAGE =
  'Password must contain uppercase, lowercase, number, and special character';

/** Used by the admin to create a new staff account */
export class CreateUserDto {
  @IsNotEmpty({ message: 'Name is required' })
  name: string;

  @IsEmail({}, { message: 'Please provide a valid email address' })
  email: string;

  @IsNotEmpty()
  @MinLength(8, { message: 'Password must be at least 8 characters' })
  @Matches(PASSWORD_REGEX, { message: PASSWORD_MESSAGE })
  password: string;

  @IsIn(['admin', 'staff'])
  role: 'admin' | 'staff';

  /** Required when role is 'staff' — must have at least one clinic assigned */
  @IsOptional()
  @IsArray()
  @IsMongoId({ each: true })
  assignedClinics?: string[];
}

/** Used by the admin to update an existing user */
export class UpdateUserDto {
  @IsOptional()
  @IsNotEmpty()
  name?: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsIn(['admin', 'staff'])
  role?: 'admin' | 'staff';

  @IsOptional()
  @IsArray()
  @IsMongoId({ each: true })
  assignedClinics?: string[];
}

/** Staff member changes their own password from the Account Settings page */
export class ChangePasswordDto {
  @IsNotEmpty({ message: 'Current password is required' })
  currentPassword: string;

  @IsNotEmpty()
  @MinLength(8, { message: 'Password must be at least 8 characters' })
  @Matches(PASSWORD_REGEX, { message: PASSWORD_MESSAGE })
  newPassword: string;
}

/** Initiates a forgot-password flow — sends a reset link to the email */
export class ForgotPasswordDto {
  @IsEmail()
  email: string;
}

/** Completes the reset-password flow — token comes from the link in the email */
export class ResetPasswordDto {
  @IsNotEmpty()
  token: string;

  @IsNotEmpty()
  @MinLength(8)
  @Matches(PASSWORD_REGEX, { message: PASSWORD_MESSAGE })
  newPassword: string;
}