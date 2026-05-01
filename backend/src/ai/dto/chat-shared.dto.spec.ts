import "reflect-metadata";
import { plainToInstance } from "class-transformer";
import { validate } from "class-validator";
import {
  ChatMessageDto,
  ClinicConfigDto,
  LeadInfoDto,
} from "./chat-shared.dto";
import { StartChatDto } from "./start-chat.dto";
import { SendMessageDto } from "./send-message.dto";

/** Convenience for transforming + validating a payload. */
async function check<T extends object>(
  cls: new () => T,
  payload: unknown,
): Promise<Awaited<ReturnType<typeof validate>>> {
  return validate(plainToInstance(cls, payload) as object);
}

describe("LeadInfoDto", () => {
  it("accepts a minimal valid lead", async () => {
    expect(await check(LeadInfoDto, { firstName: "David" })).toHaveLength(0);
  });

  it("rejects an invalid email", async () => {
    const errors = await check(LeadInfoDto, {
      firstName: "David",
      email: "notanemail",
    });
    expect(errors.find((e) => e.property === "email")?.constraints?.isEmail)
      .toMatch(/email/);
  });

  it("rejects an invalid UK phone", async () => {
    const errors = await check(LeadInfoDto, {
      firstName: "David",
      phone: "+1 555 1234567",
    });
    expect(errors.find((e) => e.property === "phone")).toBeDefined();
  });

  it("rejects an issue field longer than 1000 characters", async () => {
    const errors = await check(LeadInfoDto, {
      firstName: "David",
      issue: "a".repeat(1001),
    });
    expect(
      errors.find((e) => e.property === "issue")?.constraints,
    ).toHaveProperty("maxLength");
  });

  it("rejects firstName sent as an object (NoSQL injection attempt)", async () => {
    const errors = await check(LeadInfoDto, {
      firstName: { $gt: "" },
    });
    expect(errors).not.toHaveLength(0);
  });
});

describe("ClinicConfigDto", () => {
  const valid = {
    clinicId: "clinic_001",
    name: "Cardiff Physio",
    tone: "Friendly",
    ghlLocationId: "loc_001",
    isActive: true,
  };

  it("accepts a minimal valid config", async () => {
    expect(await check(ClinicConfigDto, valid)).toHaveLength(0);
  });

  it("rejects an unsupported tone value", async () => {
    const errors = await check(ClinicConfigDto, { ...valid, tone: "Aggressive" });
    expect(errors.find((e) => e.property === "tone")).toBeDefined();
  });

  it("validates a nested cancellationPolicy", async () => {
    const errors = await check(ClinicConfigDto, {
      ...valid,
      cancellationPolicy: { feeEnabled: "yes", noticeHours: -1 },
    });
    const policyErr = errors.find((e) => e.property === "cancellationPolicy");
    expect(policyErr?.children?.length).toBeGreaterThan(0);
  });
});

describe("ChatMessageDto", () => {
  it("accepts a valid history entry", async () => {
    expect(
      await check(ChatMessageDto, { role: "user", content: "Hello" }),
    ).toHaveLength(0);
  });

  it("rejects an unsupported role", async () => {
    const errors = await check(ChatMessageDto, {
      role: "admin",
      content: "x",
    });
    expect(errors.find((e) => e.property === "role")).toBeDefined();
  });

  it("rejects content longer than 5000 characters", async () => {
    const errors = await check(ChatMessageDto, {
      role: "user",
      content: "a".repeat(5001),
    });
    expect(
      errors.find((e) => e.property === "content")?.constraints,
    ).toHaveProperty("maxLength");
  });
});

describe("StartChatDto", () => {
  it("validates both nested objects", async () => {
    const errors = await check(StartChatDto, {
      leadInfo: { firstName: { $gt: "" } },
      clinicConfig: { tone: "Aggressive" },
    });
    expect(errors.length).toBeGreaterThan(0);
  });
});

describe("SendMessageDto", () => {
  const baseLead = { firstName: "David" };
  const baseClinic = {
    clinicId: "c1",
    name: "Cardiff",
    tone: "Friendly",
    ghlLocationId: "loc1",
    isActive: true,
  };

  it("rejects a message exceeding 5000 characters", async () => {
    const errors = await check(SendMessageDto, {
      leadInfo: baseLead,
      clinicConfig: baseClinic,
      history: [],
      message: "a".repeat(5001),
    });
    expect(errors.find((e) => e.property === "message")).toBeDefined();
  });

  it("rejects a history array longer than 200 entries", async () => {
    const errors = await check(SendMessageDto, {
      leadInfo: baseLead,
      clinicConfig: baseClinic,
      history: Array.from({ length: 201 }, () => ({
        role: "user",
        content: "hi",
      })),
      message: "ping",
    });
    expect(
      errors.find((e) => e.property === "history")?.constraints,
    ).toHaveProperty("arrayMaxSize");
  });

  it("accepts a structurally valid request", async () => {
    expect(
      await check(SendMessageDto, {
        leadInfo: baseLead,
        clinicConfig: baseClinic,
        history: [{ role: "assistant", content: "Hi" }],
        message: "Can I book today?",
      }),
    ).toHaveLength(0);
  });
});
