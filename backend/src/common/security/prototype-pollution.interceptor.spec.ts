import { CallHandler, ExecutionContext } from "@nestjs/common";
import { of } from "rxjs";
import { PrototypePollutionInterceptor } from "./prototype-pollution.interceptor";

/**
 * Builds a stub ExecutionContext exposing the supplied request shape.
 * Only the bits the interceptor reads (body/query/params) are populated.
 */
function buildContext(req: Record<string, unknown>): ExecutionContext {
  return {
    switchToHttp: () => ({
      getRequest: () => req,
    }),
  } as unknown as ExecutionContext;
}

const NEXT: CallHandler = { handle: () => of("ok") };

/**
 * In production, request bodies arrive via body-parser → JSON.parse, which
 * places `__proto__` as a real own property (unlike object literals in JS
 * source, where `__proto__` mutates the prototype). Tests therefore use
 * JSON.parse to construct payloads that accurately model the wire format.
 */
function parse<T = Record<string, unknown>>(json: string): T {
  return JSON.parse(json) as T;
}

const hasOwn = (obj: object, key: string) =>
  Object.prototype.hasOwnProperty.call(obj, key);

describe("PrototypePollutionInterceptor", () => {
  let interceptor: PrototypePollutionInterceptor;

  beforeEach(() => {
    interceptor = new PrototypePollutionInterceptor();
  });

  it("strips top-level __proto__ from req.body", async () => {
    const body = parse('{"name":"X","__proto__":{"admin":true}}');
    const ctx = buildContext({ body });
    await interceptor.intercept(ctx, NEXT).toPromise();
    expect(hasOwn(body, "__proto__")).toBe(false);
    expect(body.name).toBe("X");
  });

  it("strips constructor and prototype keys from req.body", async () => {
    const body = parse(
      '{"constructor":{"isAdmin":true},"prototype":{"x":1},"keep":"me"}',
    );
    const ctx = buildContext({ body });
    await interceptor.intercept(ctx, NEXT).toPromise();
    expect(hasOwn(body, "constructor")).toBe(false);
    expect(hasOwn(body, "prototype")).toBe(false);
    expect(body.keep).toBe("me");
  });

  it("strips forbidden keys nested inside arrays and objects", async () => {
    const body = parse<{
      list: Array<Record<string, unknown>>;
      nested: { deep: Record<string, unknown> };
    }>(
      '{"list":[{"__proto__":{"polluted":true},"ok":1},{"fine":2}],' +
        '"nested":{"deep":{"constructor":{"x":1},"kept":"v"}}}',
    );
    const ctx = buildContext({ body });
    await interceptor.intercept(ctx, NEXT).toPromise();
    expect(hasOwn(body.list[0], "__proto__")).toBe(false);
    expect(body.list[0].ok).toBe(1);
    expect(hasOwn(body.nested.deep, "constructor")).toBe(false);
    expect(body.nested.deep.kept).toBe("v");
  });

  it("scrubs req.query and req.params as well as req.body", async () => {
    const query = parse('{"__proto__":{"z":1},"q":"search"}');
    const params = parse('{"id":"abc","constructor":{"x":1}}');
    const ctx = buildContext({ query, params });
    await interceptor.intercept(ctx, NEXT).toPromise();
    expect(hasOwn(query, "__proto__")).toBe(false);
    expect(hasOwn(params, "constructor")).toBe(false);
  });

  it("does not mutate values that have no forbidden keys", async () => {
    const body = parse('{"name":"OK","nested":{"value":42}}');
    const ctx = buildContext({ body });
    await interceptor.intercept(ctx, NEXT).toPromise();
    expect(body).toEqual({ name: "OK", nested: { value: 42 } });
  });

  it("does not pollute Object.prototype after a malicious payload", async () => {
    const body = parse('{"__proto__":{"polluted":"yes"}}');
    const ctx = buildContext({ body });
    await interceptor.intercept(ctx, NEXT).toPromise();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect(({} as any).polluted).toBeUndefined();
  });

  it("survives cyclic objects without infinite-looping", async () => {
    const body: Record<string, unknown> = { name: "X" };
    body.self = body;
    const ctx = buildContext({ body });
    await expect(
      interceptor.intercept(ctx, NEXT).toPromise(),
    ).resolves.toBeDefined();
  });

  it("ignores requests with no body/query/params (fail-open)", async () => {
    const ctx = buildContext({});
    await expect(
      interceptor.intercept(ctx, NEXT).toPromise(),
    ).resolves.toBe("ok");
  });

  it("does not throw when getRequest itself returns null", async () => {
    const ctx = {
      switchToHttp: () => ({ getRequest: () => null }),
    } as unknown as ExecutionContext;
    await expect(
      interceptor.intercept(ctx, NEXT).toPromise(),
    ).resolves.toBe("ok");
  });
});
