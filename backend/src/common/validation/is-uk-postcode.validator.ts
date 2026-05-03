import {
  registerDecorator,
  ValidationArguments,
  ValidationOptions,
  ValidatorConstraint,
  ValidatorConstraintInterface,
} from "class-validator";
import { UK_POSTCODE_REGEX } from "./uk-formats";

/**
 * Custom class-validator constraint backing the @IsUkPostcode() decorator.
 * Uses the strict full-match UK_POSTCODE_REGEX so the entire string must
 * be a postcode — extraction-style matching belongs in the orchestrator
 * service, not in DTO validation.
 */
@ValidatorConstraint({ name: "isUkPostcode", async: false })
export class IsUkPostcodeConstraint implements ValidatorConstraintInterface {
  validate(value: unknown): boolean {
    if (typeof value !== "string") return false;
    return UK_POSTCODE_REGEX.test(value);
  }

  defaultMessage(args: ValidationArguments): string {
    return `${args.property} must be a valid UK postcode (e.g. CF10 1AA)`;
  }
}

/**
 * Decorator that validates a string is a strict UK postcode of the form
 * "CF10 1AA" (with optional space). Case-insensitive on the letter parts.
 *
 * @param options - Standard class-validator options.
 */
export function IsUkPostcode(options?: ValidationOptions): PropertyDecorator {
  return (object: object, propertyName: string | symbol) => {
    registerDecorator({
      target: object.constructor,
      propertyName: propertyName as string,
      options,
      constraints: [],
      validator: IsUkPostcodeConstraint,
    });
  };
}
