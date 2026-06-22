import { describe, it, expect } from "vitest";
import { codeToControl, KeyboardHandler } from "@/lib/input/keyboard-handler";
import { NullInputAdapter } from "@/emulators/core/emulator-input-adapter";

describe("codeToControl", () => {
  it("maps letters KeyA..KeyZ", () => {
    expect(codeToControl("KeyA")).toBe("key-a");
    expect(codeToControl("KeyZ")).toBe("key-z");
  });

  it("maps digits Digit0..Digit9", () => {
    expect(codeToControl("Digit0")).toBe("key-0");
    expect(codeToControl("Digit9")).toBe("key-9");
  });

  it("maps numpad digits", () => {
    expect(codeToControl("Numpad0")).toBe("key-numpad-0");
    expect(codeToControl("Numpad9")).toBe("key-numpad-9");
  });

  it("maps function keys F1..F12", () => {
    expect(codeToControl("F1")).toBe("key-f1");
    expect(codeToControl("F12")).toBe("key-f12");
  });

  it("maps arrows", () => {
    expect(codeToControl("ArrowUp")).toBe("key-up");
    expect(codeToControl("ArrowDown")).toBe("key-down");
    expect(codeToControl("ArrowLeft")).toBe("key-left");
    expect(codeToControl("ArrowRight")).toBe("key-right");
  });

  it("maps special keys", () => {
    expect(codeToControl("Space")).toBe("key-space");
    expect(codeToControl("Enter")).toBe("key-enter");
    expect(codeToControl("Escape")).toBe("key-escape");
    expect(codeToControl("Backspace")).toBe("key-backspace");
    expect(codeToControl("Tab")).toBe("key-tab");
    expect(codeToControl("Insert")).toBe("key-insert");
    expect(codeToControl("Delete")).toBe("key-delete");
    expect(codeToControl("Home")).toBe("key-home");
    expect(codeToControl("End")).toBe("key-end");
    expect(codeToControl("PageUp")).toBe("key-pageup");
    expect(codeToControl("PageDown")).toBe("key-pagedown");
  });

  it("maps modifier keys (both sides collapse to one)", () => {
    expect(codeToControl("ControlLeft")).toBe("key-ctrl");
    expect(codeToControl("ControlRight")).toBe("key-ctrl");
    expect(codeToControl("AltLeft")).toBe("key-alt");
    expect(codeToControl("AltRight")).toBe("key-alt");
    expect(codeToControl("ShiftLeft")).toBe("key-shift");
    expect(codeToControl("ShiftRight")).toBe("key-shift");
  });

  it("falls back to lowercase for unknown codes", () => {
    expect(codeToControl("SomeUnknownCode")).toBe("key-someunknowncode");
  });
});

describe("KeyboardHandler release on focus loss", () => {
  it("releases all pressed keys on blur", () => {
    const adapter = new NullInputAdapter();
    const handler = new KeyboardHandler({ adapter });
    // Simulate that adapter receives keys by tracking calls
    const pressed: string[] = [];
    const released: string[] = [];
    const wrappedAdapter = {
      keyDown: (code: string) => pressed.push(code),
      keyUp: (code: string) => released.push(code),
      pointerMove: () => {},
      pointerButtonDown: () => {},
      pointerButtonUp: () => {},
      pointerWheel: () => {},
      gamepadButtonDown: () => {},
      gamepadButtonUp: () => {},
      gamepadAxis: () => {},
      releaseAllInputs: () => {},
    };
    const h = new KeyboardHandler({ adapter: wrappedAdapter });
    h.start();

    // Simulate keydown events
    const ev1 = new KeyboardEvent("keydown", { code: "KeyW", bubbles: true });
    const ev2 = new KeyboardEvent("keydown", { code: "KeyA", bubbles: true });
    document.dispatchEvent(ev1);
    document.dispatchEvent(ev2);
    expect(pressed).toEqual(["KeyW", "KeyA"]);

    // Simulate window blur → all keys released
    window.dispatchEvent(new Event("blur"));
    expect(released.sort()).toEqual(["KeyA", "KeyW"]);

    h.stop();
  });

  it("releaseAll clears pressed keys without external event", () => {
    const pressed: string[] = [];
    const released: string[] = [];
    const wrappedAdapter = {
      keyDown: (code: string) => pressed.push(code),
      keyUp: (code: string) => released.push(code),
      pointerMove: () => {},
      pointerButtonDown: () => {},
      pointerButtonUp: () => {},
      pointerWheel: () => {},
      gamepadButtonDown: () => {},
      gamepadButtonUp: () => {},
      gamepadAxis: () => {},
      releaseAllInputs: () => {},
    };
    const h = new KeyboardHandler({ adapter: wrappedAdapter });
    h.start();
    document.dispatchEvent(new KeyboardEvent("keydown", { code: "Space" }));
    document.dispatchEvent(new KeyboardEvent("keydown", { code: "Enter" }));
    expect(pressed).toEqual(["Space", "Enter"]);

    h.releaseAll();
    expect(released.sort()).toEqual(["Enter", "Space"]);

    h.stop();
  });

  it("ignores auto-repeat events", () => {
    const pressed: string[] = [];
    const wrappedAdapter = {
      keyDown: (code: string) => pressed.push(code),
      keyUp: () => {},
      pointerMove: () => {},
      pointerButtonDown: () => {},
      pointerButtonUp: () => {},
      pointerWheel: () => {},
      gamepadButtonDown: () => {},
      gamepadButtonUp: () => {},
      gamepadAxis: () => {},
      releaseAllInputs: () => {},
    };
    const h = new KeyboardHandler({ adapter: wrappedAdapter });
    h.start();
    document.dispatchEvent(new KeyboardEvent("keydown", { code: "KeyW" }));
    document.dispatchEvent(new KeyboardEvent("keydown", { code: "KeyW", repeat: true }));
    document.dispatchEvent(new KeyboardEvent("keydown", { code: "KeyW", repeat: true }));
    expect(pressed).toEqual(["KeyW"]);
    h.stop();
  });
});
