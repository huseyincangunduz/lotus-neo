import type { CanvasDrawToolHost } from "./canvas-tool-host";

export class FillTool {
    constructor(private host: CanvasDrawToolHost) { }

    start(offsetX: number, offsetY: number): void {
        this.host.svgHolder.setInteractionMode("fill");
        const beforeSnapshot = this.host.captureHistorySnapshot();
        void this.host.svgHolder
            .fillAtCanvasPoint(offsetX, offsetY, this.host.settings.strokeColor.get())
            .then((changed) => {
                if (!changed) {
                    return;
                }
                const afterSnapshot = this.host.captureHistorySnapshot();
                this.host.pushHistorySnapshotOperation(beforeSnapshot, afterSnapshot);
            })
            .catch((error) => console.error("Boya kovasi uygulanamadi:", error));
    }
}
