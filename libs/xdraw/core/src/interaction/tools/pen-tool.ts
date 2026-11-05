import type { CanvasDrawToolHost } from "./canvas-tool-host";

export class PenTool {
    constructor(private host: CanvasDrawToolHost) { }

    start(offsetX: number, offsetY: number, strokeWidth: number): void {
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

    move(event: PointerEvent, offsetX: number, offsetY: number): void {
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

    /** Çizgiyi bitirir. Gesture history capture'ın kapatılması dağıtıcının ortak kuyruğunda yapılır. */
    finish(): void {
        this.host.svgHolder.stopStroke();
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
