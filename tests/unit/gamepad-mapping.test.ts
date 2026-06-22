import { describe, it, expect } from "vitest";
import {
  STANDARD_BUTTON_MAP,
  STANDARD_AXIS_MAP,
  applyDeadzone,
  applySensitivity,
  detectGamepadProfile,
} from "@/emulators/core/emulator-input";

describe("Gamepad standard button mapping", () => {
  it("maps standard W3C buttons", () => {
    expect(STANDARD_BUTTON_MAP[0]).toBe("face-a");
    expect(STANDARD_BUTTON_MAP[1]).toBe("face-b");
    expect(STANDARD_BUTTON_MAP[2]).toBe("face-x");
    expect(STANDARD_BUTTON_MAP[3]).toBe("face-y");
    expect(STANDARD_BUTTON_MAP[4]).toBe("l1");
    expect(STANDARD_BUTTON_MAP[5]).toBe("r1");
    expect(STANDARD_BUTTON_MAP[6]).toBe("l2");
    expect(STANDARD_BUTTON_MAP[7]).toBe("r2");
    expect(STANDARD_BUTTON_MAP[8]).toBe("select");
    expect(STANDARD_BUTTON_MAP[9]).toBe("start");
    expect(STANDARD_BUTTON_MAP[10]).toBe("l3");
    expect(STANDARD_BUTTON_MAP[11]).toBe("r3");
    expect(STANDARD_BUTTON_MAP[12]).toBe("dpad-up");
    expect(STANDARD_BUTTON_MAP[13]).toBe("dpad-down");
    expect(STANDARD_BUTTON_MAP[14]).toBe("dpad-left");
    expect(STANDARD_BUTTON_MAP[15]).toBe("dpad-right");
  });

  it("maps standard W3C axes", () => {
    expect(STANDARD_AXIS_MAP[0]).toBe("lstick-x");
    expect(STANDARD_AXIS_MAP[1]).toBe("lstick-y");
    expect(STANDARD_AXIS_MAP[2]).toBe("rstick-x");
    expect(STANDARD_AXIS_MAP[3]).toBe("rstick-y");
  });
});

describe("applyDeadzone", () => {
  it("returns 0 for values within deadzone", () => {
    expect(applyDeadzone(0, 0.15)).toBe(0);
    expect(applyDeadzone(0.1, 0.15)).toBe(0);
    expect(applyDeadzone(-0.1, 0.15)).toBe(0);
    expect(applyDeadzone(0.14, 0.15)).toBe(0);
  });

  it("normalizes values outside deadzone", () => {
    // value=1.0, deadzone=0.15 → (1.0-0.15)/(1-0.15) = 1.0
    expect(applyDeadzone(1.0, 0.15)).toBeCloseTo(1.0, 5);
    // value=0.5, deadzone=0.15 → (0.5-0.15)/0.85 ≈ 0.4118
    expect(applyDeadzone(0.5, 0.15)).toBeCloseTo(0.41176, 4);
  });

  it("preserves sign for negative values", () => {
    expect(applyDeadzone(-1.0, 0.15)).toBeCloseTo(-1.0, 5);
    expect(applyDeadzone(-0.5, 0.15)).toBeCloseTo(-0.41176, 4);
  });

  it("handles zero deadzone", () => {
    expect(applyDeadzone(0.5, 0)).toBeCloseTo(0.5, 5);
    expect(applyDeadzone(0, 0)).toBe(0);
  });
});

describe("applySensitivity", () => {
  it("multiplies value by sensitivity", () => {
    expect(applySensitivity(0.5, 2.0)).toBeCloseTo(1.0, 5);
    expect(applySensitivity(0.5, 0.5)).toBeCloseTo(0.25, 5);
  });

  it("clamps to [-1, 1]", () => {
    expect(applySensitivity(0.8, 2.0)).toBe(1);
    expect(applySensitivity(-0.8, 2.0)).toBe(-1);
  });
});

describe("detectGamepadProfile", () => {
  it("detects Xbox controllers", () => {
    expect(detectGamepadProfile("Xbox 360 Controller (XInput STANDARD GAMEPAD)")).toBe("xbox");
    expect(detectGamepadProfile("Xbox Wireless Controller")).toBe("xbox");
    expect(detectGamepadProfile("045e-02fd-...")).toBe("xbox");
  });

  it("detects DualShock (PS4)", () => {
    expect(detectGamepadProfile("Sony DualShock 4")).toBe("dualshock");
    expect(detectGamepadProfile("054c-05c4-Sony")).toBe("dualshock");
    expect(detectGamepadProfile("054c-09cc-...")).toBe("dualshock");
  });

  it("detects DualSense (PS5)", () => {
    expect(detectGamepadProfile("DualSense Wireless Controller")).toBe("dualsense");
    expect(detectGamepadProfile("054c-0ce6-...")).toBe("dualsense");
  });

  it("falls back to generic", () => {
    expect(detectGamepadProfile("Generic USB Gamepad")).toBe("generic");
    expect(detectGamepadProfile("Unknown Brand Controller")).toBe("generic");
  });
});
