import {
  registerDecorator,
  ValidationArguments,
  ValidationOptions,
  ValidatorConstraint,
  ValidatorConstraintInterface,
} from "class-validator";
import { UK_PHONE_REGEX } from "./uk-formats";

/**
 * Custom class-validator constraint backing the @IsUkPhone() decorator.
 * Encapsulates the canonical UK phone regex so DTOs do not duplicate it.
 *
 * Returns false (with a friendly message) for non-strings, empty strings,
 * and any value that does not match UK_PHONE_REGEX.
 */
@ValidatorConstraint({ name: "isUkPhone", async: false })
export class IsUkPhoneConstraint implements ValidatorConstraintInterface {
  validate(value: unknown): boolean {
    if (typeof value !== "string") return false;
    return UK_PHONE_REGEX.test(value);
  }

  defaultMessage(args: ValidationArguments): string {
    return `${args.property} must be a valid UK phone number (e.g. 029 2034 5678 or +44 29 2034 5678)`;
  }
}

/**
 * Decorator that validates a string is a UK phone number in either the
 * "+44" or "0" prefixed form. Combine with @IsString and @IsNotEmpty
 * separately if you need to reject non-strings or empty input upstream.
 *
 * @param options - Standard class-validator options (groups, each, etc.).
 */
export function IsUkPhone(options?: ValidationOptions): PropertyDecorator {
  return (object: object, propertyName: string | symbol) => {
    registerDecorator({
      target: object.constructor,
      propertyName: propertyName as string,
      options,
      constraints: [],
      validator: IsUkPhoneConstraint,
    });
  };
}
