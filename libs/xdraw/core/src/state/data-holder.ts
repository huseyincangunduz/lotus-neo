import { cloneObjectDeep } from "../utils/clone-utils";
import { state, type State, type StateOrPlain } from "@ubs-platform/neolit/core";
import { LayerManager } from "./layer-manager";
import { ProjectDataRasterizer, type XDrawImageExportOptions } from "../rendering/data-rasterizer";
import type {
    InteractionMode,
    RenderStats,
    XDrawCanvasCamera,
    XDrawData,
    XDrawDrawElement,
    XDrawElement,
    XDrawLayer,
    XDrawTextElement,
} from "../model/xdraw-data";
import { XDRAW_MAX_POINTS_PER_ELEMENT } from "../model/xdraw-data";
import { XdrawDataUtils } from "../utils/xdraw-data-utils";
import { ColorUtils } from "../utils/color-utils";
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
    activeLayerSnapshotBeforeErase: XDrawElement[] = [];

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

    // Surukleme sirasinda (onChange) her tik icin cagrilir; undo yigina hicbir sey eklemez.
    // Boylece slider surukleme tek bir undo adimi yerine yuzlerce adima bolunmuyor.
    setLayerOpacityLive(layerId: string, opacity: number): void {
        this.layerManager.setLayerOpacity(layerId, opacity);
        this.syncLayersState();
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

        const insertedElementsSnapshot = cloneObjectDeep(this.insertedElements);
        const activeLayerId = this.getActiveLayerId();
        this.undoRedoHelper.pushOperationQueue({
            apply: () => {
                const activeLayer = this.layerManager.getLayer(activeLayerId)
                if (!activeLayer) {
                    return;
                }
                activeLayer.elements.push(...cloneObjectDeep(insertedElementsSnapshot));
                this.rasterizer.invalidateContentBuffer();
                this.rasterizer.setProjectData(this.xdrawData);
                // this.insertedElements = [];
            },
            revert: () => {
                const activeLayer = this.layerManager.getLayer(activeLayerId)
                if (!activeLayer) {
                    return;
                }
                activeLayer.elements = activeLayer.elements.filter(el => !insertedElementsSnapshot.find(el2 => el2.id === el.id));
                this.rasterizer.invalidateContentBuffer();
                this.rasterizer.setProjectData(this.xdrawData);
                // this.insertedElements = insertedElements;
            },
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

    addUndoRedoForEraseWithSnapshot(activeLayerId: string) {
        if (!this.activeLayerSnapshotBeforeErase) {
            return;
        }
        const beforeEraseSnapshot = cloneObjectDeep(this.activeLayerSnapshotBeforeErase);
        const currentSnapshotAfterRemoval = cloneObjectDeep(this.layerManager.getLayer(activeLayerId)!.elements);
        this.undoRedoHelper.pushOperationQueue({
            apply: async () => {
                // Do nothing, changes are already applied
                this.layerManager.getLayer(activeLayerId)!.elements = cloneObjectDeep(currentSnapshotAfterRemoval);
                this.rasterizer.invalidateContentBuffer();
                this.rasterizer.setProjectData(this.xdrawData);
            },
            revert: async () => {
                this.layerManager.getLayer(activeLayerId)!.elements = beforeEraseSnapshot;
                this.rasterizer.invalidateContentBuffer();
                this.rasterizer.setProjectData(this.xdrawData);
            },
        }, true, false);
        this.activeLayerSnapshotBeforeErase = [];
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
        const textConfig = {
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
                    this.rasterizer.invalidateContentBuffer();
                    this.rasterizer.setProjectData(this.xdrawData);
                },
                revert: async () => {
                    activeLayer.elements = activeLayer.elements.filter(el => el.id !== textConfig.id);
                    this.rasterizer.invalidateContentBuffer();
                    this.rasterizer.setProjectData(this.xdrawData);
                },
            },
            true,
            true
        );

        // activeLayer.elements.push(textConfig);
        // this.rasterizer.invalidateContentBuffer();
        // this.rasterizer.setProjectData(this.xdrawData);
    }

}
