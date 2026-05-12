import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { toE164, sendBookingSMS } from "../lib/sms";

// ─── toE164 ────────────────────────────────────────────────────────────────

describe("toE164", () => {
  it("prepends +1 to a 10-digit US number", () => {
    expect(toE164("4155551234")).toBe("+14155551234");
  });

  it("prepends + to an 11-digit number starting with 1", () => {
    expect(toE164("14155551234")).toBe("+14155551234");
  });

  it("passes through a number already in E.164 format", () => {
    expect(toE164("+14155551234")).toBe("+14155551234");
  });

  it("strips formatting characters before normalizing", () => {
    expect(toE164("(415) 555-1234")).toBe("+14155551234");
    expect(toE164("415.555.1234")).toBe("+14155551234");
    expect(toE164("415 555 1234")).toBe("+14155551234");
  });

  it("strips dashes from a number that already has a + prefix", () => {
    expect(toE164("+44-20-7946-0958")).toBe("+442079460958");
  });

  it("adds + prefix to an international number without it", () => {
    expect(toE164("447911123456")).toBe("+447911123456");
  });
});

// ─── sendBookingSMS ────────────────────────────────────────────────────────

describe("sendBookingSMS", () => {
  const ENV = {
    TWILIO_ACCOUNT_SID: "ACtest123",
    TWILIO_AUTH_TOKEN: "authtoken",
    TWILIO_PHONE_NUMBER: "+15005550006",
  };

  beforeEach(() => {
    Object.assign(process.env, ENV);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    for (const key of Object.keys(ENV)) delete process.env[key];
  });

  it("resolves without throwing when Twilio returns 200", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true,
      text: async () => "",
    }));

    await expect(
      sendBookingSMS("+14155551234", "John", "Boxing", "2026-05-13T18:00:00.000Z")
    ).resolves.toBeUndefined();
  });

  it("throws when Twilio returns a non-ok status", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: false,
      status: 400,
      text: async () => '{"message":"Invalid phone number"}',
    }));

    await expect(
      sendBookingSMS("+14155551234", "John", "Boxing", "2026-05-13T18:00:00.000Z")
    ).rejects.toThrow("Twilio SMS failed (400)");
  });

  it("sends to the E.164-normalized number, not the raw input", async () => {
    const mockFetch = vi.fn().mockResolvedValue({ ok: true, text: async () => "" });
    vi.stubGlobal("fetch", mockFetch);

    await sendBookingSMS("4155551234", "Jane", "Yoga", "2026-05-14T06:00:00.000Z");

    const body = new URLSearchParams(mockFetch.mock.calls[0][1].body as string);
    expect(body.get("To")).toBe("+14155551234");
  });

  it("does nothing when Twilio env vars are missing", async () => {
    delete process.env.TWILIO_ACCOUNT_SID;
    const mockFetch = vi.fn();
    vi.stubGlobal("fetch", mockFetch);

    await sendBookingSMS("+14155551234", "John", "Boxing", "2026-05-13T18:00:00.000Z");

    expect(mockFetch).not.toHaveBeenCalled();
  });
});
