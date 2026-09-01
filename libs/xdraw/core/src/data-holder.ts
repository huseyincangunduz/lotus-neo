import { state, type State, type StateOrPlain } from "@ubs-platform/neolit/core";
import { LayerManager } from "./layer-manager";
import { ProjectDataRasterizer } from "./data-rasterizer";
import type {
    InteractionMode,
    RenderStats,
    XDrawCanvasCamera,
    XDrawData,
    XDrawDrawElement,
    XDrawElement,
    XDrawLayer,
} from "./xdraw-data";
import { XDRAW_MAX_POINTS_PER_ELEMENT } from "./xdraw-data";
import { XdrawDataUtils } from "./xdraw-data-utils";
import { ColorUtils } from "./color-utils";
import { decodeXDrawDataFromBuffer, encodeXDrawDataToBuffer, type XDrawSkeleton } from "./xdraw-binary-codec";
import { UndoRedoHelper } from "@libs/utils/undo-redo-helper";
export type { InteractionMode, RenderStats, XDrawCanvasCamera } from "./xdraw-data";

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
    undoRedoHelper: UndoRedoHelper = new UndoRedoHelper();
    insertedElements: XDrawElement[] = [];

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

    createLayer(layerId?: string, options?: { opacity?: number; visible?: boolean; insertBeforeLayerId?: string; }): XDrawLayer {
        const createdLayer = this.layerManager.createLayer(layerId, options);
        this.undoRedoHelper.pushOperationQueue({
            apply: () => {
                this.layerManager.addLayer(createdLayer);
            },
            revert: () => {
                this.layerManager.deleteLayer(createdLayer.id);
            }
        }, true, false);
        this.syncLayersState();
        this.setActiveLayer(createdLayer.id);
        return createdLayer;
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
        const layer = this.layerManager.getLayer(layerId);
        if (!layer) {
            return false;
        }

        this.undoRedoHelper.pushOperationQueue({
            apply: () => {
                this.layerManager.deleteLayer(layerId);
            },
            revert: () => {
                this.layerManager.addLayer(layer);
            }
        }, true, false);
        const deleted = this.layerManager.deleteLayer(layerId);
        if (deleted) {
            this.syncLayersState();
            this.activeLayerId.set(this.getActiveLayerId());

        }
        return deleted;
    }

    setLayerOpacity(layerId: string, opacity: number): void {
        const oldOpacity = this.layerManager.getLayer(layerId)?.opacity ?? 1;
        this.undoRedoHelper.pushOperationQueue({
            apply: () => {
                this.layerManager.setLayerOpacity(layerId, opacity);
                this.syncLayersState();
            },
            revert: () => {
                this.layerManager.setLayerOpacity(layerId, oldOpacity);
                this.syncLayersState();
            }
        }, true, true);
        // this.layerManager.setLayerOpacity(layerId, opacity);
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

    async restoreDrawingSnapshot(snapshot: XDrawSnapshot): Promise<void> {
        this.applyRestoredData(XdrawDataUtils.deepCopyXDrawData(snapshot.data), snapshot.activeLayerId);
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
        this.rasterizer.invalidateContentBuffer();
        this.rasterizer.setProjectData(this.xdrawData);
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
        if (this.activeDrawElement.points.length >= XDRAW_MAX_POINTS_PER_ELEMENT) {
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
        }
        const size = this.activeStrokeWidth / this._viewCamera.scale;
        this.activeDrawElement.points.push({ x: worldX, y: worldY, size, breakBefore: this.breakBeforeNextPoint });
        this.breakBeforeNextPoint = false;
        this.rasterizer.setProjectData(this.xdrawData);
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

    private stopStrokeImmediately() {
        if (this.activeDrawElement) {
            this.activeDrawElement.finalized = true;
        }
        this.activeDrawElement = null;
        this.rasterizer.setActiveDrawElement(null);
        this.rasterizer.invalidateContentBuffer();
        this.rasterizer.setProjectData(this.xdrawData);

        const insertedElements = this.insertedElements.slice();
        const activeLayer = this.layerManager.getActiveLayer();
        this.undoRedoHelper.pushOperationQueue({
            apply: () => {
                activeLayer.elements.push(...this.insertedElements);
                this.rasterizer.invalidateContentBuffer();
                this.rasterizer.setProjectData(this.xdrawData);
                // this.insertedElements = [];
            },
            revert: () => {
                activeLayer.elements = activeLayer.elements.filter(el => !insertedElements.includes(el));
                this.rasterizer.invalidateContentBuffer();
                this.rasterizer.setProjectData(this.xdrawData);
                // this.insertedElements = insertedElements;
            },
        }, true, false);
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
        const removalResult = XdrawDataUtils.removePointsAt(activeLayer.elements, x, y, radius);
        activeLayer.elements = removalResult.elements;
        if (removalResult.hasChanges) {
            this.rasterizer.invalidateContentBuffer();
            this.rasterizer.setProjectData(this.xdrawData);
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
        // Katman yapisi (olusturma/silme/gorunurluk/opaklik) degisti; buffer artik gecersiz.
        this.rasterizer.invalidateContentBuffer();
        this.rasterizer.requestRender();
    }
}
