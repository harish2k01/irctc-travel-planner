import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ transport: vi.fn(), send: vi.fn(), config: vi.fn() }));
vi.mock("nodemailer", () => ({ default: { createTransport: mocks.transport } }));
vi.mock("./settings", () => ({ getDeliveryConfiguration: mocks.config }));
import { sendReminderEmail, sendTestEmail } from "./mail";

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

  it("links reminders to the exact persisted trip", async () => {
    await sendReminderEmail({ email: "user@example.invalid", route: "MDU to MS", travelDate: "2026-12-01", bookingDate: "2026-10-02", message: "Booking is open.", ticketId: "trip/one" });
    expect(mocks.send).toHaveBeenCalledWith(expect.objectContaining({ text: expect.stringContaining("/trips?trip=trip%2Fone") }));
  });

  it("propagates delivery failure to the retrying worker", async () => {
    mocks.send.mockRejectedValue(new Error("SMTP unavailable"));
    await expect(sendTestEmail("user@example.invalid")).rejects.toThrow("SMTP unavailable");
  });
});
