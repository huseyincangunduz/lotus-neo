import { ColorUtils } from "./color-utils";
import type { XDrawCanvasCamera, XDrawData, XDrawDrawElement, CanvasBackgroundPatternOptions } from "./xdraw-data";
import { XdrawDataUtils } from "./xdraw-data-utils";

export class ProjectDataRasterizer {
    private backgroundPattern?: CanvasBackgroundPatternOptions;
    private cam: XDrawCanvasCamera = { x: 0, y: 0, scale: 1 };
    private activeCanvas?: HTMLCanvasElement;
    private projectData?: XDrawData;
    private cursorPosition?: { x: number; y: number; size: number; color: string; type: "filled" | "outlined" };
    private renderScheduled = false;

    setActiveCanvas(canvas: HTMLCanvasElement) {
        this.activeCanvas = canvas;
        this.requestRender();
    }

    getActiveCanvas(): HTMLCanvasElement | undefined {
        return this.activeCanvas;
    }

    setCursorPosition(cursor: { x: number; y: number; size: number; color: string; type: "filled" | "outlined" }) {
        this.cursorPosition = cursor;
        this.cursorPosition.color = ColorUtils.regularizeToHexColor(this.cursorPosition.color) || this.cursorPosition.color;

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

    setInteractionMode(_mode: string) {
        // Etkilesim modu su an render'i etkilemiyor.
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
        const radius = (size / 2) ;
        context.strokeStyle = color;
        context.fillStyle = color;
        context.lineWidth = type === "outlined" ? Math.min(2, Math.max(1, this.cam.scale)) : 0;

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
    private drawBackground(context: CanvasRenderingContext2D, scale: number, camX: number, camY: number, visible: XDrawData) {
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

    private drawLines(context: CanvasRenderingContext2D, scale: number, camX: number, camY: number, visible: XDrawData) {
        context.setTransform(scale, 0, 0, scale, -camX * scale, -camY * scale);
        context.lineCap = "round";
        context.lineJoin = "round";

        for (const layer of visible.layers) {
            if (layer.visible === false) {
                continue;
            }
            context.globalAlpha = layer.opacity ?? 1;

            for (const element of layer.elements) {
                if (element.type !== "draw") {
                    continue;
                }
                const draw = element as XDrawDrawElement;
                if (draw.points.length === 0) {
                    continue;
                }
                const color = ColorUtils.regularizeToHexColor(draw.color);
                if (!color) {
                    continue;
                }
                const first = draw.points[0];
                if (draw.points.length === 1) {
                    context.fillStyle = color;
                    context.beginPath();
                    context.arc(first.x, first.y, Math.max(0.5, first.size / 2), 0, Math.PI * 2);
                    context.fill();
                    continue;
                }
                context.strokeStyle = color;
                context.lineWidth = first.size;
                context.beginPath();
                context.moveTo(first.x, first.y);
                for (let i = 1; i < draw.points.length; i++) {
                    context.lineTo(draw.points[i].x, draw.points[i].y);
                }
                context.stroke();
            }
        }
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

        const visible = XdrawDataUtils.cropXDrawData(
            this.projectData,
            this.cam,
            canvas.width,
            canvas.height,
        );
        this.drawBackground(context, scale, camX, camY, visible);

        // Kamera donusumu: ekran = (dunya - kamera) * scale
        this.drawLines(context, scale, camX, camY, visible);
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
