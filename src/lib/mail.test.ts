import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ transport: vi.fn(), send: vi.fn(), config: vi.fn() }));
vi.mock("nodemailer", () => ({ default: { createTransport: mocks.transport } }));
vi.mock("./settings", () => ({ getDeliveryConfiguration: mocks.config }));
import { sendPasswordResetEmail, sendTestEmail } from "./mail";

describe("email transport", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.config.mockResolvedValue({ smtpUrl: "smtp://example.invalid:587", emailFrom: "planner@example.invalid" });
    mocks.transport.mockReturnValue({ sendMail: mocks.send });
    mocks.send.mockResolvedValue({ accepted: ["user@example.invalid"] });
  });

  it("applies bounded timeouts to the transport, not message defaults", async () => {
    await expect(sendTestEmail("user@example.invalid")).resolves.toEqual({ sent: true });
    expect(mocks.transport).toHaveBeenCalledWith({ url: "smtp://example.invalid:587", connectionTimeout: 10000, greetingTimeout: 10000, socketTimeout: 15000 });
    expect(mocks.send).toHaveBeenCalledWith(expect.objectContaining({ to: "user@example.invalid", from: "planner@example.invalid" }));
  });

  it("does not report an unconfigured service as delivered", async () => {
    mocks.config.mockResolvedValue({ smtpUrl: undefined });
    await expect(sendTestEmail("user@example.invalid")).resolves.toMatchObject({ sent: false });
    expect(mocks.transport).not.toHaveBeenCalled();
  });

  it("links password resets to the one-time reset page", async () => {
    await sendPasswordResetEmail("user@example.invalid", "test-token");
    expect(mocks.send).toHaveBeenCalledWith(expect.objectContaining({ text: expect.stringContaining("/set-password?token=test-token&type=reset") }));
  });

  it("propagates SMTP failure", async () => {
    mocks.send.mockRejectedValue(new Error("SMTP unavailable"));
    await expect(sendTestEmail("user@example.invalid")).rejects.toThrow("SMTP unavailable");
  });
});
