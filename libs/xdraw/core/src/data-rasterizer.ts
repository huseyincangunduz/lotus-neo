import { ColorUtils } from "./color-utils";
import type { XDrawCanvasCamera, XDrawData, XDrawDrawElement, XDrawElement, XDrawFillElement, XDrawFillMask, XDrawLayer, XDrawPoint, InteractionMode, CanvasBackgroundPatternOptions } from "./xdraw-data";
import { XdrawDataUtils } from "./xdraw-data-utils";
import { DynamicQueue } from "@ubs-platform/dynamic-queue";
const QUEUE_MODE = 
false;
// şimdilik disable kalsın... aktif olacağı zaman başındaki false'ı kaldırın
const BROWSER_SUPPORTS_OFFSCREEN_CANVAS = false && typeof window !== "undefined" && typeof window.OffscreenCanvas === "function";
// canvas2dtowebgl kütüphanesi, WebGL desteği olan tarayıcılarda 2D canvas'ı WebGL ile hızlandırmak için kullanılabilir. Ancak, bazı tarayıcılarda veya cihazlarda bu kütüphane düzgün çalışmayabilir. Bu nedenle, WebGL desteği ve kütüphanenin kullanılabilirliği kontrol edilmelidir.
// Not: Kütüphane istediğim gibi çalışmıyor. Ancak hoşuma gitti mantığı şimdilik kalsın. hiç kullanılmazsa kaldırırım
const WEBGL_RENDERER_AVAILABLE = false && typeof window !== "undefined" && typeof window.WebGLRenderingContext === "function" && window["enableWebGLCanvas" as any];
// Bir cizgi elemani, kalinlik degistigi her yerde yeni bir Path2D'ye bolunur.
interface DrawPathSegment {
    path: Path2D;
    lineWidth: number;
    fill: boolean;
}

interface DrawSpecialCanvas {
    canvas: HTMLCanvasElement | OffscreenCanvas;
    left: number;
    top: number;
    width: number;
    height: number;
    scale: number;
}

interface DrawPathCacheEntry {
    // minLineWidth, cachelenmis cizgi segmentlerinin dunya birimi cinsinden alt siniridir. Bu deger, maske olcegine gore degistigi icin cache ancak ayni degerle yeniden kullanilabilir.
    minLineWidth?: number;
    segments: DrawPathSegment[];
    specialCanvas?: DrawSpecialCanvas; // Özel bir canvas kullanılarak oluşturulmuşsa, bu canvas referansı saklanır. Bu, belirli durumlarda performans optimizasyonu için kullanılabilir.
    // Ölçeklere göre img bitmap. eğer aşırı yakınsa path2d ya da sıfırdan path yaratma işine girilebilir. Ancak belli uzaklıktakileri img bitmap olarak saklamak daha hızlı olabilir. Bu yüzden cache entry'ye img bitmap eklenebilir. Ancak bu, bellek kullanımını artırabilir ve bazı durumlarda gereksiz olabilir. Bu nedenle, img bitmap kullanımı opsiyonel olarak bırakılmıştır.
    // img: ImageBitmap | null;
}

interface DrawPointRange {
    startIndex: number;
    endIndex: number;
}

export class ProjectDataRasterizer {
    // Maske, viewport'un biraz disini da kapsar; boylece kenarda olusan dolgu dikisleri azalir.
    private static readonly MASK_MARGIN_RATIO = 0.25;
    private static readonly MASK_MAX_PIXELS = 4_000_000;
    private static readonly DRAW_CACHE_MAX_PIXELS = 8_000_000;

    private backgroundPattern?: CanvasBackgroundPatternOptions;
    private cam: XDrawCanvasCamera = { x: 0, y: 0, scale: 1 };
    private activeCanvas?: HTMLCanvasElement;
    private maskCanvas?: HTMLCanvasElement;
    private projectData?: XDrawData;
    private cursorPosition?: { x: number; y: number; size: number; color: string; type: "filled" | "outlined" };
    private renderScheduled = false;
    private fillPathCache = new WeakMap<XDrawPoint[][], Path2D>();
    private drawPathCache = new WeakMap<XDrawPoint[], DrawPathCacheEntry>();
    private testQueue = QUEUE_MODE ? new DynamicQueue() : { push: (fn: () => void) => fn() };
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

    getCanvasContext(canvas: HTMLCanvasElement): CanvasRenderingContext2D | null {
        if (WebGL2RenderingContext && WEBGL_RENDERER_AVAILABLE) {
            return (window["enableWebGLCanvas" as any] as any as Function)?.(canvas);
        }
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
        const context = maskCanvas.getContext("2d");
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

        const segments = this.getDrawPrebuilts(draw, minLineWidth, startIndex, endIndex);
        this.drawElementSegments(segments, context, color);
        // console.debug(`Draw element ${draw.id} rendered in ${(performanceEnd - performanceStart).toFixed(2)} ms`);
    }

    private drawElementSegments(segments: DrawPathCacheEntry, context: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D, color: string) {
        if (segments.specialCanvas) {
            const specialCanvas = segments.specialCanvas;
            context.drawImage(specialCanvas.canvas, specialCanvas.left, specialCanvas.top, specialCanvas.width, specialCanvas.height);
            return;
        }
        const segmentList = segments.segments;
        for (const segment of segmentList) {
            if (segment.fill) {
                context.fillStyle = color;
                context.fill(segment.path);
                continue;
            }
            context.strokeStyle = color;
            context.lineWidth = segment.lineWidth;
            context.stroke(segment.path);
        }
    }

    private getDrawPrebuilts(draw: XDrawDrawElement, minLineWidth: number, startIndex: number, endIndex: number): DrawPathCacheEntry {
        // if (startIndex !== 0 || endIndex !== draw.points.length - 1) {
        //     return this.buildDrawSegments(draw, minLineWidth, startIndex, endIndex);
        // }
        const cached = this.drawPathCache.get(draw.points);
        // minLineWidth maske olceginee gore degistigi icin cache ancak ayni degerle yeniden kullanilabilir.
        const renderScale = Math.max(0.001, this.cam.scale);
        if (cached) {
            if (BROWSER_SUPPORTS_OFFSCREEN_CANVAS && (!cached.specialCanvas || (cached.specialCanvas.scale < renderScale))) {
                Object.assign(cached, { specialCanvas: this.buildOffscreenCanvasIfAvailable(draw, renderScale, cached.segments, cached.specialCanvas?.canvas) });
            }
            return cached;
        }

        const built = this.buildDrawSegments(draw, minLineWidth, startIndex, endIndex);
        if (built.cacheable) {
            let specialCanvas: DrawSpecialCanvas | undefined;
            // Çizim tamamen kesinleşmişse ve minLineWidth 0 ise, çizimi offscreen canvas'a rasterize ederek cache'leyebiliriz. Bu, özellikle yüksek çözünürlükte performansı artırabilir.
            if (minLineWidth === 0) {
                specialCanvas = this.buildOffscreenCanvasIfAvailable(draw, renderScale, built.segments);
            }

            const cacheEntry = {
                minLineWidth,
                segments: built.segments,
                specialCanvas: specialCanvas, // Özel canvas referansını cache'e ekle
            };
            this.drawPathCache.set(draw.points, cacheEntry);
            return cacheEntry;
        } else if (cached) {
            this.drawPathCache.delete(draw.points);
        }
        return built;
    }

    private buildOffscreenCanvasIfAvailable(draw: XDrawDrawElement, renderScale: number, segments: DrawPathSegment[], browserCanvasExisting?: HTMLCanvasElement | OffscreenCanvas): DrawSpecialCanvas | undefined {
        // return undefined; // OffscreenCanvas oluşturma işlemi devre dışı bırakıldı. Gerekirse buraya geri eklenebilir.
        if (!BROWSER_SUPPORTS_OFFSCREEN_CANVAS || !draw.finalized || (renderScale < 3)) {
            return undefined; // Yeterince yakın değilse veya çizim tamamlanmamışsa, özel canvas oluşturma işlemi yapılmaz.
        }
        console.info(`Attempting to build offscreen canvas for draw element ${draw.id} at render scale ${renderScale}`);
        let specialCanvas: DrawSpecialCanvas | undefined;
        let bottom = -Infinity, right = -Infinity, left = Infinity, top = Infinity;
        for (const point of draw.points) {
            const radius = point.size / 2;
            left = Math.min(left, point.x - radius);
            top = Math.min(top, point.y - radius);
            right = Math.max(right, point.x + radius);
            bottom = Math.max(bottom, point.y + radius);
        }
        const boundsPadding = 1 / renderScale;
        left -= boundsPadding;
        top -= boundsPadding;
        right += boundsPadding;
        bottom += boundsPadding;
        const width = Math.max(1, right - left);
        const height = Math.max(1, bottom - top);
        const pixelWidth = Math.max(1, Math.ceil(width * renderScale));
        const pixelHeight = Math.max(1, Math.ceil(height * renderScale));
        if (pixelWidth * pixelHeight <= ProjectDataRasterizer.DRAW_CACHE_MAX_PIXELS) {
            const canvas = browserCanvasExisting ?? new OffscreenCanvas(pixelWidth, pixelHeight);
            canvas.width = pixelWidth;
            canvas.height = pixelHeight;
            const context = canvas.getContext("2d") as CanvasRenderingContext2D; // Canvas'i olusturmak icin context'e ihtiyac var, ancak kullanmayacagiz.
            if (context) {
                context.globalAlpha = 1;
                context.globalCompositeOperation = "source-over";
                context.setTransform(renderScale, 0, 0, renderScale, -left * renderScale, -top * renderScale);
                context.lineCap = "round";
                context.lineJoin = "round";
                context.fillStyle = ColorUtils.regularizeToHexColor(draw.color) || draw.color;
                this.drawElementSegments({ segments: segments }, context, draw.color);
                specialCanvas = { canvas, left, top, width, height, scale: renderScale };
            }
        }
        return specialCanvas;
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
        const context = this.getCanvasContext(canvas);
        if (!context) {
            return;
        }
        this.startContext2d(context);
        const { x: camX, y: camY, scale } = this.cam;

        this.testQueue.push(() => {
            context.setTransform(1, 0, 0, 1, 0, 0);
            context.clearRect(0, 0, canvas.width, canvas.height);
        });

        this.testQueue.push(() => {
            this.drawBackground(context, scale, camX, camY);

            // Draw başlangıcı
            context.setTransform(scale, 0, 0, scale, -camX * scale, -camY * scale);
            context.lineCap = "round";
            context.lineJoin = "round";
        })



        XdrawDataUtils.cropXDrawData(
            this.projectData,
            this.cam,
            canvas.width,
            canvas.height,
            (onFound) => {
                this.testQueue.push(() => {
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
                })
            }
        );

        // Kamera donusumu: ekran = (dunya - kamera) * scale
        // this.drawLines(context, scale, camX, camY, visible);
        this.testQueue.push(() => {
            this.drawCursor(context);
        })
        context.setTransform(1, 0, 0, 1, 0, 0);
        context.globalAlpha = 1;
        this.endContext2d(context);
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
