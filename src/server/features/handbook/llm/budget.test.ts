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

  // WO-B27-005: wellnessforzebras.com, 34 pages, $0.84 budget, map $0.11.
  it("lets the judge use what the map stage did not spend, never more than the total", () => {
    const budget = createRunBudget(undefined);
    budget.setPages(34);
    budget.setMapSpent(() => 0.11);
    expect(budget.judgeUsd()).toBeCloseTo(0.73);
    budget.setMapSpent(() => 9);
    expect(budget.judgeUsd()).toBeCloseTo(0.84 * 0.4);
  });
});
