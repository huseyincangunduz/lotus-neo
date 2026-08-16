import type { XDrawDataHolder, XDrawSnapshot } from "./data-holder";
import type { XDrawSettingsConfig } from "./xdraw-settings-config";

export interface CanvasDrawToolHost {
    svgHolder: XDrawDataHolder;
    zoomFactor: { get(): number };
    settings: XDrawSettingsConfig;
    clickedCameraX: { get(): number; set(value: number): void };
    clickedCameraY: { get(): number; set(value: number): void };
    smoothedPressure: number | null;
    lastDrawPoint: { x: number; y: number } | null;
    lastErasePoint: { x: number; y: number } | null;
    currentSegmentStartPoint: { x: number; y: number } | null;
    currentSegmentStrokeWidth: number | null;
    getCanvasPointInViewBox(offsetX: number, offsetY: number): { x: number; y: number };
    captureHistorySnapshot(): XDrawSnapshot;
    pushHistorySnapshotOperation(before: XDrawSnapshot, after: XDrawSnapshot): void;
    beginGestureHistoryCapture(): void;
    finishGestureHistoryCapture(): void;
}

export class CanvasDrawTools {
    constructor(private host: CanvasDrawToolHost) {}

    shouldPanWithPointer(pointerType: string): boolean {
        return this.host.settings.mode.get() === "pointer" ||
            (this.host.settings.mode.get() === "draw" &&
                this.host.settings.stylusModeEnabled.get() &&
                pointerType === "touch");
    }

    isDrawingPointer(pointerType: string): boolean {
        return this.host.settings.mode.get() === "draw" &&
            (pointerType !== "touch" || !this.host.settings.stylusModeEnabled.get());
    }

    isErasingPointer(pointerType: string): boolean {
        return this.host.settings.drawType.get() === "erase" && this.isDrawingPointer(pointerType);
    }

    isMarkingPointer(pointerType: string): boolean {
        return this.host.settings.drawType.get() !== "erase" &&
            this.host.settings.drawType.get() !== "fill" &&
            this.isDrawingPointer(pointerType);
    }

    isFillingPointer(pointerType: string): boolean {
        return this.host.settings.drawType.get() === "fill" && this.isDrawingPointer(pointerType);
    }

    startInteraction(offsetX: number, offsetY: number, pointerType: string, strokeWidth: number): void {
        this.host.clickedCameraX.set(offsetX);
        this.host.clickedCameraY.set(offsetY);
        this.host.svgHolder.setInteractionMode("idle");

        if (this.shouldPanWithPointer(pointerType)) {
            this.host.svgHolder.setInteractionMode("pan");
            return;
        }

        if (this.isFillingPointer(pointerType)) {
            this.host.svgHolder.setInteractionMode("fill");
            const beforeSnapshot = this.host.captureHistorySnapshot();
            void this.host.svgHolder
                .fillAtCanvasPoint(offsetX, offsetY, this.host.settings.strokeColor.get())
                .then((changed) => {
                    if (!changed) {
                        return;
                    }
                    const afterSnapshot = this.host.captureHistorySnapshot();
                    this.host.pushHistorySnapshotOperation(beforeSnapshot, afterSnapshot);
                })
                .catch((error) => console.error("Boya kovasi uygulanamadi:", error));
            return;
        }

        if (this.isErasingPointer(pointerType)) {
            this.host.svgHolder.setInteractionMode("erase");
            this.host.beginGestureHistoryCapture();
            const point = this.host.getCanvasPointInViewBox(offsetX, offsetY);
            this.host.svgHolder.erasePathSegmentsAtPoint(
                point.x,
                point.y,
                this.eraseRadiusInWorld(),
            );
            this.host.lastErasePoint = point;
            return;
        }

        if (this.isMarkingPointer(pointerType)) {
            this.host.svgHolder.setInteractionMode("draw");
            this.host.beginGestureHistoryCapture();
            this.host.svgHolder.beginStroke(
                strokeWidth,
                this.host.settings.strokeColor.get(),
                this.host.settings.strokeAlpha.get(),
            );
            const point = this.host.getCanvasPointInViewBox(offsetX, offsetY);
            this.host.svgHolder.insertPoint(point.x, point.y);
            this.host.lastDrawPoint = point;
            this.host.currentSegmentStartPoint = point;
            this.host.currentSegmentStrokeWidth = strokeWidth;
        }
    }

    handleToolMove(event: PointerEvent, offsetX: number, offsetY: number): void {
        if (this.shouldPanWithPointer(event.pointerType)) {
            return;
        }

        if (this.isErasingPointer(event.pointerType)) {
            const point = this.host.getCanvasPointInViewBox(offsetX, offsetY);
            this.eraseBetweenPoints(this.host.lastErasePoint || point, point);
            this.host.lastErasePoint = point;
            return;
        }

        if (!this.isMarkingPointer(event.pointerType)) {
            return;
        }

        const strokeWidth = this.getStrokeWidthFromPressure(event);
        const point = this.host.getCanvasPointInViewBox(offsetX, offsetY);

        if (this.shouldSplitCurrentStrokeSegment(point, strokeWidth)) {
            this.host.svgHolder.stopStroke();
            this.host.svgHolder.beginStroke(
                strokeWidth,
                this.host.settings.strokeColor.get(),
                this.host.settings.strokeAlpha.get(),
            );
            if (this.host.lastDrawPoint) {
                this.host.svgHolder.insertPoint(
                    this.host.lastDrawPoint.x,
                    this.host.lastDrawPoint.y,
                );
            }
            this.host.currentSegmentStartPoint = point;
            this.host.currentSegmentStrokeWidth = strokeWidth;
        }

        this.host.svgHolder.insertPoint(point.x, point.y);
        this.host.lastDrawPoint = point;
    }

    finishInteraction(pointerType: string): void {
        const isErasing = this.isErasingPointer(pointerType);
        const isMarking = this.isMarkingPointer(pointerType);

        if (this.isMarkingPointer(pointerType)) {
            this.host.svgHolder.stopStroke();
        }

        if (isErasing || isMarking) {
            this.host.finishGestureHistoryCapture();
        }

        this.host.smoothedPressure = null;
        this.host.lastDrawPoint = null;
        this.host.lastErasePoint = null;
        this.host.currentSegmentStartPoint = null;
        this.host.currentSegmentStrokeWidth = null;
        this.host.svgHolder.setInteractionMode("idle");
    }

    getStrokeWidthFromPressure(event: PointerEvent): number {
        const baseWidth = this.host.settings.baseStrokeWidth.get();

        if (!this.host.settings.pressureWidthEnabled.get() || event.pointerType !== "pen") {
            this.host.smoothedPressure = null;
            return baseWidth;
        }

        const pressure = Math.max(0, Math.min(1, event.pressure || 0));
        const smoothing = Math.max(0, Math.min(1, this.host.settings.pressureSmoothing.get()));

        if (this.host.smoothedPressure === null) {
            this.host.smoothedPressure = pressure;
        } else {
            this.host.smoothedPressure =
                this.host.smoothedPressure * (1 - smoothing) + pressure * smoothing;
        }

        const minWidth = Math.max(1, baseWidth * 0.25);
        const maxWidth = baseWidth * 2;
        return minWidth + (maxWidth - minWidth) * this.host.smoothedPressure;
    }

    private eraseRadiusInWorld(): number {
        const scale = this.host.zoomFactor.get() || 1;
        return this.host.settings.eraserSize.get() / 2 / scale;
    }

    private eraseBetweenPoints(start: { x: number; y: number }, end: { x: number; y: number }): void {
        const radius = this.eraseRadiusInWorld();
        const distance = Math.hypot(end.x - start.x, end.y - start.y);
        const stepCount = Math.max(1, Math.ceil(distance / Math.max(1, radius)));

        for (let step = 1; step <= stepCount; step++) {
            const ratio = step / stepCount;
            this.host.svgHolder.erasePathSegmentsAtPoint(
                start.x + (end.x - start.x) * ratio,
                start.y + (end.y - start.y) * ratio,
                radius,
            );
        }
    }

    private shouldSplitCurrentStrokeSegment(
        nextPoint: { x: number; y: number },
        nextStrokeWidth: number,
    ): boolean {
        if (!this.host.currentSegmentStartPoint || this.host.currentSegmentStrokeWidth === null) {
            return false;
        }

        const widthDelta = Math.abs(nextStrokeWidth - this.host.currentSegmentStrokeWidth);
        if (widthDelta < this.host.settings.strokeSplitThreshold.get()) {
            return false;
        }

        return Math.hypot(
            nextPoint.x - this.host.currentSegmentStartPoint.x,
            nextPoint.y - this.host.currentSegmentStartPoint.y,
        ) >= this.host.settings.minSegmentLength.get();
    }
}