import type { XDrawDataHolder, XDrawHistorySnapshot } from "./data-holder";
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
    getCanvasPointInViewBox(offsetX: number, offsetY: number): { x: number; y: number };
    captureHistorySnapshot(): XDrawHistorySnapshot;
    pushHistorySnapshotOperation(before: XDrawHistorySnapshot, after: XDrawHistorySnapshot): void;
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

        // Kalinlik nokta bazinda tasiniyor; rasterizer size degisiminde zaten yeni alt-path aciyor.
        this.host.svgHolder.setActiveStrokeWidth(strokeWidth);

        if (this.isBelowMinSegmentLength(point)) {
            return;
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
        const width = minWidth + (maxWidth - minWidth) * this.host.smoothedPressure;
        // Yarim piksele yuvarlanir: rasterizer her size degisiminde yeni alt-path actigi icin
        // yuvarlanmamis degerler nokta basina bir Path2D segmenti uretirdi.
        return Math.round(width * 2) / 2;
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

    // minSegmentLength ekran pikseli cinsindendir; karsilastirma dunya mesafesi degil ekran mesafesi uzerinden yapilir.
    private isBelowMinSegmentLength(nextPoint: { x: number; y: number }): boolean {
        const lastPoint = this.host.lastDrawPoint;
        if (!lastPoint) {
            return false;
        }

        const scale = this.host.zoomFactor.get() || 1;
        const dx = (nextPoint.x - lastPoint.x) * scale;
        const dy = (nextPoint.y - lastPoint.y) * scale;
        const minStep = this.host.settings.minSegmentLength.get();
        return dx * dx + dy * dy < minStep * minStep;
    }
}