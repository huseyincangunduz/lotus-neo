import type { XDrawDataHolder, XDrawHistorySnapshot } from "../../state/data-holder";
import type { XDrawSettingsConfig } from "../../settings/xdraw-settings-config";

export interface CanvasDrawToolHost {
    svgHolder: XDrawDataHolder;
    zoomFactor: { get(): number };
    settings: XDrawSettingsConfig;
    clickedCameraX: { get(): number; set(value: number): void };
    clickedCameraY: { get(): number; set(value: number): void };
    smoothedPressure: number | null;
    lastDrawPoint: { x: number; y: number } | null;
    lastErasePoint: { x: number; y: number } | null;
    getCanvasPointInViewBox(offsetX: number, offsetY: number): { x: number; y: number };
    captureHistorySnapshot(): XDrawHistorySnapshot;
    pushHistorySnapshotOperation(before: XDrawHistorySnapshot, after: XDrawHistorySnapshot): void;
    beginGestureHistoryCapture(): void;
    finishGestureHistoryCapture(): void;
    restoreHistorySnapshot(snapshot: XDrawHistorySnapshot): Promise<void>;
    // UI concern (dialog/prompt) belongs to the host, not to this generic tool.
    promptForTextAt(offsetX: number, offsetY: number): void;
}
