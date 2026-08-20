import { ColorUtils } from "./color-utils";
import type { XDrawCanvasCamera, XDrawData, XDrawDrawElement, XDrawElement, XDrawFillElement, XDrawFillMask, XDrawLayer, XDrawPoint, InteractionMode, CanvasBackgroundPatternOptions } from "./xdraw-data";
import { XdrawDataUtils } from "./xdraw-data-utils";

// Bir cizgi elemani, kalinlik degistigi her yerde yeni bir Path2D'ye bolunur.
interface DrawPathSegment {
    path: Path2D;
    lineWidth: number;
    fill: boolean;
}

interface DrawPathCacheEntry {
    minLineWidth: number;
    segments: DrawPathSegment[];
}

interface DrawPointRange {
    startIndex: number;
    endIndex: number;
}

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
    private fillPathCache = new WeakMap<XDrawPoint[][], Path2D>();
    private drawPathCache = new WeakMap<XDrawPoint[], DrawPathCacheEntry>();
    // Anahtar rings array referansi: geometri degisince yeni array gelir ve cache kendiliginden duser.
    // private lastRenderTimeMs = 1000 / 30;
    // Anahtar points array referansi: crop callback her karede yeni element objesi urettigi icin
    // element referansi anahtar olarak kullanilamaz.

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


    // colorOverride verilmezse elementin kendi rengi kullanilir (maske icin duz siyah gecilir).
    // minLineWidth, cizginin dunya birimi cinsinden alt siniridir; maskede cizginin
    // antialias sonrasi kaybolmamasi icin kullanilir.
    private drawDrawElement(
        context: CanvasRenderingContext2D,
        draw: XDrawDrawElement,
        colorOverride?: string,
        minLineWidth = 0,
        range?: DrawPointRange,
    ) {
        if (draw.points.length === 0) {
            return;
        }
        const startIndex = range?.startIndex ?? 0;
        const endIndex = range?.endIndex ?? draw.points.length - 1;
        if (startIndex < 0 || endIndex < startIndex || endIndex >= draw.points.length) {
            return;
        }
        const color = colorOverride ?? ColorUtils.regularizeToHexColor(draw.color);
        if (!color) {
            return;
        }

        const segments = this.getDrawSegments(draw, minLineWidth, startIndex, endIndex);
        for (const segment of segments) {
            if (segment.fill) {
                context.fillStyle = color;
                context.fill(segment.path);
                continue;
            }
            context.strokeStyle = color;
            context.lineWidth = segment.lineWidth;
            context.stroke(segment.path);
        }
        // console.debug(`Draw element ${draw.id} rendered in ${(performanceEnd - performanceStart).toFixed(2)} ms`);
    }

    private getDrawSegments(draw: XDrawDrawElement, minLineWidth: number, startIndex: number, endIndex: number): DrawPathSegment[] {
        if (startIndex !== 0 || endIndex !== draw.points.length - 1) {
            return this.buildDrawSegments(draw, minLineWidth, startIndex, endIndex).segments;
        }
        const cached = this.drawPathCache.get(draw.points);
        // minLineWidth maske olceginee gore degistigi icin cache ancak ayni degerle yeniden kullanilabilir.
        if (cached && cached.minLineWidth === minLineWidth) {
            return cached.segments;
        }

        const built = this.buildDrawSegments(draw, minLineWidth, startIndex, endIndex);
        if (built.cacheable) {
            this.drawPathCache.set(draw.points, { minLineWidth, segments: built.segments });
        } else if (cached) {
            this.drawPathCache.delete(draw.points);
        }
        return built.segments;
    }

    // Partial cizgiler ve nokta atlama uygulanmis cizgiler cachelenmez: geometri henuz kesinlesmemistir.
    private buildDrawSegments(draw: XDrawDrawElement, minLineWidth: number, startIndex: number, endIndex: number): { segments: DrawPathSegment[]; cacheable: boolean } {
        const first = draw.points[startIndex];

        if (startIndex === endIndex) {
            const dot = new Path2D();
            dot.arc(first.x, first.y, Math.max(0.5, minLineWidth / 2, first.size / 2), 0, Math.PI * 2);
            return { segments: [{ path: dot, lineWidth: 0, fill: true }], cacheable: draw.finalized === true && !draw.partial && startIndex === 0 && endIndex === draw.points.length - 1 };
        }

        const segments: DrawPathSegment[] = [];
        let path = new Path2D();
        let lineWidth = Math.max(minLineWidth, first.size);
        path.moveTo(first.x, first.y);

        // Ekranda 1 pikselden yakin noktalari atla. Maskede (minLineWidth > 0) devre disi:
        // atlanan nokta cizgi sinirinda delik acar ve flood fill disari sizar.
        const minWorldStepSq = minLineWidth > 0 ? 0 : (1 / this.cam.scale) ** 2;
        const lastIndex = endIndex;
        let prev = first;
        let skippedPoint = false;
        for (let i = startIndex + 1; i <= lastIndex; i++) {
            const point = draw.points[i];
            if (!point.breakBefore && draw.partial && minWorldStepSq > 0 && i !== lastIndex) {
                const dx = point.x - prev.x;
                const dy = point.y - prev.y;
                if (dx * dx + dy * dy < minWorldStepSq) {
                    skippedPoint = true;
                    continue;
                }
            }
            if (point.breakBefore) {
                segments.push({ path, lineWidth, fill: false });
                lineWidth = Math.max(minLineWidth, point.size);
                path = new Path2D();
                path.moveTo(point.x, point.y);
                prev = point;
                continue;
            }
            if (point.size !== prev.size) {
                segments.push({ path, lineWidth, fill: false });
                lineWidth = Math.max(minLineWidth, point.size);
                path = new Path2D();
                path.moveTo(prev.x, prev.y);
            }
            path.lineTo(point.x, point.y);
            prev = point;
        }
        segments.push({ path, lineWidth, fill: false });

        const usesFullRange = startIndex === 0 && endIndex === draw.points.length - 1;
        return { segments, cacheable: usesFullRange && draw.finalized === true && !draw.partial && !skippedPoint };
    }

    invalidateDrawCache(element: XDrawDrawElement) {
        this.drawPathCache.delete(element.points);
    }

    invalidateAllPathCaches() {
        this.drawPathCache = new WeakMap<XDrawPoint[], DrawPathCacheEntry>();
        this.fillPathCache = new WeakMap<XDrawPoint[][], Path2D>();
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
        const canvas = this.activeCanvas;
        if (!canvas || !this.projectData) {
            return;
        }
        const context = canvas.getContext("2d", { desynchronized: true });
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

        XdrawDataUtils.cropXDrawData(
            this.projectData,
            this.cam,
            canvas.width,
            canvas.height,
            (onFound) => {
                const foundGlobalAlpha = onFound.layerOpacity ?? 1;
                if (context.globalAlpha !== foundGlobalAlpha) {
                    context.globalAlpha = foundGlobalAlpha;
                }
                let element = onFound.element
                switch (element?.type) {
                    case "draw":
                        this.drawDrawElement(
                            context,
                            element as XDrawDrawElement,
                            undefined,
                            0,
                            {
                                startIndex: onFound.pointStartIndex ?? 0,
                                endIndex: onFound.pointEndIndex ?? Math.max(0, (onFound.points?.length ?? 1) - 1),
                            },
                        );
                        break;
                    case "fill":
                        this.drawFillElement(context, element as XDrawFillElement);
                        break;
                }

                element = null as any; // Clear reference to allow garbage collection
                onFound = null as any; // Clear reference to allow garbage collection
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
            this.renderScheduled = false;
            this.rasterizeProjectDataToCanvas();

        });

    }

}
