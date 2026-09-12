import { ColorUtils } from "../utils/color-utils";
import type { XDrawCanvasCamera, XDrawData, XDrawDrawElement, XDrawFillElement, XDrawFillMask, InteractionMode, CanvasBackgroundPatternOptions, XDrawTextElement } from "../model/xdraw-data";
import { CanvasElementPainter } from "./canvas-element-painter";
import type { ContentBufferBackend } from "./content-buffer-backend";
import { ContentBufferRenderer } from "./content-buffer-renderer";
import { FillMaskRenderer } from "./fill-mask-renderer";
import { LocalContentBufferBackend } from "./local-content-buffer-backend";

export interface XDrawImageExportOptions {
    bounds: { x: number; y: number; width: number; height: number };
    pixelsPerWorldUnit: number;
    background: "white" | "transparent" | "grid";
    format: "png" | "webp" | "jpeg";
}

export class ProjectDataRasterizer {
    private backgroundPattern?: CanvasBackgroundPatternOptions;
    private cam: XDrawCanvasCamera = { x: 0, y: 0, scale: 1 };
    private activeCanvas?: HTMLCanvasElement;
    private projectData?: XDrawData;
    private cursorPosition?: { x: number; y: number; size: number; color: string; type: "filled" | "outlined" };
    private renderScheduled = false;
    private dataRevision = 0;
    private renderRevision = 0;
    private elementPainter = new CanvasElementPainter();
    private fillMaskRenderer = new FillMaskRenderer(this.elementPainter, () => document.createElement("canvas"));
    private contentBufferBackend: ContentBufferBackend = new LocalContentBufferBackend(
        new ContentBufferRenderer(
            this.elementPainter,
            (width, height) => typeof OffscreenCanvas !== "undefined"
                ? new OffscreenCanvas(width, height)
                : document.createElement("canvas"),
            {
                marginRatio: 0.6,
                maxPixels: window.innerWidth * window.innerHeight * 4,
                scaleMinRatio: 0.85,
                scaleMaxRatio: 1.18,
            },
        ),
    );
    // Su an cizilmekte olan (henuz finalize olmamis) stroke; buffer'a girmez, her karede ustte cizilir.
    private activeDrawElement: XDrawDrawElement | null = null;
    private activeDrawElementLayerOpacity = 1;
    private readonly unsubscribeContentBuffer: () => void;

    constructor() {
        this.unsubscribeContentBuffer = this.contentBufferBackend.onBufferReady(() => this.requestRender());
    }

    // Bir stroke bitip finalize oldugunda veya katman/veri yapisi degistiginde cagrilir;
    // bir sonraki render'da content buffer'i bastan olusturur. Aktif cizim sirasinda
    // (insertPoint) cagrilmamalidir - aksi halde her nokta icin tum katman yeniden taranir.
    invalidateContentBuffer() {
        this.contentBufferBackend.invalidate();
    }

    dispose() {
        this.unsubscribeContentBuffer();
        this.contentBufferBackend.dispose();
    }

    // Aktif (henuz finalize olmamis) stroke referansini gunceller; bu element content
    // buffer'a girmez, dogrudan ustte cizilir. null verilirse artik cizilecek aktif eleman yok demektir.
    setActiveDrawElement(element: XDrawDrawElement | null, layerOpacity: number = 1) {
        this.activeDrawElement = element;
        this.activeDrawElementLayerOpacity = layerOpacity;
    }


    setActiveCanvas(canvas: HTMLCanvasElement) {
        this.activeCanvas = canvas;
        this.renderRevision++;
        this.contentBufferBackend.setViewport(
            { camera: this.cam, width: canvas.width, height: canvas.height },
            this.renderRevision,
        );
        this.requestRender();
    }

    getActiveCanvas(): HTMLCanvasElement | undefined {
        return this.activeCanvas;
    }

    async exportImage(options: XDrawImageExportOptions): Promise<Blob> {
        if (!this.projectData) {
            throw new Error("Disa aktarilacak cizim verisi bulunamadi.");
        }

        const { bounds, pixelsPerWorldUnit, background, format } = options;
        const width = Math.max(1, Math.ceil(bounds.width * pixelsPerWorldUnit));
        const height = Math.max(1, Math.ceil(bounds.height * pixelsPerWorldUnit));
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const context = canvas.getContext("2d");
        if (!context) {
            throw new Error("Export canvas baglami olusturulamadi.");
        }

        if (background === "white" || format === "jpeg") {
            context.fillStyle = "#ffffff";
            context.fillRect(0, 0, width, height);
        }
        if (background === "grid") {
            context.fillStyle = "#ffffff";
            context.fillRect(0, 0, width, height);
            this.drawExportGrid(context, bounds, pixelsPerWorldUnit);
        }

        context.setTransform(
            pixelsPerWorldUnit,
            0,
            0,
            pixelsPerWorldUnit,
            -bounds.x * pixelsPerWorldUnit,
            -bounds.y * pixelsPerWorldUnit,
        );
        context.lineCap = "round";
        context.lineJoin = "round";
        for (const layer of this.projectData.layers) {
            if (layer.visible === false || layer.opacity === 0) {
                continue;
            }
            context.globalAlpha = layer.opacity ?? 1;
            for (const element of layer.elements) {
                if (element.type === "draw") {
                    this.elementPainter.drawDrawElement(context, element as XDrawDrawElement, this.cam.scale);
                } else if (element.type === "fill") {
                    this.elementPainter.drawFillElement(context, element as XDrawFillElement);
                } else if (element.type === "text") {
                    this.elementPainter.drawTextElement(context, element as XDrawTextElement);
                }
            }
        }
        context.globalAlpha = 1;

        const mimeType = `image/${format}`;
        return new Promise<Blob>((resolve, reject) => {
            canvas.toBlob((blob) => {
                if (blob) {
                    resolve(blob);
                } else {
                    reject(new Error("Gorsel olusturulamadi."));
                }
            }, mimeType, format === "jpeg" ? 0.92 : undefined);
        });
    }

    private drawExportGrid(context: CanvasRenderingContext2D, bounds: XDrawImageExportOptions["bounds"], pixelsPerWorldUnit: number): void {
        const spacing = 20 * pixelsPerWorldUnit;
        context.strokeStyle = "#d1d5db";
        context.lineWidth = 1;
        for (let x = ((-bounds.x * pixelsPerWorldUnit) % spacing + spacing) % spacing; x <= context.canvas.width; x += spacing) {
            context.beginPath();
            context.moveTo(x, 0);
            context.lineTo(x, context.canvas.height);
            context.stroke();
        }
        for (let y = ((-bounds.y * pixelsPerWorldUnit) % spacing + spacing) % spacing; y <= context.canvas.height; y += spacing) {
            context.beginPath();
            context.moveTo(0, y);
            context.lineTo(context.canvas.width, y);
            context.stroke();
        }
    }

    setCursorPosition(cursor: { x: number; y: number; size: number; color: string; type: "filled" | "outlined" } | undefined) {
        this.cursorPosition = cursor;
        if (this.cursorPosition) {
            this.cursorPosition.color = ColorUtils.regularizeToHexColor(this.cursorPosition.color) || this.cursorPosition.color;
        }

        this.requestRender();
    }

    setProjectData(projectData: XDrawData) {
        this.projectData = projectData;
        this.dataRevision++;
        this.contentBufferBackend.setSnapshot(projectData, this.dataRevision);
        this.requestRender();
    }

    setViewCamera(camera: XDrawCanvasCamera) {
        this.cam = camera;
        if (this.activeCanvas) {
            this.renderRevision++;
            this.contentBufferBackend.setViewport(
                { camera, width: this.activeCanvas.width, height: this.activeCanvas.height },
                this.renderRevision,
            );
        }
        this.requestRender();
    }

    setInteractionMode(_mode: InteractionMode) {
        // Etkilesim modu su an render'i etkilemiyor.
    }

    getCanvasContext(canvas: HTMLCanvasElement): CanvasRenderingContext2D | null {
        return canvas.getContext("2d", { desynchronized: true });
    }

    startContext2d(context: CanvasRenderingContext2D) {
        // alert("startContext2d is called" + ((context as any)["start2D" as any] as any as Function ? " and start2D is available" : " but start2D is not available"));
        ((context as any)["start2D" as any] as any as Function)?.(context);
    }

    endContext2d(context: CanvasRenderingContext2D) {
        // alert("finish2D is called" + ((context as any)["finish2D" as any] as any as Function ? " and end2D is available" : " but end2D is not available"));
        ((context as any)["finish2D" as any] as any as Function)?.(context);
    }

    // Aktif katmanin cizgilerini, kamera olceginde offscreen bir canvas'a rasterize eder.
    // Grid, cursor ve diger katmanlar dahil edilmez; boylece flood fill sinirlari yalniz
    // aktif katmanin cizgilerinden olusur.
    createActiveLayerFillMask(activeLayerId: string): XDrawFillMask | null {
        const canvas = this.activeCanvas;
        if (!canvas || !this.projectData) {
            return null;
        }
        const layer = this.projectData.layers.find((candidate) => candidate.id === activeLayerId);
        if (!layer) {
            return null;
        }
        return this.fillMaskRenderer.create(layer, this.cam, canvas.width, canvas.height);
    }

    markDirty(_x: number, _y: number, _radius: number) {
        // Kirli bolge takibi henuz uygulanmadi; tam render yapiliyor.
    }

    requestRender() {
        if (!this.activeCanvas || !this.projectData) {
            return;
        }
        // this.rasterizeProjectDataToCanvas();
        this.throttledRender();
    }

    setBackgroundPattern(state: 0 | 1 | 2) {
        // Convert the numeric state to a background pattern
        switch (state) {
            case 0:
                this.backgroundPattern = undefined;
                break;
            case 1:
                this.backgroundPattern = { type: "grid", spacing: 20, color: "#cccccc", opacity: 0.2 };
                break;
            case 2:
                this.backgroundPattern = { type: "ruler", spacing: 20, color: "#cccccc", opacity: 0.5 };
                break;
            default:
                this.backgroundPattern = undefined;
        }
        this.requestRender();
    }

    private drawCursor(context: CanvasRenderingContext2D) {
        if (!this.cursorPosition) {
            return;
        }
        context.setTransform(1, 0, 0, 1, 0, 0);
        const { x, y, size, color, type } = this.cursorPosition;
        const radius = (size / 2);
        context.strokeStyle = color;
        context.fillStyle = color;
        context.lineWidth = type === "outlined" ? Math.max(2, Math.max(1, this.cam.scale)) : 0;

        context.globalAlpha = .5;
        switch (type) {
            case "filled":
                context.beginPath();
                context.arc(x, y, radius, 0, Math.PI * 2);
                context.fill();
                break;
            case "outlined":
                context.beginPath();
                context.arc(x, y, radius, 0, Math.PI * 2);
                context.stroke();
                break;
        }
        context.globalAlpha = 1;

    }
    drawBackground(context: CanvasRenderingContext2D, scale: number, camX: number, camY: number) {
        if (!this.backgroundPattern) {
            return;
        }
        const { type, spacing = 20, color = "#cccccc", opacity = type == 'grid' ? 0.2 : .5 } = this.backgroundPattern;

        // context.setTransform(scale, 0, 0, scale, -camX * scale, -camY * scale);
        context.globalAlpha = opacity;
        context.strokeStyle = color;
        context.lineWidth = 1 * scale;

        const step = spacing * scale;
        const verticalArtan = camX % spacing;
        const horizontalArtan = camY % spacing;
        for (let x = -verticalArtan * scale; x <= context.canvas.width; x += step) {
            context.beginPath();
            context.moveTo(x, 0);
            context.lineTo(x, context.canvas.height);
            context.stroke();
        }

        // Draw horizontal lines
        for (let y = -horizontalArtan * scale; y <= context.canvas.height; y += step) {
            context.beginPath();
            context.moveTo(0, y);
            context.lineTo(context.canvas.width, y);
            context.stroke();
        }



        context.globalAlpha = 1;
    }

    invalidateDrawCache(element: XDrawDrawElement) {
        this.elementPainter.invalidateDrawCache(element);
    }

    invalidateAllPathCaches() {
        this.elementPainter.invalidateAllPathCaches();
    }

    // Dunya koordinatli XDrawData'yi kameraya gore canvas'a cizer.
    private rasterizeProjectDataToCanvas() {
        const canvas = this.activeCanvas;
        if (!canvas || !this.projectData) {
            return;
        }
        const context = this.getCanvasContext(canvas);
        if (!context) {
            return;
        }
        this.contentBufferBackend.setViewport(
            { camera: this.cam, width: canvas.width, height: canvas.height },
            this.renderRevision,
        );
        void this.contentBufferBackend.requestBuffer().catch((error: unknown) => {
            console.error("Content buffer olusturulamadi.", error);
        });
        const { x: camX, y: camY, scale } = this.cam;
        const showScreenFunc = () => {
            this.renderScheduled = false;
            this.startContext2d(context);
            context.setTransform(1, 0, 0, 1, 0, 0);
            context.clearRect(0, 0, canvas.width, canvas.height);
            const contentFrame = this.contentBufferBackend.getCurrentFrame();
            if (contentFrame) {
                const { source, buffer } = contentFrame;
                const scaleRatio = scale / buffer.scale;
                context.setTransform(1, 0, 0, 1, 0, 0);
                context.drawImage(
                    source,
                    (buffer.originX - camX) * scale,
                    (buffer.originY - camY) * scale,
                    buffer.width * scaleRatio,
                    buffer.height * scaleRatio,
                );
            }

            // Aktif (henuz finalize olmamis) stroke, buffer'da olmadigi icin her karede
            // ayrica dunya donusumuyle ustte cizilir.
            const activeElement = this.activeDrawElement;
            if (activeElement) {
                context.setTransform(scale, 0, 0, scale, -camX * scale, -camY * scale);
                context.lineCap = "round";
                context.lineJoin = "round";
                context.globalAlpha = this.activeDrawElementLayerOpacity;
                this.elementPainter.drawDrawElement(context, activeElement, this.cam.scale);
                context.globalAlpha = 1;
            }

            // Cursor (ozellikle silgi outline'i) aktif stroke olmadan da (hover/erase sirasinda) gorunmeli;
            // eskiden bu "return" yuzunden yalniz cizim modunda stroke devam ederken cizilebiliyordu.
            this.drawCursor(context);
            context.setTransform(1, 0, 0, 1, 0, 0);
            context.globalAlpha = 1;
            this.endContext2d(context);
        }
        requestAnimationFrame(showScreenFunc);
    }

    private throttledRender() {
        if (this.renderScheduled) {
            return;
        }
        this.renderScheduled = true;
        // requestAnimationFrame(() => {
        //     this.renderScheduled = false;
        // });
        this.rasterizeProjectDataToCanvas();

    }

}
