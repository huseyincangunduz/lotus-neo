import type { XDrawData, XDrawLayer } from "./xdraw-data";

export interface XDrawLayerOptions {
    opacity?: number;
    visible?: boolean;
    insertBeforeLayerId?: string;
}

export class LayerManager {
    private xdrawData: XDrawData;
    private layers = new Map<string, XDrawLayer>();
    private activeLayerId: string;

    constructor(rootXDrawData: XDrawData, defaultLayerId: string = "default") {
        this.xdrawData = rootXDrawData;
        for (const layer of rootXDrawData.layers) {
            this.layers.set(layer.id, layer);
        }
        this.activeLayerId = defaultLayerId;
        this.ensureLayer(defaultLayerId);
    }

    addLayer(layer : XDrawLayer): void {
        if (this.layers.has(layer.id)) {
            layer.id = layer.id + "_" + Date.now();
        }
        this.xdrawData.layers.push(layer);
        this.layers.set(layer.id, layer);
    }

    createLayer(layerId?: string, options: XDrawLayerOptions = {}): XDrawLayer {
        if (layerId === undefined) {
            let count = 1;
            do {
                layerId = count.toString();
                count++;
            } while (this.layers.has(layerId));
        }
        const newLayer: XDrawLayer = {
            id: layerId,
            type: "layer",
            elements: [],
            opacity: options.opacity !== undefined ? Math.max(0, Math.min(1, options.opacity)) : 1,
            visible: options.visible !== undefined ? options.visible : true,
        };
        if (options.insertBeforeLayerId) {
            const index = this.xdrawData.layers.findIndex(l => l.id === options.insertBeforeLayerId);
            if (index !== -1) {
                this.xdrawData.layers.splice(index, 0, newLayer);
            } else {
                this.xdrawData.layers.push(newLayer);
            }
        } else {
            this.xdrawData.layers.push(newLayer);
        }

        this.layers.set(layerId, newLayer);
        return newLayer;
    }

    setActiveLayer(layerId: string): XDrawLayer {
        this.activeLayerId = layerId;
        return this.ensureLayer(layerId);
    }

    deleteLayer(layerId: string): boolean {
        const layer = this.layers.get(layerId);
        if (!layer) {
            return false;
        }
        const filtered = this.xdrawData.layers.filter(l => l.id !== layerId);
        this.xdrawData.layers = filtered;
        this.setActiveLayer(filtered.length > 0 ? filtered[0].id : "");
        this.layers.delete(layerId);
        // this.activeLayerId = this.xdrawData.layers.length > 0 ? this.xdrawData.layers[0].id : "";
        return true;
    }

    getActiveLayerId(): string {
        return this.activeLayerId;
    }

    getLayer(layerId: string): XDrawLayer | null {
        return this.layers.get(layerId) || null;
    }

    getActiveLayer(): XDrawLayer {
        return this.ensureLayer(this.activeLayerId);
    }

    clearLayer(layerId: string): void {
        const layer = this.layers.get(layerId);
        if (!layer) {
            return;
        }

        layer.elements = [];
    }

    setLayerOpacity(layerId: string, opacity: number): void {
        const layer = this.ensureLayer(layerId);
        layer.opacity = Math.max(0, Math.min(1, opacity));
    }

    setLayerVisible(layerId: string, visible: boolean): void {
        const layer = this.ensureLayer(layerId);
        layer.visible = visible;
    }

    listLayers(): Array<XDrawLayer> {
        return this.xdrawData.layers.slice();
    }

    private ensureLayer(layerId: string): XDrawLayer {
        return this.layers.get(layerId) || this.createLayer(layerId);
    }
}
