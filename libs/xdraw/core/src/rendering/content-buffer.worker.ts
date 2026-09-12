/// <reference lib="webworker" />

import type { XDrawData } from "../model/xdraw-data";
import { CanvasElementPainter } from "./canvas-element-painter";
import type { ContentBufferViewport } from "./content-buffer-backend";
import { ContentBufferRenderer } from "./content-buffer-renderer";
import type { ContentBufferWorkerRequest, ContentBufferWorkerResponse } from "./content-buffer-worker-messages";

const workerScope = self as unknown as DedicatedWorkerGlobalScope;

let renderer: ContentBufferRenderer | undefined;
let data: XDrawData | undefined;
let viewport: ContentBufferViewport | undefined;

function postResponse(response: ContentBufferWorkerResponse, transfer: Transferable[] = []): void {
    workerScope.postMessage(response, transfer);
}

workerScope.onmessage = (event: MessageEvent<ContentBufferWorkerRequest>) => {
    void handleMessage(event.data).catch((error: unknown) => {
        const request = event.data;
        postResponse({
            type: "error",
            message: error instanceof Error ? error.message : String(error),
            dataRevision: request.type === "render" ? request.dataRevision : undefined,
            renderRevision: request.type === "render" ? request.renderRevision : undefined,
        });
    });
};

async function handleMessage(message: ContentBufferWorkerRequest): Promise<void> {
    switch (message.type) {
        case "initialize":
            renderer = new ContentBufferRenderer(
                new CanvasElementPainter(),
                (width, height) => new OffscreenCanvas(width, height),
                message.options,
            );
            postResponse({ type: "initialized" });
            return;
        case "set-snapshot":
            data = message.data;
            return;
        case "set-viewport":
            viewport = message.viewport;
            return;
        case "invalidate":
            renderer?.invalidate();
            return;
        case "render":
            await renderBuffer(message.dataRevision, message.renderRevision);
    }
}

async function renderBuffer(dataRevision: number, renderRevision: number): Promise<void> {
    if (!renderer || !data || !viewport) {
        throw new Error("Content buffer worker is not initialized.");
    }

    const { camera, width, height } = viewport;
    if (!renderer.isCurrent(camera, width, height)) {
        renderer.rebuild(data, camera, width, height);
    }

    const canvas = renderer.getCanvas();
    const buffer = renderer.getBufferInfo();
    if (!(canvas instanceof OffscreenCanvas) || !buffer) {
        throw new Error("Content buffer worker could not create an OffscreenCanvas frame.");
    }

    const bitmap = await createImageBitmap(canvas);
    postResponse(
        { type: "buffer-ready", bitmap, buffer, dataRevision, renderRevision },
        [bitmap],
    );
}
