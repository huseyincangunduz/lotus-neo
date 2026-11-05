import type { CanvasDrawToolHost } from "./canvas-tool-host";

export class EraserTool {
    constructor(private host: CanvasDrawToolHost) { }

    start(offsetX: number, offsetY: number): void {
        this.host.svgHolder.setInteractionMode("erase");
        this.host.beginGestureHistoryCapture();
        const point = this.host.getCanvasPointInViewBox(offsetX, offsetY);
        this.host.svgHolder.erasePathSegmentsAtPoint(point.x, point.y, this.radiusInWorld());
        this.host.lastErasePoint = point;
    }

    move(offsetX: number, offsetY: number): void {
        const point = this.host.getCanvasPointInViewBox(offsetX, offsetY);
        this.eraseBetweenPoints(this.host.lastErasePoint || point, point);
        this.host.lastErasePoint = point;
    }

    /**
     * Hareketin sonunda geçmişe tek bir silme adımı yazar.
     * Gesture history capture'ın kapatılması dağıtıcının ortak kuyruğunda yapılır (kalemle paylaşılıyor).
     */
    finish(): void {
        this.host.svgHolder.addUndoRedoForEraseWithSnapshot(this.host.svgHolder.getActiveLayerId());
    }

    private radiusInWorld(): number {
        const scale = this.host.zoomFactor.get() || 1;
        return this.host.settings.eraserSize.get() / 2 / scale;
    }

    private eraseBetweenPoints(start: { x: number; y: number }, end: { x: number; y: number }): void {
        const radius = this.radiusInWorld();
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
}
