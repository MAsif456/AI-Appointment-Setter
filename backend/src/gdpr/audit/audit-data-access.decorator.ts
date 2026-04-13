import { SetMetadata } from '@nestjs/common';

/** Metadata key used by GdprAuditInterceptor to detect decorated endpoints. */
export const AUDIT_DATA_ACCESS_KEY = 'audit:data-access';

/** Marks a controller method for automatic GDPR data-access audit logging. */
export const AuditDataAccess = (entityType: string) =>
  SetMetadata(AUDIT_DATA_ACCESS_KEY, entityType);
