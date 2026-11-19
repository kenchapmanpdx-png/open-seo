import { describe, expect, it } from "vitest";
import { createRunBudget } from "./budget";

describe("createRunBudget", () => {
  it("scales with pages read, splits 60/40 and caps at $5", () => {
    const budget = createRunBudget(undefined);
    budget.setPages(100);
    expect(budget.totalUsd()).toBeCloseTo(1.5);
    expect(budget.mapUsd()).toBeCloseTo(0.9);
    expect(budget.judgeUsd()).toBeCloseTo(0.6);
    budget.setPages(1000);
    expect(budget.totalUsd()).toBe(5);
  });

  it("uses HANDBOOK_LLM_BUDGET_USD when it is a positive number", () => {
    const budget = createRunBudget("0.01");
    budget.setPages(100);
    expect(budget.totalUsd()).toBe(0.01);
    expect(createRunBudget("abc").totalUsd()).toBe(0.5);
  });
});
