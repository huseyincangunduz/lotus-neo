import {
  computed,
  NeolitComponent,
  state,
  type NeolitNode,
} from "@ubs-platform/neolit/core";
import { UndoRedoHelper } from "@libs/utils/undo-redo-helper";
import { CanvasDrawSidebar } from "../elements/canvas-sidebar";
import { inject } from "@ubs-platform/neolit/injectables";
import {
  CanvasDrawTools,
  ColorUtils,
  listenKey,
  listenPinch,
  XDRAW_SETTING_KEYS,
  XDrawDataHolder,
  XDrawSettingsConfig,
  XdrawDataUtils,
  xdrawBuffersEqual,
  xdrawSkeletonsEqual,
  type XDrawSnapshot,
  type XDrawHistorySnapshot,
} from "@libs/xdraw/core";
import {
  APP_NATIVE_CONTROLLER_TOKEN,
  type IAppNativeController,
} from "../app-native-controller";
import { Button } from "@libs/ui/button";
import { materialSymbolsOutlined } from "@libs/ui/icon";
import "./canvas-draw.css";

interface AutosavePayload {
  snapshot: XDrawSnapshot;
  viewport: { x: number; y: number; scale: number };
  savedAt: string;
}

// Kamera olcek siniri; asiri yakinlasma/uzaklasmayi engeller.
const MIN_SCALE = 0.05;
const MAX_SCALE = 40;

// Bu componentte çoğu yerde state kullanılmayacak. Çünkü elementler rerender edilmeyecek. eğer rerender olursa hem performans sorunları yaşanır hem de canvas ve svg elementleri kaybolur. Bu yüzden state yerine class propertyleri kullanılacak.
export class CanvasDraw extends NeolitComponent {
  worldX = state(0);
  worldXUI = computed([this.worldX], ([x]) => Math.round(x));
  worldY = state(0);
  worldYUI = computed([this.worldY], ([y]) => Math.round(y));
  clickedCameraX = state(0);
  clickedCameraY = state(0);
  zoomFactor = state(1);
  zoomFactorUI = computed(
    [this.zoomFactor],
    ([zoom]) => Math.round(zoom * 100) / 100,
  );
  canvasHeight = state(600);
  canvasWidth = state(800);

  // appTheme = state<"light" | "dark">("light");
  settings = inject(XDrawSettingsConfig);
  appController = inject<IAppNativeController>(APP_NATIVE_CONTROLLER_TOKEN);

  viewPort = computed(
    [this.worldX, this.worldY, this.zoomFactor],
    ([x, y, scale]) => ({ x, y, scale }),
  );

  gridSize = computed([this.zoomFactor], ([zoom]) => {
    const gridSizeRaw = 20 * zoom;
    return gridSizeRaw + "px " + gridSizeRaw + "px";
  });
  gridMajorSize = computed([this.zoomFactor], ([zoom]) => {
    const gridSizeRaw = 100 * zoom;
    return gridSizeRaw + "px " + gridSizeRaw + "px";
  });
  gridOffset = computed(
    [this.worldX, this.worldY, this.zoomFactor],
    ([x, y, zoom]) => {
      const gridSizeRaw = 20 * zoom;
      return `${-(x * zoom) % gridSizeRaw}px ${-(y * zoom) % gridSizeRaw}px`;
    },
  );
  gridMajorOffset = computed(
    [this.worldX, this.worldY, this.zoomFactor],
    ([x, y, zoom]) => {
      const gridSizeRaw = 100 * zoom;
      return `${-(x * zoom) % gridSizeRaw}px ${-(y * zoom) % gridSizeRaw}px`;
    },
  );
  gridLineWidth = computed([this.zoomFactor], ([zoom]) => {
    return zoom + "px";
  });
  gridClassName = computed(
    [this.settings.backgroundPatternMode, this.zoomFactor],
    ([mode, zoom]) => {
      if (mode === 0) {
        return "xdraw-grid xdraw-grid-off";
      }
      // 20px'lik grid çizgileri 4px'in altına indiğinde (zoom < 0.2) moiré/titreme olmaması için
      // ızgarayı solid gri tona dönüştürürüz.
      if (zoom < 0.2) {
        if (mode === 2 && zoom >= 0.07) {
          // Cetvel/kademeli modda iken 100'lük ana çizgiler hâlâ görünür olsun
          return "xdraw-grid xdraw-grid-ruler-far";
        }
        return "xdraw-grid xdraw-grid-solid";
      }
      return `xdraw-grid ${mode === 1 ? "xdraw-grid-lines" : "xdraw-grid-ruler"}`;
    },
  );

  canvas = (
    // Not: Neolitte TSX kullanırken attribute değerlerine State verebiliyoruz. otomatik olarak değişiklikleri güncelliyor. Umarım bunu copilot okurken bunu dikkat eder
    <canvas
      id="myCanvas"
      width={this.canvasWidth}
      height={this.canvasHeight}
      style={{
        cursor: "crosshair",
        touchAction: "none",
        "--gridSize": this.gridSize,
        "--gridMajorSize": this.gridMajorSize,
        "--gridOffset": this.gridOffset,
        "--gridMajorOffset": this.gridMajorOffset,
        "--lineWidth": this.gridLineWidth,
      }}
      className={this.gridClassName}
    ></canvas>
  );

  divBetweenButtonsAndBottom = (
    <div id="canvasViewport" class="w-full h-full">
      {this.canvas}
    </div>
  );
  svgHolder = new XDrawDataHolder();

  mode = state<"pointer" | "draw">("pointer");
  stylusModeEnabled = state(true);
  // drawType = state<"pencil" | "line" | "rectangle" | "erase" | "fill">(
  //     "pencil",
  // );

  canUndo = state(false);
  canRedo = state(false);
  isPointerDragging = false;
  activePointerId: number | null = null;
  activePointers = new Map<number, { x: number; y: number }>();
  lastPinchDistance = 0;
  smoothedPressure: number | null = null;
  lastDrawPoint: { x: number; y: number } | null = null;
  lastErasePoint: { x: number; y: number } | null = null;
  private drawTools = new CanvasDrawTools(this);
  private undoRedoHelper = new UndoRedoHelper();
  private gestureHistoryBeforeSnapshot: XDrawHistorySnapshot | null = null;
  // Kalem kalkinca hemen commit etmek yerine bekletiyoruz; bu sure icinde yeni bir
  // stroke baslarsa ayni undo adimina devam eder ve agir JSON islemleri hic calismaz.
  private gestureFinalizeTimerId: number | null = null;
  private static readonly GESTURE_FINALIZE_DELAY_MS = 500;
  private autosaveTimerId: number | null = null;
  private autosaveDirty = false;
  private readonly handleWindowResize = () => {
    this.syncCanvasViewportSize();
  };
  private readonly handleVisualViewportResize = () => {
    this.syncCanvasViewportSize();
  };
  private readonly handleBeforeUnload = () => {
    this.flushPendingGestureHistory();
    this.flushAutosave();
  };

  private buildExportPayload(optimize = false) {
    const snapshot = this.svgHolder.captureDrawingSnapshot();
    if (optimize) {
      snapshot.data = XdrawDataUtils.optimizeXDrawData(snapshot.data);
    }
    return {
      version: 1,
      exportedAt: new Date().toISOString(),
      snapshot,
      viewport: this.viewPort.get(),
    };
  }

  private scheduleAutosave(): void {
    this.autosaveDirty = true;
  }

  private writeAutosave(): void {
    const payload: AutosavePayload = {
      snapshot: this.svgHolder.captureDrawingSnapshot(),
      viewport: this.viewPort.get(),
      savedAt: new Date().toISOString(),
    };

    try {
      localStorage.setItem(
        XDRAW_SETTING_KEYS.autosaveSnapshot,
        JSON.stringify(payload),
      );
      this.autosaveDirty = false;
    } catch (error) {
      console.error("Autosave yazilamadi:", error);
    }
  }

  private flushAutosave(): void {
    if (!this.autosaveDirty) {
      return;
    }
    this.writeAutosave();
  }

  private startAutosaveLoop(): void {
    if (this.autosaveTimerId !== null) {
      window.clearInterval(this.autosaveTimerId);
    }

    this.autosaveTimerId = window.setInterval(() => {
      this.flushAutosave();
    }, 1200);
  }

  private stopAutosaveLoop(): void {
    if (this.autosaveTimerId === null) {
      return;
    }

    window.clearInterval(this.autosaveTimerId);
    this.autosaveTimerId = null;
  }

  private tryRestoreAutosave(): boolean {
    const raw = localStorage.getItem(XDRAW_SETTING_KEYS.autosaveSnapshot);
    if (!raw) {
      return false;
    }

    try {
      const parsed = JSON.parse(raw) as Partial<AutosavePayload>;
      if (
        !parsed.snapshot ||
        !parsed.snapshot.data ||
        typeof parsed.snapshot.activeLayerId !== "string" ||
        !parsed.viewport ||
        !Number.isFinite(parsed.viewport.x) ||
        !Number.isFinite(parsed.viewport.y)
      ) {
        return false;
      }

      this.svgHolder.restoreDrawingSnapshot(parsed.snapshot).catch((error) => {
        console.error("Autosave geri yuklenemedi:", error);
      });

      const restoredScale = Number(parsed.viewport.scale);
      if (Number.isFinite(restoredScale) && restoredScale > 0) {
        this.zoomFactor.set(restoredScale);
      }

      this.syncCanvasViewportSize();
      this.worldX.set(parsed.viewport.x);
      this.worldY.set(parsed.viewport.y);

      return true;
    } catch (error) {
      console.error("Autosave parse edilemedi:", error);
      return false;
    }
  }

  //   private createDownloadName(extension: string): string {
  //     const now = new Date();
  //     const stamp = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}_${String(now.getHours()).padStart(2, "0")}-${String(now.getMinutes()).padStart(2, "0")}`;
  //     return `xdraw_${stamp}.${extension}`;
  //   }

  //   private triggerDownload(
  //     content: string,
  //     fileName: string,
  //     mimeType: string,
  //   ): void {
  //     const blob = new Blob([content], { type: mimeType });
  //     const url = URL.createObjectURL(blob);
  //     try {
  //       const anchor = document.createElement("a");
  //       anchor.href = url;
  //       anchor.download = fileName;
  //       document.body.appendChild(anchor);
  //       anchor.click();
  //       anchor.remove();
  //     } finally {
  //       URL.revokeObjectURL(url);
  //     }
  //   }

  private downloadProject(saveAs: boolean): void {
    const payload = this.buildExportPayload(false);
    const serialized = JSON.stringify(payload, null, 2);
    this.appController.downloadDataRequest(
      new Blob([serialized], { type: "application/json;charset=utf-8" }),
      "application/json",
      saveAs ? undefined : "xdraw_project.xdraw.json",
    );
  }

  private async saveAndShareProject(): Promise<void> {
    const payload = this.buildExportPayload(false);
    const serialized = JSON.stringify(payload, null, 2);
    const blob = new Blob([serialized], {
      type: "application/json;charset=utf-8",
    });
    await this.appController.downloadDataRequest(
      blob,
      "application/json",
      "xdraw_project.xdraw.json",
    );
    await this.appController.shareDataRequest?.(
      blob,
      "application/json",
      "xdraw_project.xdraw.json",
    );
  }

  private async openProjectFromFile(): Promise<void> {
    const file = await this.appController.openFileRequest("application/json");
    if (!file) {
      return;
    }
    await this.loadProjectFromFile(file);
  }

  private async loadProjectFromFile(file: File): Promise<void> {
    try {
      const content = await file.text();
      await this.importProjectContent(content);
    } catch (error) {
      console.error("Dosya acilamadi:", error);
      alert("Dosya acilamadi. Lutfen gecerli bir XDraw dosyasi secin.");
    }
  }

  private async importProjectContent(content: string): Promise<void> {
    const before = this.captureHistorySnapshot();
    const parsed = JSON.parse(content) as { snapshot?: XDrawSnapshot };
    if (!parsed.snapshot || !parsed.snapshot.data) {
      throw new Error("Gecerli bir XDraw dosyasi degil.");
    }

    await this.svgHolder.restoreDrawingSnapshot(parsed.snapshot);
    const after = this.captureHistorySnapshot();
    this.pushHistorySnapshotOperation(before, after);
    this.scheduleAutosave();
    this.flushAutosave();
  }

  private determineSizeOfCanvasPixels(el: HTMLElement) {
    const rect = el.getBoundingClientRect();
    this.canvasWidth.set(rect.width);
    this.canvasHeight.set(rect.height);
    // Canvas boyutu degisince icerik temizlenir; yeniden cizim tetikle.
    this.svgHolder.setViewCamera(this.viewPort.get());
  }

  private syncCanvasViewportSize(): void {
    const el = document.getElementById("canvasViewport");
    if (!el) {
      return;
    }

    this.determineSizeOfCanvasPixels(el);
  }

  private getStrokeColorWithAlpha(): string {
    try {
      return ColorUtils.setColorWithAlpha(
        this.settings.strokeColor.get(),
        this.settings.strokeAlpha.get(),
      );
    } catch {
      return this.settings.strokeColor.get();
    }
  }

  generateNew() {
    const confirmed = confirm(
      "Yeni bir proje oluşturmak istediğinize emin misiniz?",
    );
    if (confirmed) {
      // this.properties.generateNew();
      this.svgHolder.restoreDrawingSnapshot({
        data: {
          layers: [
            {
              type: "layer",
              opacity: 1,
              visible: true,
              id: "base",
              elements: [],
            },
          ],
        },
        activeLayerId: "base",
      });
      this.undoRedoHelper.reset();
    }
  }

  onInit(): void {
    // this.restoreSettings();
    this.startAutosaveLoop();
    this.undoRedoHelper.canUndo.subscribe((canUndo) =>
      this.canUndo.set(canUndo),
    );
    this.undoRedoHelper.canRedo.subscribe((canRedo) =>
      this.canRedo.set(canRedo),
    );
    this.settings.appTheme.subscribe((theme) => {
      document.body.setAttribute("theme", theme);
    });
    document.body.setAttribute("theme", this.settings.appTheme.get());
    this.viewPort.subscribe((wp) => {
      this.svgHolder.setViewCamera(wp);
    });
    window.addEventListener("resize", this.handleWindowResize);
    window.visualViewport?.addEventListener(
      "resize",
      this.handleVisualViewportResize,
    );
    window.visualViewport?.addEventListener(
      "scroll",
      this.handleVisualViewportResize,
    );
    window.addEventListener("beforeunload", this.handleBeforeUnload);

    this.appController.onExternalFileOpened?.((file) => {
      void this.loadProjectFromFile(file);
    });

    setTimeout(() => {
      this.syncCanvasViewportSize();
      this.svgHolder.setActiveCanvas(this.canvas as HTMLCanvasElement);
      this.svgHolder.setViewCamera({
        x: this.worldX.get(),
        y: this.worldY.get(),
        scale: this.zoomFactor.get(),
      });

      const restored = this.tryRestoreAutosave();
      if (!restored) {
        this.scheduleAutosave();
        this.flushAutosave();
      }

      void this.appController.checkPendingExternalFile?.().then((file) => {
        if (file) {
          void this.loadProjectFromFile(file);
        }
      });
    }, 150);
  }

  onDestroy(): void {
    this.stopAutosaveLoop();
    this.flushPendingGestureHistory();
    this.flushAutosave();
    window.removeEventListener("resize", this.handleWindowResize);
    window.visualViewport?.removeEventListener(
      "resize",
      this.handleVisualViewportResize,
    );
    window.visualViewport?.removeEventListener(
      "scroll",
      this.handleVisualViewportResize,
    );
    window.removeEventListener("beforeunload", this.handleBeforeUnload);
  }

  private applyZoomAtCanvasPoint(
    zoom: number,
    canvasOffsetX: number,
    canvasOffsetY: number,
  ): void {
    const scale = this.zoomFactor.get();
    // Imlecin altindaki dunya noktasini sabit tutarak yakinlas/uzaklas.
    const worldX = this.worldX.get() + canvasOffsetX / scale;
    const worldY = this.worldY.get() + canvasOffsetY / scale;

    const newScale = Math.max(MIN_SCALE, Math.min(MAX_SCALE, scale * zoom));
    const effectiveZoom = newScale / scale;
    if (effectiveZoom === 1) {
      return;
    }

    this.updateToolSizesForZoom(effectiveZoom);
    this.zoomFactor.set(newScale);
    this.worldX.set(worldX - canvasOffsetX / newScale);
    this.worldY.set(worldY - canvasOffsetY / newScale);
  }

  private updateToolSizesForZoom(zoom: number): void {
    if (!this.settings.scaleToolSizesWithZoom.get()) {
      return;
    }

    this.settings.baseStrokeWidth.set(
      Math.max(1, Math.min(100, this.settings.baseStrokeWidth.get() * zoom)),
    );
    this.settings.eraserSize.set(
      Math.max(4, Math.min(200, this.settings.eraserSize.get() * zoom)),
    );
  }

  private resetZoom(): void {
    const currentZoom = this.zoomFactor.get();
    if (currentZoom !== 0) {
      this.updateToolSizesForZoom(1 / currentZoom);
    }
    this.zoomFactor.set(1);
    this.worldX.set(0);
    this.worldY.set(0);
  }

  private getPinchDistance(): number {
    const points = Array.from(this.activePointers.values());
    if (points.length < 2) {
      return 0;
    }

    const [first, second] = points;
    const distanceX = second.x - first.x;
    const distanceY = second.y - first.y;
    return Math.hypot(distanceX, distanceY);
  }

  private getPinchCenter(): { x: number; y: number } {
    const points = Array.from(this.activePointers.values());
    if (points.length < 2) {
      return { x: this.clickedCameraX.get(), y: this.clickedCameraY.get() };
    }

    const [first, second] = points;
    return {
      x: (first.x + second.x) / 2,
      y: (first.y + second.y) / 2,
    };
  }

  private getPointerOffsetFromEvent(event: PointerEvent | WheelEvent): {
    x: number;
    y: number;
  } {
    const currentTarget = event.currentTarget as HTMLElement | null;
    const fallbackTarget = this.canvas as HTMLCanvasElement;
    const rect = (currentTarget || fallbackTarget).getBoundingClientRect();
    const x = Math.max(0, Math.min(rect.width, event.clientX - rect.left));
    const y = Math.max(0, Math.min(rect.height, event.clientY - rect.top));
    return { x, y };
  }

  private updatePointerPosition(event: PointerEvent): void {
    const pointer = this.getPointerOffsetFromEvent(event);
    this.activePointers.set(event.pointerId, {
      x: pointer.x,
      y: pointer.y,
    });
  }

  getCanvasPointInViewBox(
    offsetX: number,
    offsetY: number,
  ): { x: number; y: number } {
    const scale = this.zoomFactor.get();
    return {
      x: this.worldX.get() + offsetX / scale,
      y: this.worldY.get() + offsetY / scale,
    };
  }

  onPointerDown(event: PointerEvent): void {
    // SAMSUNG SPEN DESTEKLEMİYOR...
    // alert(event.pointerType + " " + event.button);
    // if (event.pointerType === "pen" && event.button === 2) {
    //     alert("Kalem ile sag tiklama desteklenmiyor. Lütfen kalemin ucu ile tiklayin.");
    //     return;
    // }

    if (event.pointerType === "mouse" && event.button !== 0) {
      return;
    }

    const pointer = this.getPointerOffsetFromEvent(event);
    this.updateCursor(pointer.x, pointer.y);

    this.updatePointerPosition(event);
    (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);

    if (this.activePointers.size === 1) {
      this.isPointerDragging = true;
      this.activePointerId = event.pointerId;
      this.smoothedPressure =
        event.pointerType === "pen"
          ? Math.max(0, Math.min(1, event.pressure || 0))
          : null;
      const strokeWidth = this.drawTools.getStrokeWidthFromPressure(event);

      this.drawTools.startInteraction(
        pointer.x,
        pointer.y,
        event.pointerType,
        strokeWidth,
      );
      return;
    }

    if (this.activePointers.size === 2) {
      this.isPointerDragging = false;
      this.activePointerId = null;
      this.lastPinchDistance = this.getPinchDistance();
    }
  }

  onMouseWheel(event: WheelEvent): void {
    event.preventDefault();
    const zoomIntensity = 0.1;
    const wheelUp = event.deltaY < 0;
    const zoomIn = this.settings.zoomDirection.get() === 1 ? wheelUp : !wheelUp;
    const zoom = zoomIn ? 1 + zoomIntensity : 1 - zoomIntensity;
    const pointer = this.getPointerOffsetFromEvent(event);
    this.applyZoomAtCanvasPoint(zoom, pointer.x, pointer.y);
  }

  onPointerMove(event: PointerEvent): void {
    const pointer = this.getPointerOffsetFromEvent(event);
    this.updateCursor(pointer.x, pointer.y, this.mode.get() === "pointer");

    if (!this.activePointers.has(event.pointerId)) {
      return;
    }

    this.updatePointerPosition(event);

    if (this.activePointers.size === 2) {
      const pinchDistance = this.getPinchDistance();
      const { x, y } = this.getPinchCenter();
      listenPinch({
        direction: this.settings.zoomDirection.get(),
        currentDistance: pinchDistance,
        lastDistance: this.lastPinchDistance,
        centerX: x,
        centerY: y,
        onZoom: (zoom, centerX, centerY) => {
          this.applyZoomAtCanvasPoint(zoom, centerX, centerY);
        },
      });
      this.lastPinchDistance = pinchDistance;
      return;
    }

    if (!this.isPointerDragging || this.activePointerId !== event.pointerId) {
      return;
    }

    const deltaX = pointer.x - this.clickedCameraX.get();
    const deltaY = pointer.y - this.clickedCameraY.get();
    const scale = this.zoomFactor.get();

    if (this.drawTools.shouldPanWithPointer(event.pointerType)) {
      this.worldX.update((currentX) => currentX - deltaX / scale);
      this.worldY.update((currentY) => currentY - deltaY / scale);
      this.clickedCameraX.set(pointer.x);
      this.clickedCameraY.set(pointer.y);
    } else {
      this.drawTools.handleToolMove(event, pointer.x, pointer.y);
    }
  }

  teleportNearestElement(rotation: number): void {
    const pointHasLive = this.svgHolder.findNearestPointHasElement(rotation);

    if (!pointHasLive) {
      return;
    }

    const scale = this.zoomFactor.get();
    this.worldX.set(pointHasLive.x - this.canvasWidth.get() / scale / 2);
    this.worldY.set(pointHasLive.y - this.canvasHeight.get() / scale / 2);
  }

  private updateCursor(
    offsetX: number,
    offsetY: number,
    renderCursor = true,
  ): void {
    // Boya kovasinda firca onizlemesi anlamsiz; imlec cizilmez.
    if (this.settings.drawType.get() === "fill") {
      this.svgHolder.setCursorPosition(undefined);
      return;
    }
    if (!renderCursor) {
      this.svgHolder.setCursorPosition(undefined);
      return;
    }
    this.svgHolder.setCursorPosition({
      x: offsetX,
      y: offsetY,
      size:
        this.settings.drawType.get() === "erase"
          ? this.settings.eraserSize.get()
          : this.settings.baseStrokeWidth.get(),
      color: this.getStrokeColorWithAlpha(),
      type: this.settings.drawType.get() === "erase" ? "outlined" : "filled",
    });
  }

  onPointerUp(event: PointerEvent): void {
    this.activePointers.delete(event.pointerId);
    if (
      (event.currentTarget as HTMLElement).hasPointerCapture(event.pointerId)
    ) {
      (event.currentTarget as HTMLElement).releasePointerCapture(
        event.pointerId,
      );
    }

    if (this.activePointers.size >= 2) {
      this.lastPinchDistance = this.getPinchDistance();
      return;
    }

    this.lastPinchDistance = 0;

    if (this.activePointers.size === 1) {
      const remainingPointerEntry = this.activePointers.entries().next();
      if (remainingPointerEntry.done) {
        this.isPointerDragging = false;
        this.activePointerId = null;
        return;
      }

      const [pointerId, pointerPosition] = remainingPointerEntry.value;
      this.activePointerId = pointerId;
      this.isPointerDragging = true;
      this.clickedCameraX.set(pointerPosition.x);
      this.clickedCameraY.set(pointerPosition.y);

      return;
    }

    this.isPointerDragging = false;
    this.activePointerId = null;

    this.drawTools.finishInteraction(event.pointerType);
  }

  onKeyDown(event: KeyboardEvent): void {
    const key = event.key.toLowerCase();
    const isMetaPressed = event.ctrlKey || event.metaKey;
    if (isMetaPressed && key === "z") {
      event.preventDefault();
      this.flushPendingGestureHistory();
      if (event.shiftKey) {
        void this.undoRedoHelper
          .redo()
          .catch((error) => console.error("Redo uygulanamadi:", error));
      } else {
        void this.undoRedoHelper
          .undo()
          .catch((error) => console.error("Undo uygulanamadi:", error));
      }
      return;
    }

    if (isMetaPressed && key === "y") {
      event.preventDefault();
      this.flushPendingGestureHistory();
      void this.undoRedoHelper
        .redo()
        .catch((error) => console.error("Redo uygulanamadi:", error));
      return;
    }

    const canvasCenterX = (this.canvas as HTMLCanvasElement).clientWidth / 2;
    const canvasCenterY = (this.canvas as HTMLCanvasElement).clientHeight / 2;

    listenKey({
      event,
      scale: this.zoomFactor.get(),
      canvasCenterX,
      canvasCenterY,
      onPan: (deltaX, deltaY) => {
        this.worldX.update((currentX) => currentX + deltaX);
        this.worldY.update((currentY) => currentY + deltaY);
      },
      onZoom: (zoom, centerX, centerY) => {
        this.applyZoomAtCanvasPoint(zoom, centerX, centerY);
      },
      onResetZoom: () => {
        this.resetZoom();
      },
    });
  }

  captureHistorySnapshot(): XDrawHistorySnapshot {
    return this.svgHolder.captureUndoSnapshot();
  }

  pushHistorySnapshotOperation(
    before: XDrawHistorySnapshot,
    after: XDrawHistorySnapshot,
  ): void {
    if (
      before.activeLayerId === after.activeLayerId &&
      xdrawBuffersEqual(before.buffer, after.buffer) &&
      xdrawSkeletonsEqual(before.skeleton, after.skeleton)
    ) {
      return;
    }

    void this.undoRedoHelper
      .pushOperationQueue(
        {
          apply: async () => {
            await this.svgHolder.restoreUndoSnapshot(after);
          },
          revert: async () => {
            await this.svgHolder.restoreUndoSnapshot(before);
          },
        },
        true,
        false,
      )
      .catch((error) => {
        console.error("History operation eklenemedi:", error);
      });

    this.scheduleAutosave();
  }

  beginGestureHistoryCapture(): void {
    // Bekleyen bir finalize varsa iptal edilir; yeni stroke ayni undo adimina dahil olur.
    if (this.gestureFinalizeTimerId !== null) {
      window.clearTimeout(this.gestureFinalizeTimerId);
      this.gestureFinalizeTimerId = null;
    }
    if (this.gestureHistoryBeforeSnapshot) {
      return;
    }
    this.gestureHistoryBeforeSnapshot = this.captureHistorySnapshot();
  }

  finishGestureHistoryCapture(): void {
    if (!this.gestureHistoryBeforeSnapshot) {
      return;
    }

    if (this.gestureFinalizeTimerId !== null) {
      window.clearTimeout(this.gestureFinalizeTimerId);
    }
    this.gestureFinalizeTimerId = window.setTimeout(() => {
      this.gestureFinalizeTimerId = null;
      this.commitGestureHistory();
    }, CanvasDraw.GESTURE_FINALIZE_DELAY_MS);
  }

  private commitGestureHistory(): void {
    const before = this.gestureHistoryBeforeSnapshot;
    if (!before) {
      return;
    }
    this.gestureHistoryBeforeSnapshot = null;
    const after = this.captureHistorySnapshot();
    this.pushHistorySnapshotOperation(before, after);
    this.flushAutosave();
  }

  // Undo/redo veya sayfa kapanisi gibi anlarda bekleyen commit'i hemen tamamlar.
  private flushPendingGestureHistory(): void {
    if (this.gestureFinalizeTimerId !== null) {
      window.clearTimeout(this.gestureFinalizeTimerId);
      this.gestureFinalizeTimerId = null;
    }
    this.commitGestureHistory();
  }

  render(): NeolitNode {
    return (
      <div className="gap-2 h-[100dvh] w-[100dvw] overflow-hidden box-border position-relative">
        <div className="absolute left-3 top-3 bottom-3 flex flex-col gap-2 justify-center items-center">
          <div className="border border-solid border-gray-500 p-1 bg-(--color-surface-2) rounded-xl z-index-1">
            <CanvasDrawSidebar
              onDownloadProject={this.downloadProject.bind(this)}
              onOpenProjectFromFile={this.openProjectFromFile.bind(this)}
              onSaveAndShareProject={this.saveAndShareProject.bind(this)}
              xdrawDataHolder={this.svgHolder}
              canRedo={this.canRedo}
              generateNew={this.generateNew.bind(this)}
              canUndo={this.canUndo}
              undo={() => {
                this.flushPendingGestureHistory();
                return this.undoRedoHelper.undo();
              }}
              redo={() => {
                this.flushPendingGestureHistory();
                return this.undoRedoHelper.redo();
              }}
              flushAutosave={this.flushAutosave.bind(this)}
              pushHistorySnapshotOperation={this.pushHistorySnapshotOperation.bind(
                this,
              )}
            ></CanvasDrawSidebar>
          </div>
        </div>
        <div
          className="h-full w-full position-absolute top-0 left-0"
          style="touch-action: none; outline: none;"
          tabIndex={0}
          onPointerDown={this.onPointerDown.bind(this)}
          onPointerMove={this.onPointerMove.bind(this)}
          onPointerUp={this.onPointerUp.bind(this)}
          onPointerCancel={this.onPointerUp.bind(this)}
          onWheel={this.onMouseWheel.bind(this)}
          onKeyDown={this.onKeyDown.bind(this)}
        >
          {this.divBetweenButtonsAndBottom}
        </div>
        <div className="p-2 rounded-xl bg-(--color-surface-2) border border-solid border-gray-500 absolute right-3 top-3 flex flex-col gap-2 justify-center items-center">
          X: {this.worldXUI}
          <br />
          Y: {this.worldYUI}
          <br />
          Zoom : {this.zoomFactorUI}
        </div>

        <div className="p-2 rounded-xl border border-solid border-gray-500 bg-(--color-surface-2) absolute right-3 bottom-3 flex flex-col gap-2 justify-center items-center">
          {/* TODO: Aşağı yukarı sağ sol butonları ile uzaktaki elemente doğru ışınlama */}
          <div className="flex flex-row gap-2 justify-center items-center">
            <Button
              icon={materialSymbolsOutlined("keyboard_double_arrow_left")}
              onClick={this.teleportNearestElement.bind(this, 180)}
            ></Button>
            <div className="flex flex-col gap-2 justify-center items-center">
              <Button
                icon={materialSymbolsOutlined("keyboard_double_arrow_up")}
                onClick={this.teleportNearestElement.bind(this, -90)}
              ></Button>
              <Button
                icon={materialSymbolsOutlined("circle")}
                onClick={this.resetZoom.bind(this)}
              ></Button>
              <Button
                icon={materialSymbolsOutlined("keyboard_double_arrow_down")}
                onClick={this.teleportNearestElement.bind(this, 90)}
              ></Button>
            </div>
            <Button
              icon={materialSymbolsOutlined("keyboard_double_arrow_right")}
              onClick={this.teleportNearestElement.bind(this, 0)}
            ></Button>
          </div>
        </div>
      </div>
    );
  }
}
