/**
 * Service for validating a normalised UK postcode against a clinic's service areas.
 *
 * A postcode is considered in-area when its outward code (the part before the space,
 * e.g. "CF10" from "CF10 1AA") starts with one of the configured service area prefixes
 * (e.g. "CF").  When no service areas are configured every postcode is accepted.
 */
import { Injectable } from '@nestjs/common';

@Injectable()
export class PostcodeValidationService {
  /**
   * Returns true when the normalised postcode falls within at least one of the
   * configured service areas, or when no service areas are configured.
   *
   * @param postcode - A normalised postcode, e.g. "CF10 1AA".
   * @param serviceAreas - Outward-code prefixes the clinic serves, e.g. ["CF", "NP"].
   */
  isInServiceArea(postcode: string, serviceAreas: string[]): boolean {
    if (!serviceAreas || serviceAreas.length === 0) {
      return true;
    }
    const outwardCode = postcode.split(' ')[0].toUpperCase();
    return serviceAreas.some((area) => outwardCode.startsWith(area.toUpperCase()));
  }
}
