import { ArgumentsHost, HttpStatus } from "@nestjs/common";
import { Error as MongooseError } from "mongoose";
import { DatabaseExceptionFilter } from "./database-exception.filter";

describe("DatabaseExceptionFilter", () => {
  let filter: DatabaseExceptionFilter;
  let mockJson: jest.Mock;
  let mockStatus: jest.Mock;
  let mockHost: ArgumentsHost;

  beforeEach(() => {
    filter = new DatabaseExceptionFilter();
    mockJson = jest.fn();
    mockStatus = jest.fn().mockReturnValue({ json: mockJson });

    mockHost = {
/**
 * Mocks out the switchToHttp method of ArgumentsHost.
 * Returns a mock object that includes getResponse and getRequest methods.
 * The getResponse method returns an object with a status property
 * that is set to the result of the mockStatus function.
 * The getRequest method returns an object with a method, url, and body property.
 * The method is set to "POST", the url is set to "/webhooks/ghl", and the body is set to
 * an object with type set to "InboundMessage" and contactId set to "test-123".
 */
      switchToHttp: () => ({
        getResponse: () => ({ status: mockStatus }),
    /**
     * Returns a mock object that represents the incoming request.
     * The mock object contains a method, url, and body property.
     * The method is set to "POST", the url is set to "/webhooks/ghl", and the body is set to an object with type set to "InboundMessage" and contactId set to "test-123".
     */
        getRequest: () => ({
          method: "POST",
          url: "/webhooks/ghl",
          body: { type: "InboundMessage", contactId: "test-123" },
        }),
      }),
    } as unknown as ArgumentsHost;
  });

  it("should return 503 Service Unavailable", () => {
    const error = new MongooseError("Connection failed");
    filter.catch(error, mockHost);

    expect(mockStatus).toHaveBeenCalledWith(HttpStatus.SERVICE_UNAVAILABLE);
    expect(mockJson).toHaveBeenCalledWith({
      statusCode: 503,
      message: "Service temporarily unavailable",
    });
  });

  it("should not leak internal error details in the response", () => {
    const error = new MongooseError("ECONNREFUSED 127.0.0.1:27017");
    filter.catch(error, mockHost);

    const responseBody = mockJson.mock.calls[0][0];
    expect(responseBody.message).toBe("Service temporarily unavailable");
    expect(responseBody).not.toHaveProperty("stack");
    expect(responseBody).not.toHaveProperty("error");
  });
});
