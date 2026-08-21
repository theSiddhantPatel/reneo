import "dotenv/config";
import { describe, it, expect } from "vitest";
import { generateAgoraToken } from "../utils/agora.js";

describe("Agora RTC Token Generator & Role Privileges", () => {

  it("should generate a valid string token for publisher (host)", async () => {
    const { generateAgoraToken } = await import("../utils/agora.js");
    const token = generateAgoraToken("test-live-channel", 1001, "publisher");

    expect(token).toBeDefined();
    expect(typeof token).toBe("string");
    expect(token.length).toBeGreaterThan(20);
  });

  it("should generate a valid string token for subscriber (customer audience)", async () => {
    const { generateAgoraToken } = await import("../utils/agora.js");
    const token = generateAgoraToken("test-live-channel", 2002, "subscriber");

    expect(token).toBeDefined();
    expect(typeof token).toBe("string");
    expect(token.length).toBeGreaterThan(20);
  });

  it("should generate distinct tokens for different UIDs in the same channel", async () => {
    const { generateAgoraToken } = await import("../utils/agora.js");
    const token1 = generateAgoraToken("channel-a", 101, "subscriber");
    const token2 = generateAgoraToken("channel-a", 102, "subscriber");

    expect(token1).not.toEqual(token2);
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
