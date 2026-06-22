"use client";

import { registerPlugin, type PluginListenerHandle } from "@capacitor/core";
import { getRuntimeInfo } from "./native-platform";
import type { EmulatorInputEvent } from "@/types/emulator";

export type NativeGamepadEventType = "keydown" | "keyup" | "axis";

export interface NativeGamepadEvent {
  type: NativeGamepadEventType;
  button?: string;
  axis?: string;
  value?: number;
  source: string;
  timestamp: number;
}

export interface NativeGamepadPlugin {
  start(): Promise<void>;
  stop(): Promise<void>;
  addListener(
    eventName: "nativeGamepadEvent",
    listenerFunc: (event: NativeGamepadEvent) => void
  ): Promise<PluginListenerHandle>;
  removeAllListeners(): Promise<void>;
  getConnectedControllers(): Promise<{ controllers: Array<{ deviceId: number; name: string; sources: number }> }>;
  vibrate(options: { durationMs: number; intensity: number }): Promise<void>;
}

const CapacitorNativeGamepad = registerPlugin<NativeGamepadPlugin>("NativeGamepad");

export function isNativeGamepadAvailable(): boolean {
  if (typeof window === "undefined") return false;
  return getRuntimeInfo().isNativeAndroid;
}

export function getNativeGamepadPlugin(): NativeGamepadPlugin | null {
  if (!isNativeGamepadAvailable()) return null;
  return CapacitorNativeGamepad;
}

export function mapNativeGamepadEvent(event: NativeGamepadEvent): EmulatorInputEvent | null {
  const timestamp = event.timestamp || Date.now();
  if (event.type === "keydown" && event.button) {
    return { type: "button-down", control: event.button, value: 1, timestamp };
  }
  if (event.type === "keyup" && event.button) {
    return { type: "button-up", control: event.button, value: 0, timestamp };
  }
  if (event.type === "axis" && event.axis) {
    return { type: "axis", control: event.axis, value: event.value ?? 0, timestamp };
  }
  return null;
}

export const ANDROID_KEYCODE_TO_CONTROL: Record<number, string> = {
  96: "face-a",
  97: "face-b",
  99: "face-x",
  100: "face-y",
  102: "l1",
  103: "r1",
  104: "l2",
  105: "r2",
  109: "select",
  108: "start",
  106: "l3",
  107: "r3",
  19: "dpad-up",
  20: "dpad-down",
  21: "dpad-left",
  22: "dpad-right",
  23: "dpad-center",
  4: "back",
  82: "menu",
};

export const ANDROID_AXIS_TO_CONTROL: Record<number, string> = {
  0: "lstick-x",
  1: "lstick-y",
  11: "rstick-x",
  14: "rstick-y",
  15: "dpad-x",
  16: "dpad-y",
  17: "l2-axis",
  18: "r2-axis",
};
