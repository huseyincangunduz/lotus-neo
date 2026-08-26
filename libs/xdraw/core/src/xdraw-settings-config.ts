import { state, type StateOrPlain } from "@ubs-platform/neolit/core";
import { Injectable, rootInjector } from "@ubs-platform/neolit/injectables";

export const XDRAW_SETTING_KEYS = {
  appTheme: "xdraw.settings.appTheme",
  mode: "xdraw.settings.mode",
  drawType: "xdraw.settings.drawType",
  strokeColor: "xdraw.settings.strokeColor",
  strokeAlpha: "xdraw.settings.strokeAlpha",
  recentColors: "xdraw.settings.recentColors",
  baseStrokeWidth: "xdraw.settings.baseStrokeWidth",
  eraserSize: "xdraw.settings.eraserSize",
  stylusModeEnabled: "xdraw.settings.stylusModeEnabled",
  pressureWidthEnabled: "xdraw.settings.pressureWidthEnabled",
  pressureSmoothing: "xdraw.settings.pressureSmoothing",
  minSegmentLength: "xdraw.settings.minSegmentLength",
  zoomDirection: "xdraw.settings.zoomDirection",
  scaleToolSizesWithZoom: "xdraw.settings.scaleToolSizesWithZoom",
  autosaveSnapshot: "xdraw.settings.autosaveSnapshot",
  backgroundPatternMode: "xdraw.settings.backgroundPatternMode",
} as const;

type Theme = "light" | "dark";
type Mode = "pointer" | "draw";
type DrawType = "pencil" | "line" | "rectangle" | "erase" | "fill";
type ZoomDirection = 1 | -1;
type BackgroundPatternMode = 0 | 1 | 2;

interface XDrawSettingsState {
  appTheme: StateOrPlain<Theme>;
  mode: StateOrPlain<Mode>;
  drawType: StateOrPlain<DrawType>;
  strokeColor: StateOrPlain<string>;
  strokeAlpha: StateOrPlain<number>;
  recentColors: StateOrPlain<string[]>;
  baseStrokeWidth: StateOrPlain<number>;
  eraserSize: StateOrPlain<number>;
  stylusModeEnabled: StateOrPlain<boolean>;
  pressureWidthEnabled: StateOrPlain<boolean>;
  pressureSmoothing: StateOrPlain<number>;
  minSegmentLength: StateOrPlain<number>;
  zoomDirection: StateOrPlain<ZoomDirection>;
  scaleToolSizesWithZoom: StateOrPlain<boolean>;
  backgroundPatternMode: StateOrPlain<BackgroundPatternMode>;
}


interface XDrawSettingsConfigParams {
  isRecentColorTrackingSuppressed: () => boolean;
  onBackgroundPatternRestored: () => void;
}

const read = (key: string) => localStorage.getItem(key);
const readNumber = (key: string, min: number, max: number) => {
  const value = Number(read(key));
  return Number.isFinite(value) && value >= min && value <= max
    ? value
    : null;
};
const readBoolean = (key: string) => {
  const value = read(key);
  return value === "true" ? true : value === "false" ? false : null;
};

const persist = (key: string, value: unknown) => {
  localStorage.setItem(key, String(value));
};


// @Injectable({
//   providedIn: "root",
// })
export class XDrawSettingsConfig implements XDrawSettingsState {
  appTheme = state<Theme>(read(XDRAW_SETTING_KEYS.appTheme) === "dark" ? "dark" : "light");
  mode = state<Mode>(read(XDRAW_SETTING_KEYS.mode) === "draw" ? "draw" : "pointer");
  drawType = state<DrawType>(read(XDRAW_SETTING_KEYS.drawType) as any || "pencil");
  strokeColor = state<string>(read(XDRAW_SETTING_KEYS.strokeColor) || "#000000");
  strokeAlpha = state<number>(readNumber(XDRAW_SETTING_KEYS.strokeAlpha, 0, 1) ?? 1);
  recentColors = state<string[]>(JSON.parse(read(XDRAW_SETTING_KEYS.recentColors) || "[]"));
  baseStrokeWidth = state<number>(readNumber(XDRAW_SETTING_KEYS.baseStrokeWidth, 1, 100) ?? 5);
  eraserSize = state<number>(readNumber(XDRAW_SETTING_KEYS.eraserSize, 1, 100) ?? 10);
  stylusModeEnabled = state<boolean>(readBoolean(XDRAW_SETTING_KEYS.stylusModeEnabled) ?? false);
  pressureWidthEnabled = state<boolean>(readBoolean(XDRAW_SETTING_KEYS.pressureWidthEnabled) ?? true);
  pressureSmoothing = state<number>(readNumber(XDRAW_SETTING_KEYS.pressureSmoothing, 0, 1) ?? 0.5);
  minSegmentLength = state<number>(readNumber(XDRAW_SETTING_KEYS.minSegmentLength, 0, 100) ?? 1);
  zoomDirection = state<ZoomDirection>(readNumber(XDRAW_SETTING_KEYS.zoomDirection, -1, 1) === -1 ? -1 : 1);
  scaleToolSizesWithZoom = state<boolean>(readBoolean(XDRAW_SETTING_KEYS.scaleToolSizesWithZoom) ?? true);
  backgroundPatternMode = state<BackgroundPatternMode>(readNumber(XDRAW_SETTING_KEYS.backgroundPatternMode, 0, 2) as any ?? 0);

  constructor(params: XDrawSettingsConfigParams) {
    this.appTheme.subscribe((value) => persist(XDRAW_SETTING_KEYS.appTheme, value));
    this.mode.subscribe((value) => persist(XDRAW_SETTING_KEYS.mode, value));
    this.drawType.subscribe((value) => persist(XDRAW_SETTING_KEYS.drawType, value));
    this.strokeColor.subscribe((value) => persist(XDRAW_SETTING_KEYS.strokeColor, value));
    this.strokeAlpha.subscribe((value) => persist(XDRAW_SETTING_KEYS.strokeAlpha, value));
    this.recentColors.subscribe((value) => {
      if (!params.isRecentColorTrackingSuppressed()) {
        persist(XDRAW_SETTING_KEYS.recentColors, JSON.stringify(value));
      }
    });
    this.baseStrokeWidth.subscribe((value) => persist(XDRAW_SETTING_KEYS.baseStrokeWidth, value));
    this.eraserSize.subscribe((value) => persist(XDRAW_SETTING_KEYS.eraserSize, value));
    this.stylusModeEnabled.subscribe((value) => persist(XDRAW_SETTING_KEYS.stylusModeEnabled, value));
    this.pressureWidthEnabled.subscribe((value) => persist(XDRAW_SETTING_KEYS.pressureWidthEnabled, value));
    this.pressureSmoothing.subscribe((value) => persist(XDRAW_SETTING_KEYS.pressureSmoothing, value));
    this.minSegmentLength.subscribe((value) => persist(XDRAW_SETTING_KEYS.minSegmentLength, value));
    this.zoomDirection.subscribe((value) => persist(XDRAW_SETTING_KEYS.zoomDirection, value));
    this.scaleToolSizesWithZoom.subscribe((value) => persist(XDRAW_SETTING_KEYS.scaleToolSizesWithZoom, value));
    this.backgroundPatternMode.subscribe((value) => {
      persist(XDRAW_SETTING_KEYS.backgroundPatternMode, value);
      params.onBackgroundPatternRestored();
    });
  }

}

rootInjector.register(XDrawSettingsConfig, new XDrawSettingsConfig({
  isRecentColorTrackingSuppressed: () => false,
  onBackgroundPatternRestored: () => {},
  
}));