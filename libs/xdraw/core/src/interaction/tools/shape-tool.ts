import type { XDrawPoint, XDrawShapeElement } from "../../model/xdraw-data";
import type { XDrawHistorySnapshot } from "../../state/data-holder";
import { resizeShapeBounds, shapeBoundsFromPoints, type XDrawShapeBounds, type XDrawShapeHandle } from "../../utils/xdraw-shape-utils";
import { XdrawDataUtils } from "../../utils/xdraw-data-utils";
import { ColorUtils } from "../../utils/color-utils";
import type { CanvasDrawToolHost } from "./canvas-tool-host";

/** Ekran pikseli cinsinden kenar/köşe yakalama toleransı. */
const HANDLE_TOLERANCE_PX = 8;

/** Mevcut bir shape'i taşıma / yeniden boyutlandırma oturumu. */
interface ShapeEditSession {
    shapeId: string;
    handle: XDrawShapeHandle;
    startPoint: XDrawPoint;
    originalBounds: XDrawShapeBounds;
    beforeSnapshot: XDrawHistorySnapshot | null;
    changed: boolean;
}

export class ShapeTool {
    private shapeStart: XDrawPoint | null = null;
    private activeShape: XDrawShapeElement | null = null;
    private shapeStartScreen: XDrawPoint | null = null;
    private shapeEndScreen: XDrawPoint | null = null;
    private edit: ShapeEditSession | null = null;

    constructor(private host: CanvasDrawToolHost) { }

    get isActive(): boolean {
        return Boolean(this.edit || (this.activeShape && this.shapeStart));
    }

    /** Verilen ekran noktasının altındaki shape tutamacını döner (cursor göstermek için de kullanılabilir). */
    getHandleAt(offsetX: number, offsetY: number): XDrawShapeHandle | null {
        const point = this.host.getCanvasPointInViewBox(offsetX, offsetY);
        const tolerance = HANDLE_TOLERANCE_PX / (this.host.zoomFactor.get() || 1);
        return this.host.svgHolder.findShapeHandleAtPoint(point.x, point.y, tolerance)?.handle ?? null;
    }

    /** Devam eden taşıma/boyutlandırmanın tutamacı; sürükleme sırasında cursor sabit kalsın diye. */
    get editingHandle(): XDrawShapeHandle | null {
        return this.edit?.handle ?? null;
    }

    start(offsetX: number, offsetY: number): void {
        this.host.svgHolder.finishPendingStroke();
        if (this.startEdit(offsetX, offsetY)) return;

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
        if (this.edit) {
            this.updateEdit(offsetX, offsetY);
            return;
        }
        if (!this.activeShape || !this.shapeStart) return;
        this.shapeEndScreen = { x: offsetX, y: offsetY };
        Object.assign(this.activeShape, shapeBoundsFromPoints(this.shapeStart, this.host.getCanvasPointInViewBox(offsetX, offsetY)));
        this.host.svgHolder.setShapePreview(this.activeShape);
    }

    finish(end: XDrawPoint | undefined, cancelled: boolean): void {
        if (this.edit) {
            this.finishEdit(end, cancelled);
            return;
        }
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
        if (this.edit) {
            this.finishEdit(undefined, true);
            return;
        }
        if (!this.activeShape && !this.shapeStart) return;
        this.activeShape = null;
        this.shapeStart = null;
        this.shapeStartScreen = null;
        this.shapeEndScreen = null;
        this.host.svgHolder.setShapePreview(null);
        this.host.svgHolder.setInteractionMode("idle");
    }

    // --- Mevcut shape'i taşıma / boyutlandırma ---

    private startEdit(offsetX: number, offsetY: number): boolean {
        const point = this.host.getCanvasPointInViewBox(offsetX, offsetY);
        const tolerance = HANDLE_TOLERANCE_PX / (this.host.zoomFactor.get() || 1);
        const hit = this.host.svgHolder.findShapeHandleAtPoint(point.x, point.y, tolerance);
        if (!hit) return false;
        const { x, y, width, height } = hit.shape;
        this.edit = {
            shapeId: hit.shape.id,
            handle: hit.handle,
            startPoint: point,
            originalBounds: { x, y, width, height },
            beforeSnapshot: null,
            changed: false,
        };
        this.host.svgHolder.setInteractionMode("move");
        return true;
    }

    private updateEdit(offsetX: number, offsetY: number): void {
        const edit = this.edit;
        if (!edit) return;
        const point = this.host.getCanvasPointInViewBox(offsetX, offsetY);
        const bounds = resizeShapeBounds(
            edit.originalBounds,
            edit.handle,
            point.x - edit.startPoint.x,
            point.y - edit.startPoint.y,
        );
        // Snapshot'ı ilk gerçek değişiklikten önce al; sadece tıklamada geçmişe boş adım yazılmasın.
        edit.beforeSnapshot ??= this.host.captureHistorySnapshot();
        edit.changed = this.host.svgHolder.updateShapeBounds(edit.shapeId, bounds) || edit.changed;
    }

    private finishEdit(end: XDrawPoint | undefined, cancelled: boolean): void {
        const edit = this.edit;
        if (!edit) return;
        if (end && !cancelled) this.updateEdit(end.x, end.y);
        if (cancelled) {
            if (edit.changed) this.host.svgHolder.updateShapeBounds(edit.shapeId, edit.originalBounds);
        } else if (edit.changed && edit.beforeSnapshot) {
            this.host.pushHistorySnapshotOperation(edit.beforeSnapshot, this.host.captureHistorySnapshot());
        }
        this.edit = null;
        this.host.svgHolder.setInteractionMode("idle");
    }
}
