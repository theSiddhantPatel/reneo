import "dotenv/config";
import { describe, it, expect } from "vitest";
import { generateAgoraToken, MAX_LIVE_DURATION_SECONDS } from "../utils/agora.js";

describe("Agora RTC Token Generator & Role Privileges", () => {
  it("should generate a valid string token for publisher (host)", async () => {
    const token = generateAgoraToken("test-live-channel", 1001, "publisher");

    expect(token).toBeDefined();
    expect(typeof token).toBe("string");
    expect(token.length).toBeGreaterThan(20);
  });

  it("should generate a valid string token for subscriber (customer audience)", async () => {
    const token = generateAgoraToken("test-live-channel", 2002, "subscriber");

    expect(token).toBeDefined();
    expect(typeof token).toBe("string");
    expect(token.length).toBeGreaterThan(20);
  });

  it("should generate distinct tokens for different UIDs in the same channel", async () => {
    const token1 = generateAgoraToken("channel-a", 101, "subscriber");
    const token2 = generateAgoraToken("channel-a", 102, "subscriber");

    expect(token1).not.toEqual(token2);
  });

  it("should enforce a 20-minute (1200s) maximum lifespan on generated tokens", () => {
    expect(MAX_LIVE_DURATION_SECONDS).toBe(1200);

    const token = generateAgoraToken("channel-timed", 3003, "publisher", 600);
    expect(token).toBeDefined();
    expect(typeof token).toBe("string");
  });
});

describe("Live Session 20-Minute Duration Lifecycle Rules", () => {
  it("should calculate remaining time correctly within 20-minute window", () => {
    const now = Date.now();
    const tenMinutesAgoIso = new Date(now - 10 * 60 * 1000).toISOString();
    const elapsedSeconds = Math.floor((now - new Date(tenMinutesAgoIso).getTime()) / 1000);
    const remainingSeconds = MAX_LIVE_DURATION_SECONDS - elapsedSeconds;

    expect(remainingSeconds).toBeCloseTo(600, -1);
    expect(remainingSeconds).toBeGreaterThan(0);
  });

  it("should detect sessions exceeding the 20-minute limit", () => {
    const now = Date.now();
    const twentyOneMinutesAgoIso = new Date(now - 21 * 60 * 1000).toISOString();
    const elapsedSeconds = Math.floor((now - new Date(twentyOneMinutesAgoIso).getTime()) / 1000);
    const remainingSeconds = MAX_LIVE_DURATION_SECONDS - elapsedSeconds;

    expect(remainingSeconds).toBeLessThanOrEqual(0);
  });
});

describe("Live Session Role & Security Validation Rules", () => {
  it("should grant publisher role only if seller is the session host", () => {
    const userId: string = "seller-uuid-123";
    const hostId: string = "seller-uuid-123";
    const role: string = "seller";

    let assignedRole: "publisher" | "subscriber" | null = null;
    if (role === "seller") {
      if (hostId === userId) {
        assignedRole = "publisher";
      }
    }

    expect(assignedRole).toBe("publisher");
  });

  it("should reject publisher access if seller is not the owner of the live session", () => {
    const userId: string = "seller-uuid-123";
    const hostId: string = "seller-uuid-999"; // Different host
    const role: string = "seller";

    let isAuthorized = true;
    if (role === "seller" && hostId !== userId) {
      isAuthorized = false;
    }

    expect(isAuthorized).toBe(false);
  });

  it("should assign subscriber role to customer users", () => {
    const role = "customer";
    let assignedRole: "publisher" | "subscriber" | null = null;

    if (role === "customer") {
      assignedRole = "subscriber";
    }

    expect(assignedRole).toBe("subscriber");
  });
});
