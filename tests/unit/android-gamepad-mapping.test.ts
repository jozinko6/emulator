import { describe, it, expect } from "vitest";
import { ANDROID_KEYCODE_TO_CONTROL, ANDROID_AXIS_TO_CONTROL } from "@/lib/native/native-gamepad";

describe("Android keycode to control mapping", () => {
  it("maps face buttons A/B/X/Y", () => {
    expect(ANDROID_KEYCODE_TO_CONTROL[96]).toBe("face-a"); // KEYCODE_BUTTON_A
    expect(ANDROID_KEYCODE_TO_CONTROL[97]).toBe("face-b"); // KEYCODE_BUTTON_B
    expect(ANDROID_KEYCODE_TO_CONTROL[99]).toBe("face-x"); // KEYCODE_BUTTON_X
    expect(ANDROID_KEYCODE_TO_CONTROL[100]).toBe("face-y"); // KEYCODE_BUTTON_Y
  });

  it("maps shoulders and triggers", () => {
    expect(ANDROID_KEYCODE_TO_CONTROL[102]).toBe("l1"); // BUTTON_L1
    expect(ANDROID_KEYCODE_TO_CONTROL[103]).toBe("r1"); // BUTTON_R1
    expect(ANDROID_KEYCODE_TO_CONTROL[104]).toBe("l2"); // BUTTON_L2
    expect(ANDROID_KEYCODE_TO_CONTROL[105]).toBe("r2"); // BUTTON_R2
  });

  it("maps select and start", () => {
    expect(ANDROID_KEYCODE_TO_CONTROL[109]).toBe("select"); // BUTTON_SELECT
    expect(ANDROID_KEYCODE_TO_CONTROL[108]).toBe("start"); // BUTTON_START
  });

  it("maps L3/R3 stick clicks", () => {
    expect(ANDROID_KEYCODE_TO_CONTROL[106]).toBe("l3"); // BUTTON_THUMBL
    expect(ANDROID_KEYCODE_TO_CONTROL[107]).toBe("r3"); // BUTTON_THUMBR
  });

  it("maps D-pad", () => {
    expect(ANDROID_KEYCODE_TO_CONTROL[19]).toBe("dpad-up");
    expect(ANDROID_KEYCODE_TO_CONTROL[20]).toBe("dpad-down");
    expect(ANDROID_KEYCODE_TO_CONTROL[21]).toBe("dpad-left");
    expect(ANDROID_KEYCODE_TO_CONTROL[22]).toBe("dpad-right");
    expect(ANDROID_KEYCODE_TO_CONTROL[23]).toBe("dpad-center");
  });

  it("maps Back and Menu", () => {
    expect(ANDROID_KEYCODE_TO_CONTROL[4]).toBe("back");
    expect(ANDROID_KEYCODE_TO_CONTROL[82]).toBe("menu");
  });
});

describe("Android axis to control mapping", () => {
  it("maps left stick (X, Y)", () => {
    expect(ANDROID_AXIS_TO_CONTROL[0]).toBe("lstick-x"); // AXIS_X
    expect(ANDROID_AXIS_TO_CONTROL[1]).toBe("lstick-y"); // AXIS_Y
  });

  it("maps right stick (Z, RZ)", () => {
    expect(ANDROID_AXIS_TO_CONTROL[11]).toBe("rstick-x"); // AXIS_Z
    expect(ANDROID_AXIS_TO_CONTROL[14]).toBe("rstick-y"); // AXIS_RZ
  });

  it("maps D-pad hat", () => {
    expect(ANDROID_AXIS_TO_CONTROL[15]).toBe("dpad-x"); // AXIS_HAT_X
    expect(ANDROID_AXIS_TO_CONTROL[16]).toBe("dpad-y"); // AXIS_HAT_Y
  });

  it("maps triggers", () => {
    expect(ANDROID_AXIS_TO_CONTROL[17]).toBe("l2-axis"); // AXIS_LTRIGGER
    expect(ANDROID_AXIS_TO_CONTROL[18]).toBe("r2-axis"); // AXIS_RTRIGGER
  });
});
