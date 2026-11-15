import { describe, expect, it, vi } from "vitest";
import { decryptKey, encryptKey } from "./keyCrypto";

vi.mock("@/lib/auth", () => ({
  getAuth: () => ({
    $context: Promise.resolve({
      secretConfig: "test-secret-that-is-at-least-32-characters-long",
    }),
  }),
}));

describe("keyCrypto", () => {
  it("round-trips a key and never stores the plaintext", async () => {
    const encrypted = await encryptKey("sk-test-123");
    expect(encrypted).not.toContain("sk-test-123");
    expect(await decryptKey(encrypted)).toBe("sk-test-123");
  });
});
