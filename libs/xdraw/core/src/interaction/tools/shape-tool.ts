import type { XDrawPoint, XDrawShapeElement } from "../../model/xdraw-data";
import { shapeBoundsFromPoints } from "../../utils/xdraw-shape-utils";
import { XdrawDataUtils } from "../../utils/xdraw-data-utils";
import { ColorUtils } from "../../utils/color-utils";
import type { CanvasDrawToolHost } from "./canvas-tool-host";

export class ShapeTool {
    private shapeStart: XDrawPoint | null = null;
    private activeShape: XDrawShapeElement | null = null;
    private shapeStartScreen: XDrawPoint | null = null;
    private shapeEndScreen: XDrawPoint | null = null;

    constructor(private host: CanvasDrawToolHost) { }

    get isActive(): boolean {
        return Boolean(this.activeShape && this.shapeStart);
    }

    start(offsetX: number, offsetY: number): void {
        this.host.svgHolder.finishPendingStroke();
        this.host.svgHolder.setInteractionMode("shape");
        this.shapeStart = this.host.getCanvasPointInViewBox(offsetX, offsetY);
        this.shapeStartScreen = { x: offsetX, y: offsetY };
        this.shapeEndScreen = this.shapeStartScreen;
        const scale = this.host.zoomFactor.get();
        this.activeShape = {
            id: XdrawDataUtils.generateUniqueId(),
            type: "shape",
            shape: this.host.settings.drawType.get() === "ellipse" ? "ellipse" : "rectangle",
            ...shapeBoundsFromPoints(this.shapeStart, this.shapeStart),
            color: ColorUtils.setColorWithAlpha(this.host.settings.strokeColor.get(), this.host.settings.strokeAlpha.get()),
            strokeWidth: this.host.settings.baseStrokeWidth.get() / scale,
        };
        this.host.svgHolder.setShapePreview(this.activeShape);
    }

    move(offsetX: number, offsetY: number): void {
        if (!this.activeShape || !this.shapeStart) return;
        this.shapeEndScreen = { x: offsetX, y: offsetY };
        Object.assign(this.activeShape, shapeBoundsFromPoints(this.shapeStart, this.host.getCanvasPointInViewBox(offsetX, offsetY)));
        this.host.svgHolder.setShapePreview(this.activeShape);
    }

    finish(end: XDrawPoint | undefined, cancelled: boolean): void {
        if (!this.activeShape || !this.shapeStart) return;
        if (end) {
            this.shapeEndScreen = end;
            Object.assign(this.activeShape, shapeBoundsFromPoints(this.shapeStart, this.host.getCanvasPointInViewBox(end.x, end.y)));
        }
        const screenBounds = this.shapeStartScreen && this.shapeEndScreen
            ? shapeBoundsFromPoints(this.shapeStartScreen, this.shapeEndScreen)
            : null;
        if (!cancelled && screenBounds && screenBounds.width >= 3 && screenBounds.height >= 3) {
            const before = this.host.captureHistorySnapshot();
            this.host.svgHolder.insertShape(this.activeShape);
            this.host.pushHistorySnapshotOperation(before, this.host.captureHistorySnapshot());
        }
        this.cancel();
    }

    cancel(): void {
        if (!this.activeShape && !this.shapeStart) return;
        this.activeShape = null;
        this.shapeStart = null;
        this.shapeStartScreen = null;
        this.shapeEndScreen = null;
        this.host.svgHolder.setShapePreview(null);
        this.host.svgHolder.setInteractionMode("idle");
    }
}
