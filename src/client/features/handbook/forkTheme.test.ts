import { describe, expect, it } from "vitest";
import { resolveForkLook } from "./forkTheme";

function memoryStorage() {
  const data = new Map<string, string>();
  return {
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => void data.set(key, value),
  };
}

describe("resolveForkLook", () => {
  it("uses the fallback without a preview", () => {
    expect(resolveForkLook("", memoryStorage(), "c")).toBe("c");
  });

  it("keeps a ?look= preview for later pages in the tab", () => {
    const storage = memoryStorage();
    expect(resolveForkLook("?look=B", storage, "upstream")).toBe("b");
    expect(resolveForkLook("?tab=x", storage, "upstream")).toBe("b");
  });

  it("ignores an unknown look", () => {
    expect(resolveForkLook("?look=z", memoryStorage(), "a")).toBe("a");
  });

  it("still previews when storage throws", () => {
    const blocked = {
      getItem: () => {
        throw new Error("blocked");
      },
      setItem: () => {
        throw new Error("blocked");
      },
    };
    expect(resolveForkLook("?look=a", blocked, "c")).toBe("a");
    expect(resolveForkLook("", blocked, "c")).toBe("c");
  });
});
