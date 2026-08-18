import { ColorUtils } from "./color-utils";
import type { XDrawCanvasCamera, XDrawData, XDrawDrawElement, XDrawElement, XDrawFillElement, XDrawFillMask, XDrawLayer, XDrawPoint, InteractionMode, CanvasBackgroundPatternOptions } from "./xdraw-data";
import { XdrawDataUtils } from "./xdraw-data-utils";

export class ProjectDataRasterizer {
    // Maske, viewport'un biraz disini da kapsar; boylece kenarda olusan dolgu dikisleri azalir.
    private static readonly MASK_MARGIN_RATIO = 0.25;
    private static readonly MASK_MAX_PIXELS = 4_000_000;

    private backgroundPattern?: CanvasBackgroundPatternOptions;
    private cam: XDrawCanvasCamera = { x: 0, y: 0, scale: 1 };
    private activeCanvas?: HTMLCanvasElement;
    private maskCanvas?: HTMLCanvasElement;
    private projectData?: XDrawData;
    private cursorPosition?: { x: number; y: number; size: number; color: string; type: "filled" | "outlined" };
    private renderScheduled = false;
    // Anahtar rings array referansi: geometri degisince yeni array gelir ve cache kendiliginden duser.
    private fillPathCache = new WeakMap<XDrawPoint[][], Path2D>();

    setActiveCanvas(canvas: HTMLCanvasElement) {
        this.activeCanvas = canvas;
        this.requestRender();
    }

    getActiveCanvas(): HTMLCanvasElement | undefined {
        return this.activeCanvas;
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
        this.requestRender();
    }

    setViewCamera(camera: XDrawCanvasCamera) {
        this.cam = camera;
        this.requestRender();
    }

    setInteractionMode(_mode: InteractionMode) {
        // Etkilesim modu su an render'i etkilemiyor.
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

        const cameraScale = this.cam.scale;
        const marginX = Math.round(canvas.width * ProjectDataRasterizer.MASK_MARGIN_RATIO);
        const marginY = Math.round(canvas.height * ProjectDataRasterizer.MASK_MARGIN_RATIO);
        let width = Math.max(1, canvas.width + marginX * 2);
        let height = Math.max(1, canvas.height + marginY * 2);
        let maskScale = cameraScale;

        const pixelCount = width * height;
        if (pixelCount > ProjectDataRasterizer.MASK_MAX_PIXELS) {
            // Dunya kapsamini koruyarak cozunurlugu dusur: kapsam = width / maskScale sabit kalir.
            const ratio = Math.sqrt(ProjectDataRasterizer.MASK_MAX_PIXELS / pixelCount);
            width = Math.max(1, Math.floor(width * ratio));
            height = Math.max(1, Math.floor(height * ratio));
            maskScale = cameraScale * ratio;
        }

        const originX = this.cam.x - marginX / cameraScale;
        const originY = this.cam.y - marginY / cameraScale;

        if (!this.maskCanvas) {
            this.maskCanvas = document.createElement("canvas");
        }
        const maskCanvas = this.maskCanvas;
        if (maskCanvas.width !== width) {
            maskCanvas.width = width;
        }
        if (maskCanvas.height !== height) {
            maskCanvas.height = height;
        }
        const context = maskCanvas.getContext("2d", { willReadFrequently: true });
        if (!context) {
            return null;
        }

        context.setTransform(1, 0, 0, 1, 0, 0);
        context.globalAlpha = 1;
        context.clearRect(0, 0, width, height);
        context.setTransform(maskScale, 0, 0, maskScale, -originX * maskScale, -originY * maskScale);

        this.drawLayerMask(context, layer, maskScale, originX, originY, width / maskScale, height / maskScale);

        const imageData = context.getImageData(0, 0, width, height);
        context.setTransform(1, 0, 0, 1, 0, 0);

        return { imageData, width, height, originX, originY, scale: maskScale };
    }

    private drawLayerMask(
        context: CanvasRenderingContext2D,
        layer: XDrawLayer,
        maskScale: number,
        worldLeft: number,
        worldTop: number,
        worldWidth: number,
        worldHeight: number,
    ) {
        const worldRight = worldLeft + worldWidth;
        const worldBottom = worldTop + worldHeight;
        context.lineCap = "round";
        context.lineJoin = "round";
        // Cok uzaklasildiginda cizgiler antialias sonrasi alpha esiginin altina dusup
        // dolgunun sizmasina yol acabilir; en az 1 maske pikseli kalinlik zorunlu tutulur.
        const minWorldLineWidth = 1 / maskScale;

        for (const element of layer.elements) {
            if (!this.elementIntersectsRect(element, worldLeft, worldTop, worldRight, worldBottom)) {
                continue;
            }

            if (element.type === "fill") {
                this.drawFillElement(context, element as XDrawFillElement, "#000000");
                continue;
            }

            if (element.type === "draw") {
                this.drawDrawElement(context, element as XDrawDrawElement, "#000000", minWorldLineWidth);
            }
        }
    }

    // Element bbox'i maske dikdortgeni ile kesisiyor mu? Nokta-icinde testi yerine bbox testi
    // kullanilir; aksi halde iki ucu da ekran disinda kalan uzun bir cizgi elenip dolgu sizar.
    private elementIntersectsRect(element: XDrawElement, left: number, top: number, right: number, bottom: number): boolean {
        let minX = Infinity;
        let minY = Infinity;
        let maxX = -Infinity;
        let maxY = -Infinity;

        if (element.type === "draw") {
            const drawElement = element as XDrawDrawElement;
            for (const point of drawElement.points) {
                if (point.x < minX) minX = point.x;
                if (point.y < minY) minY = point.y;
                if (point.x > maxX) maxX = point.x;
                if (point.y > maxY) maxY = point.y;
            }
        } else if (element.type === "fill") {
            const fillElement = element as XDrawFillElement;
            for (const ring of fillElement.rings) {
                for (const point of ring) {
                    if (point.x < minX) minX = point.x;
                    if (point.y < minY) minY = point.y;
                    if (point.x > maxX) maxX = point.x;
                    if (point.y > maxY) maxY = point.y;
                }
            }
        } else {
            return false;
        }

        if (!Number.isFinite(minX)) {
            return false;
        }
        return minX <= right && maxX >= left && minY <= bottom && maxY >= top;
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
    private drawBackground(context: CanvasRenderingContext2D, scale: number, camX: number, camY: number) {
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

    // Bu artık kullanılmıyor, çünkü crop içinde crop edilen elementin layer opacity'si de callback olarak veriliyor. Bu sayede 2 kere döngüye sokmak gerekmiyor. Ama şimdilik silmiyorum, belki ileride lazım olur.
    private drawLines(context: CanvasRenderingContext2D, scale: number, camX: number, camY: number, visible: XDrawData) {
        // No op kalsın
        return;
        context.setTransform(scale, 0, 0, scale, -camX * scale, -camY * scale);
        context.lineCap = "round";
        context.lineJoin = "round";

        for (const layer of visible.layers) {
            if (layer.visible === false) {
                continue;
            }
            context.globalAlpha = layer.opacity ?? 1;

            for (const element of layer.elements) {
                if (element.type === "fill") {
                    this.drawFillElement(context, element as XDrawFillElement);
                    continue;
                }
                if (element.type === "draw") {
                    this.drawDrawElement(context, element as XDrawDrawElement);
                }
            }
        }
    }

    // colorOverride verilmezse elementin kendi rengi kullanilir (maske icin duz siyah gecilir).
    // minLineWidth, cizginin dunya birimi cinsinden alt siniridir; maskede cizginin
    // antialias sonrasi kaybolmamasi icin kullanilir.
    private drawDrawElement(
        context: CanvasRenderingContext2D,
        draw: XDrawDrawElement,
        colorOverride?: string,
        minLineWidth = 0,
    ) {
        if (draw.points.length === 0) {
            return;
        }
        const color = colorOverride ?? ColorUtils.regularizeToHexColor(draw.color);
        if (!color) {
            return;
        }

        const first = draw.points[0];
        if (draw.points.length === 1) {
            context.fillStyle = color;
            context.beginPath();
            context.arc(first.x, first.y, Math.max(0.5, minLineWidth / 2, first.size / 2), 0, Math.PI * 2);
            context.fill();
            return;
        }

        context.strokeStyle = color;
        context.lineWidth = Math.max(minLineWidth, first.size);
        context.beginPath();
        context.moveTo(first.x, first.y);

        // Ekranda 1 pikselden yakin noktalari atla. Maskede (minLineWidth > 0) devre disi:
        // atlanan nokta cizgi sinirinda delik acar ve flood fill disari sizar.
        const minWorldStepSq = minLineWidth > 0 ? 0 : (1 / this.cam.scale) ** 2;
        const lastIndex = draw.points.length - 1;
        let prev = first;
        for (let i = 1; i <= lastIndex; i++) {
            const point = draw.points[i];
            if (minWorldStepSq > 0 && i !== lastIndex) {
                const dx = point.x - prev.x;
                const dy = point.y - prev.y;
                if (dx * dx + dy * dy < minWorldStepSq) {
                    continue;
                }
            }
            if (point.size !== prev.size) {
                context.stroke();
                context.lineWidth = Math.max(minLineWidth, point.size);
                context.beginPath();
                context.moveTo(prev.x, prev.y);
            }
            context.lineTo(point.x, point.y);
            prev = point;
        }
        context.stroke();
    }

    private drawFillElement(context: CanvasRenderingContext2D, fill: XDrawFillElement, colorOverride?: string) {
        if (fill.rings.length === 0) {
            return;
        }
        const color = colorOverride ?? ColorUtils.regularizeToHexColor(fill.color);
        if (!color) {
            return;
        }

        const cached = this.fillPathCache.get(fill.rings);
        let path: Path2D;
        if (cached) {
            path = cached;
        } else {
            path = new Path2D();
            for (const ring of fill.rings) {
                if (ring.length === 0) {
                    continue;
                }
                path.moveTo(ring[0].x, ring[0].y);
                for (let i = 1; i < ring.length; i++) {
                    path.lineTo(ring[i].x, ring[i].y);
                }
                path.closePath();
            }
            this.fillPathCache.set(fill.rings, path);
        }

        context.fillStyle = color;
        context.fill(path, "evenodd");
    }

    // Dunya koordinatli XDrawData'yi kameraya gore canvas'a cizer.
    private rasterizeProjectDataToCanvas() {
        console.info("Rasterizing project data to canvas...");
        const canvas = this.activeCanvas;
        if (!canvas || !this.projectData) {
            return;
        }
        const context = canvas.getContext("2d");
        if (!context) {
            return;
        }

        const { x: camX, y: camY, scale } = this.cam;

        context.setTransform(1, 0, 0, 1, 0, 0);
        context.clearRect(0, 0, canvas.width, canvas.height);
        this.drawBackground(context, scale, camX, camY);

        // Draw başlangıcı
        context.setTransform(scale, 0, 0, scale, -camX * scale, -camY * scale);
        context.lineCap = "round";
        context.lineJoin = "round";

        void XdrawDataUtils.cropXDrawData(
            this.projectData,
            this.cam,
            canvas.width,
            canvas.height,
            (onFound) => {
                const foundGlobalAlpha = onFound.layerOpacity ?? 1;
                if (context.globalAlpha !== foundGlobalAlpha) {
                    context.globalAlpha = foundGlobalAlpha;
                }
                const element = {
                    type: onFound.elementType,
                    id: onFound.elementId,
                    color: onFound.color,
                    layerId: onFound.layerId,
                    points: onFound.points ?? [], // Placeholder for points; actual points may vary based on element type
                    rings: onFound.rings ?? [], // Placeholder for rings; actual rings may vary based on element type
                } as XDrawElement;
                if (element.type === "fill") {
                    this.drawFillElement(context, element as XDrawFillElement);
                }
                if (element.type === "draw") {
                    this.drawDrawElement(context, element as XDrawDrawElement);
                }
            }
        );

        // Kamera donusumu: ekran = (dunya - kamera) * scale
        // this.drawLines(context, scale, camX, camY, visible);
        this.drawCursor(context);
        context.setTransform(1, 0, 0, 1, 0, 0);
        context.globalAlpha = 1;
    }

    private throttledRender() {
        if (this.renderScheduled) {
            return;
        }
        this.renderScheduled = true;
        requestAnimationFrame(() => {
            this.rasterizeProjectDataToCanvas();
            this.renderScheduled = false;
        });
    }

}
