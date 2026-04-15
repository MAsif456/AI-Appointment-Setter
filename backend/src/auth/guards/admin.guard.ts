import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';

/**
 * Guards routes that should only be accessible by admin users.
 * Must be used after JwtAuthGuard so that req.user is already populated.
 *
 * Usage: @UseGuards(JwtAuthGuard, AdminGuard)
 */
@Injectable()
export class AdminGuard implements CanActivate {
  /**
   * Allows the request through only if the authenticated user has the 'admin' role.
   * @param context - The execution context containing the HTTP request
   * @throws ForbiddenException if the user is not an admin
   */
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user || user.role !== 'admin') {
      throw new ForbiddenException('Admin access required');
    }

    return true;
  }
}