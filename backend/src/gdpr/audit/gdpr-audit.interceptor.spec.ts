import { CallHandler, ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { of, lastValueFrom } from 'rxjs';
import { GdprAuditInterceptor } from './gdpr-audit.interceptor';
import { AUDIT_DATA_ACCESS_KEY } from './audit-data-access.decorator';

describe('GdprAuditInterceptor', () => {
  let interceptor: GdprAuditInterceptor;
  let reflector: Reflector;
  let mockAuditLogModel: { create: jest.Mock };

  const mockCallHandler: CallHandler = {
    handle: () => of({ data: 'response' }),
  };

/**
 * Creates a mock ExecutionContext object for testing the GdprAuditInterceptor.
 *
 * @param {Record<string, string>} [params={}] - HTTP request parameters.
 * @param {Record<string, string>} [headers={}] - HTTP request headers.
 * @param {string} [ip='127.0.0.1'] - Client IP address.
 * @returns {ExecutionContext} - A mockExecutionContext object.
 */
  function createMockContext(
    params: Record<string, string> = {},
    headers: Record<string, string> = {},
    ip = '127.0.0.1',
  ): ExecutionContext {
    return {
      getHandler: jest.fn(),
      getClass: jest.fn(),
      /**
       * Returns a mock HTTP request object containing the provided parameters, headers, and IP address.
       * The returned object also contains mock implementations of getResponse and getNext.
       * @returns {{ getRequest: () => { params: Record<string, string>, headers: Record<string, string>, ip: string }, getResponse: () => any, getNext: () => any }}
       */
      switchToHttp: () => ({
        getRequest: () => ({ params, headers, ip }),
        getResponse: jest.fn(),
        getNext: jest.fn(),
      }),
      getArgs: jest.fn(),
      getArgByIndex: jest.fn(),
      switchToRpc: jest.fn(),
      switchToWs: jest.fn(),
      getType: jest.fn(),
    } as unknown as ExecutionContext;
  }

  beforeEach(() => {
    reflector = new Reflector();
    mockAuditLogModel = { create: jest.fn().mockResolvedValue({}) };
    interceptor = new GdprAuditInterceptor(reflector, mockAuditLogModel as any);
  });

  it('should skip audit logging when handler has no @AuditDataAccess decorator', async () => {
    const context = createMockContext();
    jest.spyOn(reflector, 'get').mockReturnValue(undefined);

    const result$ = interceptor.intercept(context, mockCallHandler);
    await lastValueFrom(result$);

    expect(mockAuditLogModel.create).not.toHaveBeenCalled();
  });

  it('should create an audit log when handler is decorated with @AuditDataAccess', async () => {
    const context = createMockContext(
      { leadId: 'abc123' },
      { 'user-agent': 'TestBrowser/1.0' },
      '192.168.1.1',
    );
    jest.spyOn(reflector, 'get').mockReturnValue('consent');

    const result$ = interceptor.intercept(context, mockCallHandler);
    await lastValueFrom(result$);

    // Allow microtask for fire-and-forget promise
    await new Promise((r) => setImmediate(r));

    expect(mockAuditLogModel.create).toHaveBeenCalledWith({
      action: 'data.accessed',
      entityType: 'consent',
      entityId: 'abc123',
      ipAddress: '192.168.1.1',
      userAgent: 'TestBrowser/1.0',
      severity: 'info',
    });
  });

  it('should use x-forwarded-for header when ip is undefined', async () => {
    const request = {
      params: { leadId: 'abc123' },
      headers: { 'user-agent': 'Bot/1.0', 'x-forwarded-for': '10.0.0.1' },
      ip: undefined,
    };
    const context = {
      getHandler: jest.fn(),
      getClass: jest.fn(),
    /**
     * A mock for ExecutionContext.switchToHttp(). Returns a mock object
     * with the following methods:
     * - getRequest: returns the request object
     * - getResponse: a mock for the response object
     * - getNext: a mock for the next handler in the chain
     */
      switchToHttp: () => ({
        getRequest: () => request,
        getResponse: jest.fn(),
        getNext: jest.fn(),
      }),
      getArgs: jest.fn(),
      getArgByIndex: jest.fn(),
      switchToRpc: jest.fn(),
      switchToWs: jest.fn(),
      getType: jest.fn(),
    } as unknown as import('@nestjs/common').ExecutionContext;
    jest.spyOn(reflector, 'get').mockReturnValue('erasure');

    const result$ = interceptor.intercept(context, mockCallHandler);
    await lastValueFrom(result$);
    await new Promise((r) => setImmediate(r));

    expect(mockAuditLogModel.create).toHaveBeenCalledWith(
      expect.objectContaining({ ipAddress: '10.0.0.1', entityType: 'erasure' }),
    );
  });

  it('should not block the response if audit log creation fails', async () => {
    const context = createMockContext({ leadId: 'abc123' });
    jest.spyOn(reflector, 'get').mockReturnValue('consent');
    mockAuditLogModel.create.mockRejectedValue(new Error('DB down'));

    const result$ = interceptor.intercept(context, mockCallHandler);
    const result = await lastValueFrom(result$);

    // Response should still be returned despite audit failure
    expect(result).toEqual({ data: 'response' });
  });

  it('should use params.id as entityId when leadId is not present', async () => {
    const context = createMockContext({ id: 'generic-id-123' });
    jest.spyOn(reflector, 'get').mockReturnValue('consent');

    const result$ = interceptor.intercept(context, mockCallHandler);
    await lastValueFrom(result$);
    await new Promise((r) => setImmediate(r));

    expect(mockAuditLogModel.create).toHaveBeenCalledWith(
      expect.objectContaining({ entityId: 'generic-id-123' }),
    );
  });
});
