// Domain model (plain types, no dependencies)
export * from "./model/xdraw-data";

// Pure algorithms operating on the domain model
export * from "./utils/color-utils";
export * from "./utils/xdraw-fill-utils";
export * from "./utils/xdraw-data-utils";
export * from "./utils/xdraw-binary-codec";
export * from "./utils/clone-utils";

// Project state (layers, undo/redo, active document)
export * from "./state/layer-manager";
export * from "./state/data-holder";

// Canvas rendering
export * from "./rendering/data-rasterizer";

// Pointer/keyboard interaction handling
export * from "./interaction/canvas-gesture-listeners";
export * from "./interaction/canvas-draw-tools";

// User-configurable settings
export * from "./settings/xdraw-settings-config";

// Local persistence (autosave)
export * from "./persistence/xdraw-autosave-config";