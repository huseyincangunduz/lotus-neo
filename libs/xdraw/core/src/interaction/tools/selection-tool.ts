import type { XDrawPoint } from "../../model/xdraw-data";
import { shapeBoundsFromPoints } from "../../utils/xdraw-shape-utils";
import type { CanvasDrawToolHost } from "./canvas-tool-host";

/** Marquee (sürükleyerek) veya tıklayarak eleman seçme. */
export class SelectionTool {
    private active = false;
    private startScreen: XDrawPoint | null = null;
    private startPoint: XDrawPoint | null = null;

    constructor(private host: CanvasDrawToolHost) { }

    get isActive(): boolean {
        return this.active;
    }

    start(offsetX: number, offsetY: number): void {
        this.host.svgHolder.finishPendingStroke();
        this.active = true;
        this.startScreen = { x: offsetX, y: offsetY };
        this.startPoint = this.host.getCanvasPointInViewBox(offsetX, offsetY);
        this.host.svgHolder.setSelectionMarquee(undefined);
        this.host.svgHolder.setInteractionMode("selection");
    }

    move(offsetX: number, offsetY: number): void {
        this.updateMarquee(offsetX, offsetY);
    }

    finish(end: XDrawPoint | undefined, cancelled: boolean): void {
        if (end) this.updateMarquee(end.x, end.y);
        if (!cancelled && end && this.startScreen && this.startPoint) {
            const isMarquee = Math.hypot(end.x - this.startScreen.x, end.y - this.startScreen.y) >= 4;
            const current = this.host.getCanvasPointInViewBox(end.x, end.y);
            if (isMarquee) {
                const bounds = shapeBoundsFromPoints(this.startPoint, current);
                this.host.svgHolder.setSelectedElements(
                    this.host.svgHolder.findElementsIntersectingRect(bounds).map((element) => element.id),
                );
            } else {
                const hit = this.host.svgHolder.findElementAtPoint(
                    current.x,
                    current.y,
                    8 / (this.host.zoomFactor.get() || 1),
                );
                this.host.svgHolder.setSelectedElements(hit ? [hit.id] : []);
            }
        }
        this.host.svgHolder.setSelectionMarquee(undefined);
        this.startScreen = null;
        this.startPoint = null;
        this.active = false;
        this.host.svgHolder.setInteractionMode("idle");
    }

    private updateMarquee(offsetX: number, offsetY: number): void {
        if (!this.startScreen || !this.startPoint) return;
        if (Math.hypot(offsetX - this.startScreen.x, offsetY - this.startScreen.y) < 4) {
            this.host.svgHolder.setSelectionMarquee(undefined);
            return;
        }
        this.host.svgHolder.setSelectionMarquee(shapeBoundsFromPoints(
            this.startPoint,
            this.host.getCanvasPointInViewBox(offsetX, offsetY),
        ));
    }
}
