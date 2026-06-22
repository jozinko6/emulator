"use client";

/**
 * Runtime platform detection — per prompt section 21.
 */
export type RuntimePlatform =
  | "web"
  | "pwa"
  | "android-mobile"
  | "android-tablet"
  | "android-tv";

export interface RuntimeInfo {
  platform: RuntimePlatform;
  isNativeAndroid: boolean;
  isPwa: boolean;
  isMobile: boolean;
  isTv: boolean;
  isLargeUi: boolean;
  screenWidth: number;
  screenHeight: number;
  userAgent: string;
}

let cached: RuntimeInfo | null = null;

export function getRuntimeInfo(): RuntimeInfo {
  if (cached) return cached;
  cached = detectRuntime();
  return cached;
}

export function resetRuntimeCache(): void {
  cached = null;
}

function detectRuntime(): RuntimeInfo {
  if (typeof window === "undefined") {
    return {
      platform: "web",
      isNativeAndroid: false,
      isPwa: false,
      isMobile: false,
      isTv: false,
      isLargeUi: false,
      screenWidth: 0,
      screenHeight: 0,
      userAgent: "",
    };
  }

  const ua = navigator.userAgent;
  const isAndroid = /Android/i.test(ua);
  const isStandalone =
    window.matchMedia?.("(display-mode: standalone)").matches ||
    (window.navigator as Navigator & { standalone?: boolean }).standalone === true;

  const isCapacitorNative = !!window.Capacitor?.isNativePlatform?.();
  const hasAndroidBridge = !!window.AndroidBridge;
  const isNativeAndroid = isAndroid && (isCapacitorNative || hasAndroidBridge);

  let isTv = false;
  if (window.AndroidBridge?.isTv) {
    try {
      isTv = !!window.AndroidBridge.isTv();
    } catch {
      isTv = false;
    }
  }
  if (!isTv && /Android TV|GoogleTV|SmartTV|LEANBACK/i.test(ua)) {
    isTv = true;
  }
  if (typeof URLSearchParams !== "undefined") {
    const params = new URLSearchParams(window.location.search);
    if (params.get("tv") === "1") isTv = true;
  }
  if (!isTv && /leanback/i.test(ua)) {
    isTv = true;
  }

  const screenWidth = window.screen?.width ?? window.innerWidth;
  const screenHeight = window.screen?.height ?? window.innerHeight;
  const minDim = Math.min(screenWidth, screenHeight);
  const isTablet = isAndroid && minDim >= 600;

  let platform: RuntimePlatform = "web";
  if (isTv && isAndroid) {
    platform = "android-tv";
  } else if (isNativeAndroid && isTablet) {
    platform = "android-tablet";
  } else if (isNativeAndroid) {
    platform = "android-mobile";
  } else if (isStandalone) {
    platform = "pwa";
  } else {
    platform = "web";
  }

  const isMobile = platform === "android-mobile" || (!isAndroid && minDim < 600);
  const isLargeUi = platform === "android-tv" || isTablet || minDim >= 1024;

  return {
    platform,
    isNativeAndroid,
    isPwa: isStandalone && !isNativeAndroid,
    isMobile,
    isTv,
    isLargeUi,
    screenWidth,
    screenHeight,
    userAgent: ua,
  };
}

export function isAndroid(): boolean {
  return getRuntimeInfo().isNativeAndroid;
}

export function isAndroidTv(): boolean {
  return getRuntimeInfo().platform === "android-tv";
}

export function isTouchDevice(): boolean {
  if (typeof window === "undefined") return false;
  return "ontouchstart" in window || navigator.maxTouchPoints > 0;
}
