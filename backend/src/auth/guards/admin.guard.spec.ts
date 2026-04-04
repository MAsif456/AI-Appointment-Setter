import { ForbiddenException } from '@nestjs/common';
import { ExecutionContext } from '@nestjs/common';
import { AdminGuard } from './admin.guard';

/** Builds a mock ExecutionContext with the given request.user */
function makeContext(user: any): ExecutionContext {
  return {
    switchToHttp: () => ({
      getRequest: () => ({ user }),
    }),
  } as ExecutionContext;
}

/** Unit tests for AdminGuard */
describe('AdminGuard', () => {
  let guard: AdminGuard;

  beforeEach(() => {
    guard = new AdminGuard();
  });

  it('returns true when user has admin role', () => {
    const ctx = makeContext({ role: 'admin', _id: 'user_1' });
    expect(guard.canActivate(ctx)).toBe(true);
  });

  it('throws ForbiddenException when user has staff role', () => {
    const ctx = makeContext({ role: 'staff', _id: 'user_2' });
    expect(() => guard.canActivate(ctx)).toThrow(ForbiddenException);
  });

  it('throws ForbiddenException when user is null', () => {
    const ctx = makeContext(null);
    expect(() => guard.canActivate(ctx)).toThrow(ForbiddenException);
  });

  it('throws ForbiddenException when user is undefined', () => {
    const ctx = makeContext(undefined);
    expect(() => guard.canActivate(ctx)).toThrow(ForbiddenException);
  });

  it('throws ForbiddenException when user has no role field', () => {
    const ctx = makeContext({ _id: 'user_3' });
    expect(() => guard.canActivate(ctx)).toThrow(ForbiddenException);
  });

  it('throws with message "Admin access required"', () => {
    const ctx = makeContext({ role: 'staff' });
    try {
      guard.canActivate(ctx);
    } catch (err) {
      expect(err).toBeInstanceOf(ForbiddenException);
      expect((err as ForbiddenException).message).toBe('Admin access required');
    }
  });
});