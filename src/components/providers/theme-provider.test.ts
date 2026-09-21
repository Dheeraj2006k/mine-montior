import { describe, it, expect } from "vitest";
import { resolveStoredTheme, THEME_INIT_SCRIPT } from "./theme-provider";

describe("resolveStoredTheme", () => {
  it("defaults to dark when nothing is stored - matches the unconditional :root tokens", () => {
    expect(resolveStoredTheme(null)).toBe("dark");
  });

  it("defaults to dark on garbage/unrecognized values, never crashes or picks light by accident", () => {
    expect(resolveStoredTheme("")).toBe("dark");
    expect(resolveStoredTheme("blue")).toBe("dark");
    expect(resolveStoredTheme("LIGHT")).toBe("dark");
  });

  it("resolves to light only for the exact stored value 'light'", () => {
    expect(resolveStoredTheme("light")).toBe("light");
  });

  it("resolves 'dark' explicitly stored back to dark", () => {
    expect(resolveStoredTheme("dark")).toBe("dark");
  });
});

describe("THEME_INIT_SCRIPT", () => {
  it("reads the same storage key the provider writes, and only ever sets data-theme to light", () => {
    expect(THEME_INIT_SCRIPT).toContain("localStorage.getItem('iris-theme')");
    expect(THEME_INIT_SCRIPT).toContain("setAttribute('data-theme','light')");
    // Never removeAttribute or set 'dark' explicitly - the script's only
    // job is to prevent a light-theme flash; dark is already the default
    // with no attribute present, so there is nothing for it to do there.
    expect(THEME_INIT_SCRIPT).not.toContain("dark");
  });

  it("is wrapped in a try/catch so a blocked localStorage (private mode, disabled storage) never breaks page load", () => {
    expect(THEME_INIT_SCRIPT).toContain("try{");
    expect(THEME_INIT_SCRIPT).toContain("catch(e){}");
  });
});
