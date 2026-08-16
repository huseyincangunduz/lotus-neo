import { state, type State } from "@ubs-platform/neolit/core";
import { LayerManager } from "./layer-manager";
import { ProjectDataRasterizer } from "./data-rasterizer";
import type {
    InteractionMode,
    RenderStats,
    XDrawCanvasCamera,
    XDrawData,
    XDrawDrawElement,
    XDrawLayer,
} from "./xdraw-data";
import { XdrawDataUtils } from "./xdraw-data-utils";
import { ColorUtils } from "./color-utils";

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

    // Arka plan deseni henuz cizilmiyor; API uyumlulugu icin korunuyor.
    setBackgroundPattern(state: 0 | 1 | 2): void {
        this.rasterizer.setBackgroundPattern(state);
        // TODO: Arka plan deseni render'i eklenecek.
    }

    createLayer(layerId?: string, options?: { opacity?: number; visible?: boolean; insertBeforeLayerId?: string; }): XDrawLayer {
        const createdLayer = this.layerManager.createLayer(layerId, options);
        this.syncLayersState();
        return createdLayer;
    }

    setActiveLayer(layerId: string): XDrawLayer {
        const activeLayer = this.layerManager.setActiveLayer(layerId);
        this.syncLayersState();
        return activeLayer;
    }

    getActiveLayerId(): string {
        return this.layerManager.getActiveLayerId();
    }

    deleteLayer(layerId: string): boolean {
        const deleted = this.layerManager.deleteLayer(layerId);
        if (deleted) {
            this.syncLayersState();
        }
        return deleted;
    }

    setLayerOpacity(layerId: string, opacity: number): void {
        this.layerManager.setLayerOpacity(layerId, opacity);
        this.syncLayersState();
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
        this.xdrawData = XdrawDataUtils.deepCopyXDrawData(snapshot.data);
        const activeLayerId = this.xdrawData.layers.some((layer) => layer.id === snapshot.activeLayerId)
            ? snapshot.activeLayerId
            : (this.xdrawData.layers[0]?.id ?? "base");
        this.layerManager = new LayerManager(this.xdrawData, activeLayerId);
        this.activeDrawElement = null;
        this.syncLayersState();
        this.rasterizer.setProjectData(this.xdrawData);
    }

    // Yeni bir stroke baslatir. width ekran pikseli cinsinden firca genisligidir.
    beginStroke(width: number, color: string = "#000000", alpha: number = 1): void {
        this.activeStrokeWidth = width;
        this.activeStrokeColor = ColorUtils.setColorWithAlpha(color, alpha);
        this.activeDrawElement = {
            id: XdrawDataUtils.generateUniqueId(),
            type: "draw",
            color: this.activeStrokeColor,
            points: [],
        };
        this.layerManager.getActiveLayer().elements.push(this.activeDrawElement);
    }

    setActiveStrokeWidth(width: number): void {
        this.activeStrokeWidth = width;
    }

    // Ekran koordinatindan gelen (fakat host tarafindan dunya koordinatina cevrilmis)
    // noktayi aktif stroke'a ekler. Firca genisligi dunya birimine cevrilir.
    insertPoint(worldX: number, worldY: number): void {
        if (!this.activeDrawElement) {
            return;
        }
        const size = this.activeStrokeWidth / this._viewCamera.scale;
        this.activeDrawElement.points.push({ x: worldX, y: worldY, size });
        this.rasterizer.setProjectData(this.xdrawData);
    }

    stopStroke(): void {
        this.activeDrawElement = null;
        this.rasterizer.setProjectData(this.xdrawData);
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
            this.rasterizer.setProjectData(this.xdrawData);
        }
        return changed;
    }

    // x, y ve radius dunya koordinatindadir.
    erasePathSegmentsAtPoint(x: number, y: number, radius: number): boolean {
        const activeLayer = this.layerManager.getActiveLayer();
        activeLayer.elements = XdrawDataUtils.removePointsAt(activeLayer.elements, x, y, radius);
        this.rasterizer.setProjectData(this.xdrawData);
        return true;
    }

    setCursorPosition(position: CursorPosition | undefined) {
        this._cursorPosition = position;
        this.rasterizer.setCursorPosition(position);
    }

    getCursorPosition(): CursorPosition | undefined {
        return this._cursorPosition;
    }

    private syncLayersState(): void {
        this.layersState.set(this.layerManager.listLayers());
        this.rasterizer.requestRender();
    }
}
