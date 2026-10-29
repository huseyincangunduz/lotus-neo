import { cloneObjectDeep } from "../utils/clone-utils";
import { state, type State, type StateOrPlain } from "@ubs-platform/neolit/core";
import { LayerManager } from "./layer-manager";
import { ProjectDataRasterizer, type XDrawImageExportOptions } from "../rendering/data-rasterizer";
import type {
    ContentBufferDelta,
    InteractionMode,
    RenderStats,
    XDrawCanvasCamera,
    XDrawData,
    XDrawDrawElement,
    XDrawElement,
    XDrawLayer,
    XDrawTextElement,
    XDrawShapeElement,
} from "../model/xdraw-data";
import { XDRAW_MAX_POINTS_PER_ELEMENT } from "../model/xdraw-data";
import { XdrawDataUtils } from "../utils/xdraw-data-utils";
import { ColorUtils } from "../utils/color-utils";
import { shapeContainsPoint } from "../utils/xdraw-shape-utils";
import {
    cloneXDrawElementsAtPoint,
    getXDrawElementBounds,
    xdrawElementBoundsIntersectsRect,
    translateXDrawElement,
    xdrawElementContainsPoint,
    type XDrawElementBounds,
} from "../utils/xdraw-selection-utils";
import { decodeXDrawDataFromBuffer, encodeXDrawDataToBuffer, type XDrawSkeleton } from "../utils/xdraw-binary-codec";
import { UndoRedoHelper } from "@libs/utils/undo-redo-helper";
export type { InteractionMode, RenderStats, XDrawCanvasCamera } from "../model/xdraw-data";

export interface CursorPosition {
    x: number;
    y: number;
    size: number;
    color: string;
    type: "filled" | "outlined";
}

// Anlik goruntu artik SVG metni yerine XDrawData'yi tasir.
export interface XDrawSnapshot {
    data: XDrawData;
    activeLayerId: string;
}

// Undo/redo yiginindaki her adim icin points/rings JSON metni yerine dogrudan
// Float32Array olarak tutulur (bkz. xdraw-binary-codec.ts); stringify/parse'daki
// sayi<->metin donusumu hic yapilmaz, sadece typed array kopyalanir.
export interface XDrawHistorySnapshot {
    skeleton: XDrawSkeleton;
    buffer: Float32Array;
    activeLayerId: string;
}

export class XDrawDataHolder {


    xdrawData: XDrawData = { layers: [] };
    private _activeCanvas: HTMLCanvasElement | null = null;
    private layerManager: LayerManager;
    private rasterizer = new ProjectDataRasterizer();
    private interactionMode: InteractionMode = "idle";
    // Kamera: {x, y} dunya koordinatinda sol-ust kose, scale = dunya birimi basina ekran pikseli.
    private _viewCamera: XDrawCanvasCamera = { x: 0, y: 0, scale: 1 };
    private _cursorPosition: CursorPosition | undefined = undefined;
    // Su an cizilmekte olan aktif stroke elementi.
    private activeDrawElement: XDrawDrawElement | null = null;
    // Aktif firca genisligi ekran pikseli cinsinden; noktalar dunya birimine cevrilerek saklanir.
    private activeStrokeWidth = 1;
    private activeStrokeColor = "#000000";
    layersState: State<XDrawLayer[]> = state<XDrawLayer[]>([]);
    activeLayerId: State<string> = state("base");
    stopStrokeTimeout: number | undefined = undefined;
    breakBeforeNextPoint: boolean = false;
    undoRedoHelper: UndoRedoHelper = new UndoRedoHelper(10);
    insertedElements: XDrawElement[] = [];
    // Elementler json array olacak
    activeLayerSnapshotBeforeErase: XDrawElement[] | null = null;
    private selectedElementIds: string[] = [];
    readonly selectedElementCount = state(0);
    readonly clipboardAvailable = state(false);
    private clipboardElements: XDrawElement[] = [];

    constructor() {
        this.layerManager = new LayerManager(this.xdrawData, "base");
        this.syncLayersState();
        this.rasterizer.setViewCamera(this._viewCamera);
    }

    get renderStats(): State<RenderStats> {
        return state({
            fps: 0,
            renderMs: 0,
            bitmapFallbackCount: 0,
        });
    }

    getActiveLayerOpacity(): StateOrPlain<number> | undefined {
        return this.layerManager.getActiveLayer()?.opacity || 0;
    }

    // Arka plan deseni henuz cizilmiyor; API uyumlulugu icin korunuyor.
    setBackgroundPattern(state: 0 | 1 | 2): void {
        this.rasterizer.setBackgroundPattern(state);
        // TODO: Arka plan deseni render'i eklenecek.
    }

    setInvertLightness(enabled: boolean): void {
        this.rasterizer.setInvertLightness(enabled);
    }

    createLayer(layerId?: string, options?: { opacity?: number; visible?: boolean; insertBeforeLayerId?: string; }): XDrawLayer {
        let createdLayer: XDrawLayer | undefined = this.layerManager.createLayer(layerId, options);
        this.undoRedoHelper.pushOperationQueue({
            apply: () => {
                this.layerManager.addLayer(createdLayer!);
            },
            revert: () => {
                this.layerManager.deleteLayer(createdLayer!.id);
            },
            finally: () => {
                this.syncLayersState();
            },
            dispose: () => {
                createdLayer = undefined
            }
        }, true, false);
        this.syncLayersState();
        this.setActiveLayer(createdLayer!.id);
        return createdLayer!;
    }

    setActiveLayer(layerId: string): XDrawLayer {
        const activeLayer = this.layerManager.setActiveLayer(layerId);
        this.activeLayerId.set(layerId);
        return activeLayer;
    }

    getActiveLayerId(): string {
        return this.layerManager.getActiveLayerId();
    }

    deleteLayer(layerId: string): boolean {
        let layer: XDrawLayer | null | undefined = this.layerManager.getLayer(layerId);
        if (!layer) {
            return false;
        }

        this.undoRedoHelper.pushOperationQueue({
            apply: () => {
                this.layerManager.deleteLayer(layerId);
            },
            revert: () => {
                this.layerManager.addLayer(layer!);
            },
            dispose: () => {
                layer = undefined;
            },
            finally: () => {
                this.syncLayersState();
            }
        }, true, false);
        const deleted = this.layerManager.deleteLayer(layerId);
        if (deleted) {
            this.syncLayersState();
            this.activeLayerId.set(this.getActiveLayerId());

        }
        return deleted;
    }

    // Surukleme sirasinda (onChange) her tik icin cagrilir; undo yigina hicbir sey eklemez.
    // Boylece slider surukleme tek bir undo adimi yerine yuzlerce adima bolunmuyor.
    setLayerOpacityLive(layerId: string, opacity: number): void {
        this.layerManager.setLayerOpacity(layerId, opacity);
        this.layersState.set(this.layerManager.listLayers());
        this.rasterizer.updateProjectDataLocally(
            this.xdrawData,
            [{
                operation: "set-layer-opacity",
                layerId,
                layerOpacity: opacity,
            }]
        );
        this.refreshSelectionBounds();
    }

    // Surukleme bittiginde (onChangeEnd) tek seferlik commit. previousOpacity verilmezse
    // mevcut deger baz alinir; live guncellemelerden sonra cagrildigi icin caller surukleme
    // basindaki gercek eski degeri previousOpacity olarak vermeli, aksi halde undo sadece
    // son live tike doner.
    setLayerOpacity(layerId: string, opacity: number, previousOpacity?: number): void {
        const oldOpacity = previousOpacity ?? (this.layerManager.getLayer(layerId)?.opacity ?? 1);
        if (oldOpacity === opacity) {
            return;
        }
        this.layerManager.setLayerOpacity(layerId, opacity);
        this.syncLayersState();
        this.undoRedoHelper.pushOperationQueue({
            apply: () => {
                this.layerManager.setLayerOpacity(layerId, opacity);
                this.syncLayersState();
            },
            revert: () => {
                this.layerManager.setLayerOpacity(layerId, oldOpacity);
                this.syncLayersState();
            }
        }, true, false);
    }

    setLayerVisible(layerId: string, visible: boolean): void {
        this.layerManager.setLayerVisible(layerId, visible);
        this.syncLayersState();
    }

    getLayersState(): State<XDrawLayer[]> {
        return this.layersState;
    }

    setViewCamera(camera: XDrawCanvasCamera): void {
        this._viewCamera = camera;
        this.rasterizer.setViewCamera(camera);
    }

    setActiveCanvas(canvas: HTMLCanvasElement) {
        this._activeCanvas = canvas;
        this.rasterizer.setActiveCanvas(canvas);
        this.rasterizer.setProjectData(this.xdrawData);
    }

    getXdrawData(): XDrawData {
        return this.xdrawData;
    }

    getContentBounds(): { x: number; y: number; width: number; height: number } | null {
        let minX = Infinity;
        let minY = Infinity;
        let maxX = -Infinity;
        let maxY = -Infinity;
        const includePoint = (x: number, y: number, padding = 0) => {
            minX = Math.min(minX, x - padding);
            minY = Math.min(minY, y - padding);
            maxX = Math.max(maxX, x + padding);
            maxY = Math.max(maxY, y + padding);
        };

        for (const layer of this.xdrawData.layers) {
            if (layer.visible === false || layer.opacity === 0) continue;
            for (const element of layer.elements) {
                if (element.type === "draw") {
                    for (const point of (element as XDrawDrawElement).points) {
                        includePoint(point.x, point.y, point.size / 2);
                    }
                } else if (element.type === "fill") {
                    for (const ring of (element as any).rings) {
                        for (const point of ring) includePoint(point.x, point.y);
                    }
                } else if (element.type === "text") {
                    const text = element as XDrawTextElement;
                    includePoint(text.position.x, text.position.y);
                    includePoint(text.position.x + text.fontSize * text.text.length, text.position.y + text.fontSize);
                } else if (element.type === "shape") {
                    const shape = element as XDrawShapeElement;
                    includePoint(shape.x, shape.y, shape.strokeWidth / 2);
                    includePoint(shape.x + shape.width, shape.y + shape.height, shape.strokeWidth / 2);
                }
            }
        }
        if (!Number.isFinite(minX)) return null;
        const padding = 24;
        return { x: minX - padding, y: minY - padding, width: Math.max(1, maxX - minX + padding * 2), height: Math.max(1, maxY - minY + padding * 2) };
    }

    exportImage(options: XDrawImageExportOptions): Promise<Blob> {
        return this.rasterizer.exportImage(options);
    }

    getActiveCanvas(): HTMLCanvasElement | null {
        return this._activeCanvas;
    }

    setInteractionMode(mode: InteractionMode): void {
        this.interactionMode = mode;
        this.rasterizer.setInteractionMode(mode);
    }

    captureDrawingSnapshot(): XDrawSnapshot {
        return {
            data: XdrawDataUtils.deepCopyXDrawData(this.xdrawData),
            activeLayerId: this.getActiveLayerId(),
        };
    }

    captureDrawingSnapshotForPersistence(): XDrawSnapshot {
        return {
            data: this.xdrawData,
            activeLayerId: this.getActiveLayerId(),
        };
    }

    async restoreDrawingSnapshot(snapshot: XDrawSnapshot): Promise<void> {
        this.applyRestoredData(XdrawDataUtils.deepCopyXDrawData(snapshot.data), snapshot.activeLayerId);
    }

    async restoreDrawingSnapshotFromPersistence(snapshot: XDrawSnapshot): Promise<void> {
        this.applyRestoredData(
            XdrawDataUtils.optimizeXDrawData(snapshot.data),
            snapshot.activeLayerId,
        );
    }

    // Undo/redo yiginindaki hafif varyant: points/rings dogrudan Float32Array'e yazilir.
    captureUndoSnapshot(): XDrawHistorySnapshot {
        const { skeleton, buffer } = encodeXDrawDataToBuffer(this.xdrawData);
        return { skeleton, buffer, activeLayerId: this.getActiveLayerId() };
    }

    // Buffer'dan obje agaci burada kurulur, yani sadece gercekten undo/redo yapilirken calisir.
    async restoreUndoSnapshot(snapshot: XDrawHistorySnapshot): Promise<void> {
        this.applyRestoredData(decodeXDrawDataFromBuffer(snapshot.skeleton, snapshot.buffer), snapshot.activeLayerId);
    }

    private applyRestoredData(data: XDrawData, requestedActiveLayerId: string): void {
        this.xdrawData = data;
        const activeLayerId = this.xdrawData.layers.some((layer) => layer.id === requestedActiveLayerId)
            ? requestedActiveLayerId
            : (this.xdrawData.layers[0]?.id ?? "base");
        this.layerManager = new LayerManager(this.xdrawData, activeLayerId);
        this.activeLayerId.set(activeLayerId);
        this.activeDrawElement = null;
        this.syncLayersState();
        this.rasterizer.setActiveDrawElement(null);
        this.rasterizer.setActiveShapeElement(null);
        this.rasterizer.invalidateContentBuffer();
        this.rasterizer.setProjectData(this.xdrawData);
        this.refreshSelectionBounds();
    }

    // Yeni bir stroke baslatir. width ekran pikseli cinsinden firca genisligidir.
    beginStroke(width: number, color: string = "#000000", alpha: number = 1): void {
        const colorRegularized = ColorUtils.setColorWithAlpha(color, alpha);
        if (this.activeDrawElement) {
            if (this.activeStrokeColor === colorRegularized) {
                this.breakBeforeNextPoint = true;
                this.activeStrokeWidth = width;
                return; // Henuz bitmemis bir stroke varsa, yeni stroke baslatilmaz.
            }
            else {
                this.stopStrokeImmediately();
            }
        }
        this.activeStrokeWidth = width;
        this.activeStrokeColor = colorRegularized;
        this.activeDrawElement = {
            id: XdrawDataUtils.generateUniqueId(),
            type: "draw",
            color: this.activeStrokeColor,
            points: [],
            finalized: false,
        };
        this.insertedElements.push(this.activeDrawElement);
        this.layerManager.getActiveLayer().elements.push(this.activeDrawElement);
        this.rasterizer.setActiveDrawElement(this.activeDrawElement, this.layerManager.getActiveLayer().opacity ?? 1);
    }

    setActiveStrokeWidth(width: number): void {
        this.activeStrokeWidth = width;
    }

    // Ekran koordinatindan gelen (fakat host tarafindan dunya koordinatina cevrilmis)
    // noktayi aktif stroke'a ekler. Firca genisligi dunya birimine cevrilir.
    insertPoint(worldX: number, worldY: number): void {
        if (this.stopStrokeTimeout) {
            clearTimeout(this.stopStrokeTimeout);
            this.stopStrokeTimeout = undefined;
        }
        if (!this.activeDrawElement) {
            return;
        }
        let finalizedChunk = false;
        if (this.activeDrawElement.points.length >= XDRAW_MAX_POINTS_PER_ELEMENT) {
            // Tanida amacli: bu dal "donup duz cizgi atma" supheli nedenlerden biri (bkz. rebuildContentBuffer log'u).
            console.debug(`[xdraw-perf] chunk split at ${this.activeDrawElement.points.length} points`);
            const previousPoint = this.activeDrawElement.points[this.activeDrawElement.points.length - 1];
            this.activeDrawElement.finalized = true;
            this.activeDrawElement = {
                id: XdrawDataUtils.generateUniqueId(),
                type: "draw",
                color: this.activeStrokeColor,
                points: [previousPoint],
                finalized: false,
            };
            this.insertedElements.push(this.activeDrawElement);
            this.layerManager.getActiveLayer().elements.push(this.activeDrawElement);
            // Onceki parca finalize oldu; buffer'a girmesi icin yeniden olusturulmasi gerekir.
            this.rasterizer.invalidateContentBuffer();
            this.rasterizer.setActiveDrawElement(this.activeDrawElement, this.layerManager.getActiveLayer().opacity ?? 1);
            finalizedChunk = true;
        }
        const size = this.activeStrokeWidth / this._viewCamera.scale;
        this.activeDrawElement.points.push({ x: worldX, y: worldY, size, breakBefore: this.breakBeforeNextPoint });
        this.breakBeforeNextPoint = false;
        if (finalizedChunk) {
            this.rasterizer.setProjectData(this.xdrawData, this.insertedElements.map(
                a => {
                    return { operation: "upsert-element", elementId: a.id, type: a.type as any, points: (a as XDrawDrawElement).points, };
                }
            ));
        } else {
            this.rasterizer.requestRender();
        }
    }

    stopStroke(): void {
        if (!this.activeDrawElement || !this.activeDrawElement.points.length) {
            return;
        }
        // this.activeDrawElement.points[this.activeDrawElement.points.length - 1].breakBefore = true;
        this.stopStrokeTimeout = setTimeout(() => {
            this.stopStrokeImmediately();
        }, 500);
    }

    finishPendingStroke(): void {
        if (this.stopStrokeTimeout !== undefined) {
            clearTimeout(this.stopStrokeTimeout);
            this.stopStrokeTimeout = undefined;
        }
        if (this.activeDrawElement) this.stopStrokeImmediately();
    }

    private stopStrokeImmediately() {
        if (this.activeDrawElement) {
            this.activeDrawElement.finalized = true;
        }
        this.activeDrawElement = null;
        this.rasterizer.setActiveDrawElement(null);
        this.rasterizer.invalidateContentBuffer();
        this.rasterizer.setProjectData(this.xdrawData);

        const cloneStart = performance.now();
        let insertedElementsSnapshot = cloneObjectDeep(this.insertedElements);
        // Tanida amacli: uzun surenlerini yakalar, bkz. rebuildContentBuffer log'u.
        const cloneMs = performance.now() - cloneStart;
        if (cloneMs > 16) {
            console.debug(`[xdraw-perf] stopStrokeImmediately clone ${cloneMs.toFixed(1)}ms (elements=${insertedElementsSnapshot.length})`);
        }
        const activeLayerId = this.getActiveLayerId();
        this.undoRedoHelper.pushOperationQueue({
            apply: () => {
                const activeLayer = this.layerManager.getLayer(activeLayerId)
                if (!activeLayer) {
                    return;
                }
                activeLayer.elements.push(...cloneObjectDeep(insertedElementsSnapshot));
            },
            revert: () => {
                const activeLayer = this.layerManager.getLayer(activeLayerId)
                if (!activeLayer) {
                    return;
                }
                activeLayer.elements = activeLayer.elements.filter(el => !insertedElementsSnapshot.find(el2 => el2.id === el.id));

                // this.insertedElements = insertedElements;
            },
            finally: () => {
                this.rasterizer.invalidateContentBuffer();
                this.rasterizer.setProjectData(this.xdrawData);
            },
            dispose: () => {
                insertedElementsSnapshot = undefined as any;
            }
        }, true, false);
        this.insertedElements = [];
    }

    // Boya kovasi henuz XDrawData icin uygulanmadi.
    async fillAtCanvasPoint(
        _canvasX: number,
        _canvasY: number,
        _color: string,
        _tolerance: number = 24,
    ): Promise<boolean> {
        const worldX = this._viewCamera.x + _canvasX / this._viewCamera.scale;
        const worldY = this._viewCamera.y + _canvasY / this._viewCamera.scale;

        // Maske yalniz aktif katmandan, kamera olceginde uretilir; diger katmanlar,
        // grid ve cursor dolgu sinirlarini etkilemez.
        const mask = this.rasterizer.createActiveLayerFillMask(this.getActiveLayerId());
        if (!mask) {
            return false;
        }

        const changed = XdrawDataUtils.fillDye(this.layerManager.getActiveLayer(), mask, worldX, worldY, _color);
        if (changed) {
            this.rasterizer.invalidateContentBuffer();
            this.rasterizer.setProjectData(this.xdrawData);
        }
        return changed;
    }

    // x, y ve radius dunya koordinatindadir.
    erasePathSegmentsAtPoint(x: number, y: number, radius: number): boolean {
        const activeLayer = this.layerManager.getActiveLayer();
        if (!this.activeLayerSnapshotBeforeErase) {
            this.activeLayerSnapshotBeforeErase = cloneObjectDeep(activeLayer.elements);
        }
        const removalResult = XdrawDataUtils.removePointsAt(activeLayer.elements, x, y, radius);
        activeLayer.elements = removalResult.elements;
        if (removalResult.hasChanges) {
            this.rasterizer.setProjectData(this.xdrawData, removalResult.removedPoints);
            this.refreshSelectionBounds();
        }

        return removalResult.hasChanges;

    }

    setCursorPosition(position: CursorPosition | undefined) {
        this._cursorPosition = position;
        this.rasterizer.setCursorPosition(position);
    }

    getCursorPosition(): CursorPosition | undefined {
        return this._cursorPosition;
    }

    findNearestPointHasElement(degrees: number) {
        return XdrawDataUtils.findNearestPointInElement(this.xdrawData, this._viewCamera.x, this._viewCamera.y, this._viewCamera.scale, degrees);

        // throw new Error("Method not implemented.");
    }

    private syncLayersState(): void {
        this.layersState.set(this.layerManager.listLayers());
        this.rasterizer.updateProjectDataLocally(this.xdrawData);
        this.refreshSelectionBounds();
    }

    addUndoRedoForEraseWithSnapshot(activeLayerId: string) {
        if (!this.activeLayerSnapshotBeforeErase) {
            return;
        }
        let beforeEraseSnapshot = cloneObjectDeep(this.activeLayerSnapshotBeforeErase);
        let currentSnapshotAfterRemoval = cloneObjectDeep(this.layerManager.getLayer(activeLayerId)!.elements);
        // let mode: "apply" | "revert" = "apply";
        this.undoRedoHelper.pushOperationQueue({
            apply: async () => {
                // Do nothing, changes are already applied
                this.layerManager.getLayer(activeLayerId)!.elements = cloneObjectDeep(currentSnapshotAfterRemoval);
                // mode = "apply";
            },
            revert: async () => {
                this.layerManager.getLayer(activeLayerId)!.elements = cloneObjectDeep(beforeEraseSnapshot);
                // mode = "revert";
            },
            dispose: () => {
                beforeEraseSnapshot = undefined as any;
                currentSnapshotAfterRemoval = undefined as any;
            },
            finally: () => {
                this.rasterizer.invalidateContentBuffer();
                this.rasterizer.setProjectData(this.xdrawData);
            }
        }, true, false);
        this.activeLayerSnapshotBeforeErase = null;
    }

    setShapePreview(shape: XDrawShapeElement | null): void {
        const layer = this.layerManager.getActiveLayer();
        this.rasterizer.setActiveShapeElement(shape, layer.visible === false ? 0 : layer.opacity ?? 1);
    }

    insertShape(shape: XDrawShapeElement): void {
        const element = cloneObjectDeep(shape);
        this.layerManager.getActiveLayer().elements.push(element);
        this.rasterizer.setProjectData(this.xdrawData, [{
            operation: "upsert-element",
            layerId: this.getActiveLayerId(),
            elementId: shape.id,
            type: "shape",
            upsertData: element,
        }]);
    }

    findShapeAtPoint(x: number, y: number): XDrawShapeElement | null {
        for (let layerIndex = this.xdrawData.layers.length - 1; layerIndex >= 0; layerIndex--) {
            const layer = this.xdrawData.layers[layerIndex];
            if (layer.visible === false || layer.opacity === 0) continue;
            for (let index = layer.elements.length - 1; index >= 0; index--) {
                const element = layer.elements[index];
                if (element.type === "shape" && shapeContainsPoint(element as XDrawShapeElement, x, y)) {
                    return element as XDrawShapeElement;
                }
            }
        }
        return null;
    }

    findElementAtPoint(x: number, y: number, tolerance: number): XDrawElement | null {
        for (let layerIndex = this.xdrawData.layers.length - 1; layerIndex >= 0; layerIndex--) {
            const layer = this.xdrawData.layers[layerIndex];
            if (layer.visible === false || layer.opacity === 0) continue;
            for (let index = layer.elements.length - 1; index >= 0; index--) {
                const element = layer.elements[index];
                if (xdrawElementContainsPoint(element, x, y, tolerance)) return element;
            }
        }
        return null;
    }

    findElementsIntersectingRect(rect: XDrawElementBounds): XDrawElement[] {
        const found: XDrawElement[] = [];
        for (const layer of this.xdrawData.layers) {
            if (layer.visible === false || layer.opacity === 0) continue;
            for (const element of layer.elements) {
                const bounds = getXDrawElementBounds(element);
                if (bounds && xdrawElementBoundsIntersectsRect(bounds, rect)) found.push(element);
            }
        }
        return found;
    }

    getSelectedElementIds(): string[] {
        return [...this.selectedElementIds];
    }

    copySelectedElements(): boolean {
        const ids = new Set(this.selectedElementIds);
        const elements = this.xdrawData.layers.flatMap((layer) =>
            layer.elements.filter((element) => ids.has(element.id)));
        if (elements.length === 0) {
            console.warn("No selected elements to copy.");
            return false;
        }
        this.clipboardElements = cloneObjectDeep(elements);
        this.clipboardAvailable.set(true);
        return true;
    }

    cutSelectedElements(): boolean {
        if (!this.copySelectedElements()) return false;
        const ids = new Set(this.selectedElementIds);
        const deltas: ContentBufferDelta[] = [];
        for (const layer of this.xdrawData.layers) {
            for (const element of layer.elements) {
                if (ids.has(element.id)) {
                    deltas.push({ operation: "remove-element", layerId: layer.id, elementId: element.id });
                }
            }
            layer.elements = layer.elements.filter((element) => !ids.has(element.id));
        }
        this.rasterizer.setProjectData(this.xdrawData, deltas);
        this.setSelectedElements([]);
        return true;
    }

    pasteClipboardAtPoint(x: number, y: number): boolean {
        if (this.clipboardElements.length === 0) {
            console.warn("No elements in the XDraw clipboard.");
            return false;
        }
        const elements = cloneXDrawElementsAtPoint(
            this.clipboardElements, x, y, () => XdrawDataUtils.generateUniqueId(),
        );
        const layer = this.layerManager.getActiveLayer();
        layer.elements.push(...elements);
        this.rasterizer.setProjectData(this.xdrawData, elements.map((element) => ({
            operation: "upsert-element", layerId: layer.id, elementId: element.id, upsertData: element,
        })));
        this.setSelectedElements(elements.map((element) => element.id));
        return true;
    }

    setSelectionMarquee(bounds: XDrawElementBounds | undefined): void {
        this.rasterizer.setSelectionMarquee(bounds);
    }

    setSelectedElements(ids: string[]): void {
        const visibleIds = new Set(
            this.xdrawData.layers
                .filter((layer) => layer.visible !== false && layer.opacity !== 0)
                .flatMap((layer) => layer.elements.map((element) => element.id)),
        );
        this.selectedElementIds = [...new Set(ids)].filter((id) => visibleIds.has(id));
        this.refreshSelectionBounds();
    }

    moveElementsBy(ids: string[], deltaX: number, deltaY: number): boolean {
        const selectedIds = new Set(ids);
        const deltas: ContentBufferDelta[] = [];
        for (const layer of this.xdrawData.layers) {
            for (const element of layer.elements) {
                if (!selectedIds.has(element.id) || !translateXDrawElement(element, deltaX, deltaY)) continue;
                deltas.push({
                    operation: "upsert-element",
                    layerId: layer.id,
                    elementId: element.id,
                    type: element.type as "draw" | "fill" | "text" | "shape",
                    upsertData: element,
                });
            }
        }
        if (deltas.length === 0) return false;
        this.rasterizer.setProjectData(this.xdrawData, deltas);
        this.refreshSelectionBounds();
        return true;
    }

    private refreshSelectionBounds(): void {
        const elementsById = new Map(
            this.xdrawData.layers
                .filter((layer) => layer.visible !== false && layer.opacity !== 0)
                .flatMap((layer) => layer.elements.map((element) => [element.id, element] as const)),
        );
        this.selectedElementIds = this.selectedElementIds.filter((id) => elementsById.has(id));
        this.selectedElementCount.set(this.selectedElementIds.length);
        const bounds = this.selectedElementIds
            .map((id) => elementsById.get(id))
            .filter((element): element is XDrawElement => element !== undefined)
            .map(getXDrawElementBounds)
            .filter((elementBounds): elementBounds is XDrawElementBounds => elementBounds !== null);
        this.rasterizer.setSelectionBounds(bounds);
    }

    updateShapeLabel(id: string, label: XDrawShapeElement["label"]): boolean {
        for (const layer of this.xdrawData.layers) {
            const index = layer.elements.findIndex(element => element.id === id && element.type === "shape");
            if (index < 0) continue;
            const shape: XDrawShapeElement = { ...layer.elements[index] as XDrawShapeElement, label };
            layer.elements[index] = shape;
            this.rasterizer.setProjectData(this.xdrawData, [{
                operation: "upsert-element", layerId: layer.id, elementId: id, type: "shape", upsertData: shape,
            }]);
            return true;
        }
        console.warn("Metni duzenlenecek shape bulunamadi:", id);
        return false;
    }

    insertTextAtCanvasPoint(
        offsetX: number,
        offsetY: number,
        textPrompt: string,
        color: string,
        options?: { fontFamily?: string; fontSize?: number; fontWeight?: "normal" | "bold" },
    ) {
        const activeLayer = this.layerManager.getActiveLayer();
        if (!activeLayer) {
            return;
        }
        let textConfig = {
            id: XdrawDataUtils.generateUniqueId(),
            type: "text",
            fontFamily: options?.fontFamily || "system-ui",
            text: textPrompt,
            partial: false,
            color,
            finalized: true,
            fontSize: options?.fontSize || 16,
            fontWeight: options?.fontWeight || "normal",
            position: { x: offsetX, y: offsetY },
        } as XDrawTextElement

        this.undoRedoHelper.pushOperationQueue(
            {
                apply: async () => {
                    activeLayer.elements.push(textConfig);

                },
                revert: async () => {
                    activeLayer.elements = activeLayer.elements.filter(el => el.id !== textConfig.id);

                },
                finally: async () => {
                    this.rasterizer.invalidateContentBuffer();
                    this.rasterizer.setProjectData(this.xdrawData);
                },
                dispose: () => {
                    // Clean up any resources if necessary
                    textConfig = undefined as any;
                }
            },
            true,
            true
        );

        // activeLayer.elements.push(textConfig);
        // this.rasterizer.invalidateContentBuffer();
        // this.rasterizer.setProjectData(this.xdrawData);
    }

}
