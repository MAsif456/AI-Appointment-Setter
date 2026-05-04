import { CallHandler, ExecutionContext } from "@nestjs/common";
import { of } from "rxjs";
import { MongoOperatorSanitiserInterceptor } from "./mongo-operator-sanitiser.interceptor";

/** Builds a stub ExecutionContext exposing the supplied request shape. */
function buildContext(req: Record<string, unknown>): ExecutionContext {
  return {
    switchToHttp: () => ({ getRequest: () => req }),
  } as unknown as ExecutionContext;
}

const NEXT: CallHandler = { handle: () => of("ok") };

const hasOwn = (obj: object, key: string) =>
  Object.prototype.hasOwnProperty.call(obj, key);

describe("MongoOperatorSanitiserInterceptor", () => {
  let interceptor: MongoOperatorSanitiserInterceptor;

  beforeEach(() => {
    interceptor = new MongoOperatorSanitiserInterceptor();
  });

  it("strips $-prefixed keys from a top-level body", async () => {
    const body: Record<string, unknown> = { $gt: "", name: "X" };
    await interceptor.intercept(buildContext({ body }), NEXT).toPromise();
    expect(hasOwn(body, "$gt")).toBe(false);
    expect(body.name).toBe("X");
  });

  it("strips dotted keys from a top-level body", async () => {
    const body: Record<string, unknown> = { "user.role": "admin", ok: 1 };
    await interceptor.intercept(buildContext({ body }), NEXT).toPromise();
    expect(hasOwn(body, "user.role")).toBe(false);
    expect(body.ok).toBe(1);
  });

  it("recursively strips operators inside nested objects and arrays", async () => {
    const body = {
      filter: { $where: "1==1", deep: { $regex: ".*", kept: "v" } },
      list: [{ $ne: null, ok: 1 }],
    };
    await interceptor.intercept(buildContext({ body }), NEXT).toPromise();
    expect(hasOwn(body.filter, "$where")).toBe(false);
    expect(hasOwn(body.filter.deep, "$regex")).toBe(false);
    expect(body.filter.deep.kept).toBe("v");
    expect(hasOwn(body.list[0], "$ne")).toBe(false);
    expect(body.list[0].ok).toBe(1);
  });

  it("scrubs req.query and req.params as well as req.body", async () => {
    const query: Record<string, unknown> = {
      name: { $regex: ".*" },
      keep: "yes",
    };
    const params: Record<string, unknown> = { id: "abc", $where: "evil" };
    await interceptor
      .intercept(buildContext({ query, params }), NEXT)
      .toPromise();
    expect(hasOwn(query.name as object, "$regex")).toBe(false);
    expect(hasOwn(params, "$where")).toBe(false);
  });

  it("does not break a clean payload", async () => {
    const body = { name: "Cardiff", nested: { value: 42 } };
    await interceptor.intercept(buildContext({ body }), NEXT).toPromise();
    expect(body).toEqual({ name: "Cardiff", nested: { value: 42 } });
  });

  it("survives a cyclic object without infinite-looping", async () => {
    const body: Record<string, unknown> = { $bad: 1, name: "X" };
    body.self = body;
    await expect(
      interceptor.intercept(buildContext({ body }), NEXT).toPromise(),
    ).resolves.toBeDefined();
    expect(hasOwn(body, "$bad")).toBe(false);
  });

  it("works on Express 5 getter-only req.query (in-place mutation)", async () => {
    const queryStorage: Record<string, unknown> = { $regex: ".*", q: "ok" };
    const req: Record<string, unknown> = {};
    Object.defineProperty(req, "query", {
      get: () => queryStorage,
      configurable: false,
    });
    await interceptor.intercept(buildContext(req), NEXT).toPromise();
    expect(hasOwn(queryStorage, "$regex")).toBe(false);
    expect(queryStorage.q).toBe("ok");
  });

  it("ignores requests with no body/query/params (fail-open)", async () => {
    await expect(
      interceptor.intercept(buildContext({}), NEXT).toPromise(),
    ).resolves.toBe("ok");
  });
});
