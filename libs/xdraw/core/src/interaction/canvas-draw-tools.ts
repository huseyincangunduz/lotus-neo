import type { XDrawPoint } from "../model/xdraw-data";
import { shapeHandleCursor } from "../utils/xdraw-shape-utils";
import type { CanvasDrawToolHost } from "./tools/canvas-tool-host";
import { EraserTool } from "./tools/eraser-tool";
import { ShapeTool } from "./tools/shape-tool";
import { PenTool } from "./tools/pen-tool";
import { FillTool } from "./tools/fill-tool";
import { SelectionTool } from "./tools/selection-tool";
import { MoveTool } from "./tools/move-tool";

export type { CanvasDrawToolHost } from "./tools/canvas-tool-host";

export class CanvasDrawTools {
    private readonly eraser: EraserTool;
    private readonly shape: ShapeTool;
    private readonly pen: PenTool;
    private readonly fill: FillTool;
    private readonly selection: SelectionTool;
    private readonly move: MoveTool;
    constructor(private host: CanvasDrawToolHost) {
        this.eraser = new EraserTool(host);
        this.shape = new ShapeTool(host);
        this.pen = new PenTool(host);
        this.fill = new FillTool(host);
        this.selection = new SelectionTool(host);
        this.move = new MoveTool(host);
    }

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

    isTextPointer(): boolean {
        return this.host.settings.mode.get() === "text";
    }

    isSelectionPointer(): boolean {
        return this.host.settings.mode.get() === "selection";
    }

    isMovePointer(): boolean {
        return this.host.settings.mode.get() === "move";
    }

    isMarkingPointer(pointerType: string): boolean {
        return this.host.settings.drawType.get() !== "erase" &&
            this.host.settings.drawType.get() !== "fill" &&
            !this.isShapePointer(pointerType) &&
            this.isDrawingPointer(pointerType);
    }

    isShapePointer(pointerType: string): boolean {
        const type = this.host.settings.drawType.get();
        return (type === "rectangle" || type === "ellipse") && this.isDrawingPointer(pointerType);
    }

    isFillingPointer(pointerType: string): boolean {
        return this.host.settings.drawType.get() === "fill" && this.isDrawingPointer(pointerType);
    }

    startInteraction(offsetX: number, offsetY: number, pointerType: string, strokeWidth: number): void {
        this.host.clickedCameraX.set(offsetX);
        this.host.clickedCameraY.set(offsetY);
        this.host.svgHolder.setInteractionMode("idle");
        if (this.isSelectionPointer()) {
            this.selection.start(offsetX, offsetY);
            return;
        }
        if (this.isMovePointer()) {
            this.move.start(offsetX, offsetY);
            return;
        }
        if (this.isTextPointer()) {
            this.host.promptForTextAt(offsetX, offsetY);
            return;
        }
        if (this.shouldPanWithPointer(pointerType)) {
            this.host.svgHolder.setInteractionMode("pan");
            return;
        }

        if (this.isShapePointer(pointerType)) {
            this.shape.start(offsetX, offsetY);
            return;
        }

        if (this.isFillingPointer(pointerType)) {
            this.fill.start(offsetX, offsetY);
            return;
        }

        if (this.isErasingPointer(pointerType)) {
            this.eraser.start(offsetX, offsetY);
            return;
        }

        if (this.isMarkingPointer(pointerType)) {
            this.pen.start(offsetX, offsetY, strokeWidth);
        }
    }

    handleToolMove(event: PointerEvent, offsetX: number, offsetY: number): void {
        if (this.selection.isActive) {
            this.selection.move(offsetX, offsetY);
            return;
        }
        if (this.move.isActive) {
            this.move.move(offsetX, offsetY);
            return;
        }
        if (this.shape.isActive) {
            this.shape.move(offsetX, offsetY);
            return;
        }
        if (this.shouldPanWithPointer(event.pointerType)) {
            return;
        }

        if (this.isErasingPointer(event.pointerType)) {
            this.eraser.move(offsetX, offsetY);
            return;
        }

        if (!this.isMarkingPointer(event.pointerType)) {
            return;
        }

        this.pen.move(event, offsetX, offsetY);
    }

    /**
     * Shape aracında farenin altındaki şekle göre cursor değeri (move / *-resize).
     * Şekle denk gelmiyorsa ya da araç shape değilse boş string döner; host kendi varsayılanını kullanır.
     */
    getShapeCursorAt(offsetX: number, offsetY: number, pointerType: string): string {
        const editing = this.shape.editingHandle;
        if (editing) return shapeHandleCursor(editing);
        if (this.shape.isActive || !this.isShapePointer(pointerType)) return "";
        return shapeHandleCursor(this.shape.getHandleAt(offsetX, offsetY));
    }

    cancelShapeInteraction(): void {
        this.shape.cancel();
    }

    finishInteraction(pointerType: string, end?: XDrawPoint, cancelled = false): void {
        if (this.selection.isActive) {
            this.selection.finish(end, cancelled);
            return;
        }
        if (this.move.isActive) {
            this.move.finish(end, cancelled);
            return;
        }
        if (this.shape.isActive) {
            this.shape.finish(end, cancelled);
        }
        const isErasing = this.isErasingPointer(pointerType);
        const isMarking = this.isMarkingPointer(pointerType);

        if (this.isMarkingPointer(pointerType)) {
            this.pen.finish();
        }

        if (isErasing || isMarking) {
            this.host.finishGestureHistoryCapture();
        }
        if (isErasing) {
            this.eraser.finish();
        }
        this.host.smoothedPressure = null;
        this.host.lastDrawPoint = null;
        this.host.lastErasePoint = null;
        this.host.svgHolder.setInteractionMode("idle");
    }

    clearSelection(): void {
        this.cancelSelectionInteraction();
        this.host.svgHolder.setSelectedElements([]);
    }

    cancelSelectionInteraction(): void {
        if (this.selection.isActive) this.selection.finish(undefined, true);
        else if (this.move.isActive) this.move.finish(undefined, true);
    }

    getStrokeWidthFromPressure(event: PointerEvent): number {
        return this.pen.getStrokeWidthFromPressure(event);
    }
}
