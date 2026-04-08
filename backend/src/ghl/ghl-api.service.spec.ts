import { Test, TestingModule } from "@nestjs/testing";
import { HttpService } from "@nestjs/axios";
import { ConfigService } from "@nestjs/config";
import { of, throwError } from "rxjs";
import { AxiosResponse, AxiosHeaders } from "axios";
import { GhlApiService } from "./ghl-api.service";
import { SendMessageDto } from "./dto/send-message.dto";

describe("GhlApiService", () => {
  let service: GhlApiService;
  let httpService: {
    post: jest.Mock;
    get: jest.Mock;
    put: jest.Mock;
    delete: jest.Mock;
  };
  let configService: { get: jest.Mock };

  /**
   * Returns a mock AxiosResponse object with the given data.
   * The mock response will have a status of 200 and a statusText of 'OK',
   * and will contain the given data in its data property.
   * The headers property will be an empty object, and the config property
   * will contain an empty AxiosHeaders object.
   * @param {any} data - The data to include in the mock response.
   * @returns {AxiosResponse} - The mock AxiosResponse object.
   */
  const mockAxiosResponse = (data: any): AxiosResponse => ({
    data,
    status: 200,
    statusText: "OK",
    headers: {},
    config: { headers: new AxiosHeaders() },
  });

  beforeEach(async () => {
    httpService = {
      post: jest.fn(),
      get: jest.fn(),
      put: jest.fn(),
      delete: jest.fn(),
    };

    configService = {
      get: jest.fn().mockReturnValue("test-private-token"),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GhlApiService,
        { provide: HttpService, useValue: httpService },
        { provide: ConfigService, useValue: configService },
      ],
    }).compile();

    service = module.get<GhlApiService>(GhlApiService);
  });

  describe("sendMessageWithRetry", () => {
    const dto: SendMessageDto = {
      type: "SMS",
      contactId: "contact_123",
      message: "Hello, how can I help you?",
    };

    it("should send a message successfully on first attempt", async () => {
      const responseData = { messageId: "msg_001" };
      httpService.post.mockReturnValue(of(mockAxiosResponse(responseData)));

      const result = await service.sendMessageWithRetry(dto);

      expect(result).toEqual(responseData);
      expect(httpService.post).toHaveBeenCalledTimes(1);
      expect(httpService.post).toHaveBeenCalledWith(
        "/conversations/messages",
        {
          type: "SMS",
          contactId: "contact_123",
          message: dto.message,
          status: "pending",
        },
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: "Bearer test-private-token",
          }),
        }),
      );
    });

    it("should retry up to 3 times on failure then throw", async () => {
      const error = new Error("Network error");
      httpService.post.mockReturnValue(throwError(() => error));

      await expect(service.sendMessageWithRetry(dto)).rejects.toThrow(
        "Network error",
      );
      expect(httpService.post).toHaveBeenCalledTimes(3);
    }, 15000);

    it("should succeed on second attempt after first failure", async () => {
      const error = new Error("Temporary error");
      const responseData = { messageId: "msg_002" };

      httpService.post
        .mockReturnValueOnce(throwError(() => error))
        .mockReturnValueOnce(of(mockAxiosResponse(responseData)));

      const result = await service.sendMessageWithRetry(dto);

      expect(result).toEqual(responseData);
      expect(httpService.post).toHaveBeenCalledTimes(2);
    }, 10000);
  });

  describe("getConversation", () => {
    it("should fetch a conversation by ID", async () => {
      const responseData = { id: "conv_123", contactId: "contact_123" };
      httpService.get.mockReturnValue(of(mockAxiosResponse(responseData)));

      const result = await service.getConversation("conv_123");

      expect(result).toEqual(responseData);
      expect(httpService.get).toHaveBeenCalledWith(
        "/conversations/conv_123",
        expect.objectContaining({
          headers: expect.objectContaining({ Version: "2021-07-28" }),
        }),
      );
    });
  });

  describe("createConversation", () => {
    it("should create a conversation via GHL API", async () => {
      const responseData = { id: "conv_new", contactId: "contact_123" };
      httpService.post.mockReturnValue(of(mockAxiosResponse(responseData)));

      const result = await service.createConversation("contact_123", "loc_001");

      expect(result).toEqual(responseData);
      expect(httpService.post).toHaveBeenCalledWith(
        "/conversations/",
        { contactId: "contact_123", locationId: "loc_001" },
        expect.any(Object),
      );
    });
  });

  describe("createAppointment", () => {
    it("should create an appointment via GHL Calendar API", async () => {
      const responseData = { id: "apt_123" };
      httpService.post.mockReturnValue(of(mockAxiosResponse(responseData)));

      const result = await service.createAppointment(
        "cal_001",
        "loc_001",
        "contact_123",
        "2026-03-17T14:00:00Z",
        "2026-03-17T14:30:00Z",
      );

      expect(result).toEqual(responseData);
      expect(httpService.post).toHaveBeenCalledWith(
        "/calendars/events/appointments",
        {
          calendarId: "cal_001",
          locationId: "loc_001",
          contactId: "contact_123",
          startTime: "2026-03-17T14:00:00Z",
          endTime: "2026-03-17T14:30:00Z",
          appointmentStatus: "confirmed",
        },
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: "Bearer test-private-token",
          }),
        }),
      );
    });

    it("should propagate errors from GHL Calendar API", async () => {
      const error = new Error("Calendar API error");
      httpService.post.mockReturnValue(throwError(() => error));

      await expect(
        service.createAppointment(
          "cal_001",
          "loc_001",
          "contact_123",
          "2026-03-17T14:00:00Z",
          "2026-03-17T14:30:00Z",
        ),
      ).rejects.toThrow("Calendar API error");
    });
  });

  describe("cancelAppointment", () => {
    it('should cancel an appointment via GHL PUT with appointmentStatus "cancelled"', async () => {
      const responseData = { succeeded: true };
      httpService.put.mockReturnValue(of(mockAxiosResponse(responseData)));

      const result = await service.cancelAppointment("apt_123");

      expect(result).toEqual(responseData);
      expect(httpService.put).toHaveBeenCalledWith(
        "/calendars/events/appointments/apt_123",
        { appointmentStatus: "cancelled" },
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: "Bearer test-private-token",
          }),
        }),
      );
    });

    it("should return null on failure (null-on-failure pattern)", async () => {
      httpService.put.mockReturnValue(
        throwError(() => new Error("GHL down")),
      );

      const result = await service.cancelAppointment("apt_123");

      expect(result).toBeNull();
    });
  });

  describe("addContactTag", () => {
    it("should add a tag to a contact via GHL API", async () => {
      const responseData = { tags: ["cancelled"] };
      httpService.post.mockReturnValue(of(mockAxiosResponse(responseData)));

      const result = await service.addContactTag("contact_123", "cancelled");

      expect(result).toEqual(responseData);
      expect(httpService.post).toHaveBeenCalledWith(
        "/contacts/contact_123/tags",
        { tags: ["cancelled"] },
        expect.objectContaining({
          headers: expect.objectContaining({ Version: "2021-07-28" }),
        }),
      );
    });

    it("should return null on failure", async () => {
      httpService.post.mockReturnValue(
        throwError(() => new Error("Tag error")),
      );

      const result = await service.addContactTag("contact_123", "cancelled");

      expect(result).toBeNull();
    });
  });

  describe("sendMessageWithRetry — Email type", () => {
    it("should send html and subject fields for Email type", async () => {
      const emailDto: SendMessageDto = {
        type: "Email",
        contactId: "contact_123",
        message: "<p>Reminder</p>",
        subject: "Appointment Reminder",
      };
      const responseData = { messageId: "msg_email_001" };
      httpService.post.mockReturnValue(of(mockAxiosResponse(responseData)));

      const result = await service.sendMessageWithRetry(emailDto);

      expect(result).toEqual(responseData);
      expect(httpService.post).toHaveBeenCalledWith(
        "/conversations/messages",
        expect.objectContaining({
          type: "Email",
          html: "<p>Reminder</p>",
          subject: "Appointment Reminder",
        }),
        expect.any(Object),
      );
      expect(httpService.post).not.toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({ message: expect.anything() }),
        expect.any(Object),
      );
    });

    it("should send html without subject when subject is not provided", async () => {
      const emailDto: SendMessageDto = {
        type: "Email",
        contactId: "contact_123",
        message: "<p>Reminder</p>",
      };
      httpService.post.mockReturnValue(of(mockAxiosResponse({ messageId: "msg_002" })));

      await service.sendMessageWithRetry(emailDto);

      const calledPayload = httpService.post.mock.calls[0][1];
      expect(calledPayload.html).toBe("<p>Reminder</p>");
      expect(calledPayload.subject).toBeUndefined();
    });
  });

  describe("updateContactCustomField", () => {
    it("should PUT custom field update to GHL contacts API", async () => {
      httpService.put.mockReturnValue(of(mockAxiosResponse({ updated: true })));

      await service.updateContactCustomField("contact_123", "last_postcode", "CF10 2BX");

      expect(httpService.put).toHaveBeenCalledWith(
        "/contacts/contact_123",
        { customFields: [{ key: "last_postcode", value: "CF10 2BX" }] },
        expect.objectContaining({
          headers: expect.objectContaining({ Authorization: "Bearer test-private-token" }),
        }),
      );
    });

    it("should log and rethrow when the PUT fails", async () => {
      httpService.put.mockReturnValue(throwError(() => new Error("GHL field error")));

      await expect(
        service.updateContactCustomField("contact_123", "last_postcode", "CF10 2BX"),
      ).rejects.toThrow("GHL field error");
    });
  });

  describe("getCircuitBreakerStates", () => {
    it("should return messaging and appointments circuit breaker states", () => {
      const states = service.getCircuitBreakerStates();

      expect(states).toHaveProperty("messaging");
      expect(states).toHaveProperty("appointments");
    });
  });

  describe("removeContactTag", () => {
    it("should remove a tag from a contact via GHL API", async () => {
      const responseData = { tags: [] };
      httpService.delete.mockReturnValue(of(mockAxiosResponse(responseData)));

      const result = await service.removeContactTag(
        "contact_123",
        "appointment-booked",
      );

      expect(result).toEqual(responseData);
      expect(httpService.delete).toHaveBeenCalledWith(
        "/contacts/contact_123/tags",
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: "Bearer test-private-token",
          }),
          data: { tags: ["appointment-booked"] },
        }),
      );
    });

    it("should return null on failure", async () => {
      httpService.delete.mockReturnValue(
        throwError(() => new Error("Remove error")),
      );

      const result = await service.removeContactTag(
        "contact_123",
        "appointment-booked",
      );

      expect(result).toBeNull();
    });
  });

  describe("sendMessageWithRetry — email threading", () => {
    it("should include conversationId in payload when provided", async () => {
      const responseData = { messageId: "msg_email_001" };
      httpService.post.mockReturnValue(of(mockAxiosResponse(responseData)));

      const dto: SendMessageDto = {
        type: "Email",
        contactId: "contact_123",
        message: "Hello",
        html: "<p>Hello</p>",
        subject: "Test subject",
        conversationId: "conv_abc",
      };
      await service.sendMessageWithRetry(dto);

      expect(httpService.post).toHaveBeenCalledWith(
        "/conversations/messages",
        expect.objectContaining({ conversationId: "conv_abc" }),
        expect.anything(),
      );
    });

    it("should NOT include conversationId in payload when absent", async () => {
      const responseData = { messageId: "msg_sms_001" };
      httpService.post.mockReturnValue(of(mockAxiosResponse(responseData)));

      const dto: SendMessageDto = {
        type: "SMS",
        contactId: "contact_123",
        message: "Hi",
      };
      await service.sendMessageWithRetry(dto);

      const payload = httpService.post.mock.calls[0][1];
      expect(payload).not.toHaveProperty("conversationId");
    });

    it("should send html and subject for Email type", async () => {
      httpService.post.mockReturnValue(
        of(mockAxiosResponse({ messageId: "msg_e" })),
      );

      const dto: SendMessageDto = {
        type: "Email",
        contactId: "contact_123",
        message: "Plain text fallback",
        html: "<p>Rich content</p>",
        subject: "Appointment enquiry",
      };
      await service.sendMessageWithRetry(dto);

      const payload = httpService.post.mock.calls[0][1];
      expect(payload.html).toBe("<p>Rich content</p>");
      expect(payload.subject).toBe("Appointment enquiry");
      expect(payload).not.toHaveProperty("message");
    });

    it("should use message as html fallback for Email when html is not provided", async () => {
      httpService.post.mockReturnValue(
        of(mockAxiosResponse({ messageId: "msg_e2" })),
      );

      const dto: SendMessageDto = {
        type: "Email",
        contactId: "contact_123",
        message: "Fallback text",
      };
      await service.sendMessageWithRetry(dto);

      const payload = httpService.post.mock.calls[0][1];
      expect(payload.html).toBe("Fallback text");
    });

    it("should send message field for SMS type (not html/subject)", async () => {
      httpService.post.mockReturnValue(
        of(mockAxiosResponse({ messageId: "msg_s" })),
      );

      const dto: SendMessageDto = {
        type: "SMS",
        contactId: "contact_123",
        message: "SMS text",
      };
      await service.sendMessageWithRetry(dto);

      const payload = httpService.post.mock.calls[0][1];
      expect(payload.message).toBe("SMS text");
      expect(payload).not.toHaveProperty("html");
      expect(payload).not.toHaveProperty("subject");
    });
  });
});
