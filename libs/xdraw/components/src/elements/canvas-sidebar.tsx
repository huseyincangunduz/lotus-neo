import {
  computed,
  NeolitComponent,
  state,
  type NeolitNode,
} from "@ubs-platform/neolit/core";

import { Button, type ButtonVariant } from "@libs/ui/button";
import { WebDialog } from "@libs/ui/webdialog";
import { materialSymbolsOutlined } from "@libs/ui/icon";
import { Checkbox } from "@libs/ui/checkbox";
import { Trackbar } from "@libs/ui/trackbar";
import { fromState } from "@ubs-platform/neolit/structural";
import { inject } from "@ubs-platform/neolit/injectables";
import { tr, Tr } from "@libs/ui/i18n";
import {
  XDrawDataHolder,
  XDrawSettingsConfig,
  type XDrawHistorySnapshot,
  ColorUtils,
} from "@libs/xdraw/core";
import {
  APP_NATIVE_CONTROLLER_TOKEN,
  type IAppNativeController,
} from "../app-native-controller";

// Bu componentte çoğu yerde state kullanılmayacak. Çünkü elementler rerender edilmeyecek. eğer rerender olursa hem performans sorunları yaşanır hem de canvas ve svg elementleri kaybolur. Bu yüzden state yerine class propertyleri kullanılacak.
export class CanvasDrawSidebar extends NeolitComponent {
  properties = {
    xdrawDataHolder: state(new XDrawDataHolder()),
    onDownloadProject: (saveAs?: boolean) => {},
    onOpenProjectFromFile: () => {},
    onSaveAndShareProject: () => {},
    flushAutosave: () => {},
    redo: () => {},
    undo: () => {},
    generateNew: () => {},
    canRedo: state(false, {
      notifyIncomingWhenSetState: true,
      subscribeIncomingWhenSetState: true,
    }),
    canUndo: state(false, {
      notifyIncomingWhenSetState: true,
      subscribeIncomingWhenSetState: true,
    }),
    pushHistorySnapshotOperation: (
      old: XDrawHistorySnapshot,
      newData: XDrawHistorySnapshot,
    ) => {},
  };
  showColorPickerDialog = state(false);
  showPencilSettingsDialog = state(false);
  showSizeSelectorDialog = state(false);
  menuDialog = state(false);
  layerSettingsDialog = state(false);
  zoomFactor = state(1);
  settings = inject(XDrawSettingsConfig);
  layersState = state<any[]>([]);
  xdrawHolder?: XDrawDataHolder = undefined;
  appController = inject(
    APP_NATIVE_CONTROLLER_TOKEN,
  ) as any as IAppNativeController;
  recentColorsLimited = computed(
    [this.settings.recentColors],
    ([recentColors]) => recentColors.slice(0, 3),
  );
  private colorDialogLastCommittedColor: string | null = null;

  private readonly colorPresets = [
    "#000000",
    "#FFFFFF",
    "#EF4444",
    "#F59E0B",
    "#EAB308",
    "#22C55E",
    "#06B6D4",
    "#3B82F6",
    "#8B5CF6",
    "#EC4899",
    "#6B7280",
    "#92400E",
  ];

  private readonly alphaPresets = [1, 0.8, 0.6, 0.4, 0.2, 0.1];

  private setStrokeAlpha(alpha: number): void {
    this.settings.strokeAlpha.set(
      Number(Math.max(0, Math.min(1, alpha)).toFixed(2)),
    );
  }

  private applyColorPreset(color: string): void {
    this.settings.strokeColor.set(color);
  }

  private applyAlphaPreset(alpha: number): void {
    this.settings.strokeAlpha.set(
      Number(Math.max(0, Math.min(1, alpha)).toFixed(2)),
    );
  }

  private openColorPickerDialog(): void {
    this.colorDialogLastCommittedColor = this.settings.strokeColor.get();
    this.showColorPickerDialog.set(true);
  }

  private commitColorDialogSelection(): void {
    const currentColor = this.settings.strokeColor.get();
    const previousColor = this.colorDialogLastCommittedColor;

    if (!previousColor || previousColor === currentColor) {
      this.colorDialogLastCommittedColor = currentColor;
      return;
    }

    this.settings.recentColors.set(
      [
        previousColor,
        ...this.settings.recentColors
          .get()
          .filter((color) => color !== previousColor && color !== currentColor),
      ].slice(0, 20),
    );

    this.colorDialogLastCommittedColor = currentColor;
  }

  private downloadProject(saveAs?: boolean): void {
    this.properties.onDownloadProject(saveAs);
    this.menuDialog.set(false);
  }

  private openProjectFromFile(): void {
    this.properties.onOpenProjectFromFile();
  }

  private saveAndShareProject(): void {
    this.properties.onSaveAndShareProject();
    this.menuDialog.set(false);
  }

  private getColorChannels(): { r: number; g: number; b: number } {
    const rgb = ColorUtils.hexToRgb(this.settings.strokeColor.get());
    if (!rgb) {
      return { r: 0, g: 0, b: 0 };
    }
    return rgb;
  }

  private setStrokeChannel(channel: "r" | "g" | "b", rawValue: string): void {
    const parsed = Number(rawValue);
    const value = Number.isFinite(parsed)
      ? Math.max(0, Math.min(255, Math.round(parsed)))
      : 0;
    const current = this.getColorChannels();
    const next = { ...current, [channel]: value };
    this.settings.strokeColor.set(ColorUtils.rgbToHex(next.r, next.g, next.b));
  }

  private closeColorPickerDialog(): void {
    this.commitColorDialogSelection();
    this.colorDialogLastCommittedColor = null;
    this.showColorPickerDialog.set(false);
  }

  onInit(): void {
    this.properties.xdrawDataHolder.subscribe((holder) => {
      this.xdrawHolder = holder;
      this.layersState.set(holder?.layersState || []);
    });
    this.xdrawHolder = this.properties.xdrawDataHolder.get();
    this.layersState.set(this.xdrawHolder?.layersState || []);
  }

  onDestroy(): void {
    this.flushAutosave();
  }

  render(): NeolitNode {
    return (
      <div className="flex flex-col gap-2 flex-wrap" id="toolbar">
        <Button
          variant="ghost"
          icon={materialSymbolsOutlined("menu")}
          onClick={() => {
            this.menuDialog.set(true);
          }}
        ></Button>
        <div className="border-t border-(--color-border)"></div>
        <Button
          variant={computed<ButtonVariant>([this.settings.mode], ([mode]) =>
            mode === "pointer" ? "filled-primary" : "ghost",
          )}
          onClick={() => {
            if (this.settings.mode.get() === "pointer") {
              this.showPencilSettingsDialog.set(true);
              return;
            }
            this.settings.mode.set("pointer");
          }}
          icon={materialSymbolsOutlined("arrow_selector_tool")}
        ></Button>
        <Button
          variant={computed<ButtonVariant>(
            [this.settings.mode, this.settings.drawType],
            ([mode, drawType]) =>
              mode === "draw" && drawType === "pencil"
                ? "filled-primary"
                : "ghost",
          )}
          onClick={() => {
            if (
              this.settings.mode.get() === "draw" &&
              this.settings.drawType.get() === "pencil"
            ) {
              this.showPencilSettingsDialog.set(true);
              return;
            }
            this.settings.mode.set("draw");
            this.settings.drawType.set("pencil");
          }}
          icon={materialSymbolsOutlined("edit")}
        ></Button>
        <Button
          variant={computed<ButtonVariant>(
            [this.settings.mode, this.settings.drawType],
            ([mode, drawType]) =>
              mode === "draw" && drawType === "erase"
                ? "filled-primary"
                : "ghost",
          )}
          onClick={() => {
            if (
              this.settings.mode.get() === "draw" &&
              this.settings.drawType.get() === "erase"
            ) {
              this.showPencilSettingsDialog.set(true);
              return;
            }
            this.settings.mode.set("draw");
            this.settings.drawType.set("erase");
          }}
          icon={materialSymbolsOutlined("ink_eraser")}
        ></Button>
        {/* Fill dye arkada canvas oluşturup sürekli çizdiğimiz için çok yavaşlıyor... o yüzden şimdilik ekranda gözükmesin */}
        {/* {false && ( */}
        <Button
          variant={computed<ButtonVariant>(
            [this.settings.mode, this.settings.drawType],
            ([mode, drawType]) =>
              mode === "draw" && drawType === "fill"
                ? "filled-primary"
                : "ghost",
          )}
          onClick={() => {
            this.settings.mode.set("draw");
            this.settings.drawType.set("fill");
          }}
          icon={materialSymbolsOutlined("format_color_fill")}
        ></Button>
        {/* )} */}
        <div className="border-t border-(--color-border)"></div>

        <Button
          variant={computed<ButtonVariant>(
            [this.properties.canUndo],
            ([canUndo]) => (canUndo ? "filled-primary" : "ghost"),
          )}
          onClick={() => {
            if (this.properties.canUndo.get()) {
              this.properties.undo();
            }
          }}
          icon={materialSymbolsOutlined("undo")}
        ></Button>
        <Button
          variant={computed<ButtonVariant>(
            [this.properties.canRedo],
            ([canRedo]) => (canRedo ? "filled-primary" : "ghost"),
          )}
          onClick={() => {
            if (this.properties.canRedo.get()) {
              this.properties.redo();
            }
          }}
          icon={materialSymbolsOutlined("redo")}
        ></Button>
        <div className="border-t border-(--color-border)"></div>

        <Button
          variant={computed<ButtonVariant>(
            [this.settings.backgroundPatternMode],
            ([enabled]) => (enabled ? "filled-primary" : "ghost"),
          )}
          onClick={() => {
            this.settings.backgroundPatternMode.update(
              (currentMode) => ((currentMode + 1) % 3) as 0 | 1 | 2,
            );

            // this.properties.xdrawDataHolder.get().setBackgroundPattern((currentMode + 1) % 3 as 0 | 1 | 2);
          }}
          icon={materialSymbolsOutlined("grid_on")}
        ></Button>

        <button
          type="button"
          className="w-10 h-10 rounded-sm border border-(--color-border) cursor-pointer"
          style={{ backgroundColor: this.settings.strokeColor }}
          title={this.settings.strokeColor}
          aria-label={`Rengi seçimi`}
          onClick={() => {
            this.openColorPickerDialog();
          }}
        ></button>
        <div className="flex flex-col gap-1">
          {fromState(this.recentColorsLimited)
            .keyFn((color) => color)
            .renderFor((color) => (
              <button
                type="button"
                className="w-10 h-10 rounded-sm border border-(--color-border) cursor-pointer"
                style={{ backgroundColor: color }}
                title={color}
                aria-label={`Rengi seç: ${color}`}
                onClick={() => {
                  if (this.settings.strokeColor.get() === color) {
                    this.openColorPickerDialog();
                    return;
                  }
                  this.settings.strokeColor.set(color);
                }}
              ></button>
            ))}
        </div>

        {/*Katmanlar */}
        <Button
          icon={materialSymbolsOutlined("layers")}
          onClick={() => {
            this.layerSettingsDialog.set(true);
          }}
        ></Button>
        <WebDialog
          show={this.menuDialog}
          mode="popover"
          anchorSelector="#toolbar"
          placement="right"
          width="280px"
          maxHeight="320px"
          displayHeader={false}
          displayCloseButton={false}
        >
          {/* <img
            src={computed([this.settings.appTheme], ([theme]) =>
              theme === "light" ? "xdraw-logo-blk.png" : "xdraw-logo.png",
            )}
            alt="XDraw Logo"
            style="height: 60px"
          /> */}

          <div className="flex flex-col gap-1">
            <Button
              variant="ghost"
              label={tr("general.new")}
              padding={1}
              onClick={() => {
                void this.generateNew();
              }}
            ></Button>
            <Button
              variant="ghost"
              label={tr("general.open")}
              padding={1}
              onClick={() => {
                void this.openProjectFromFile();
              }}
            ></Button>
            <Button
              variant="ghost"
              padding={1}
              label={
                this.appController.isMobileApp ||
                this.appController.isElectronApp
                  ? tr("general.save")
                  : tr("general.download")
              }
              onClick={() => {
                this.downloadProject();
              }}
            ></Button>

            {(this.appController.isMobileApp ||
              this.appController.isElectronApp) && (
              <Button
                variant="ghost"
                label={tr("general.save-as")}
                padding={1}
                onClick={() => {
                  this.downloadProject(true);
                }}
              ></Button>
            )}

            {this.appController.isMobileApp && (
              <Button
                variant="ghost"
                label={tr("general.save-and-share")}
                padding={1}
                onClick={() => {
                  this.saveAndShareProject();
                }}
              ></Button>
            )}

            {/* <Button variant="ghost" label="Kütüphane" ></Button> */}

            <div>
              <Button
                padding={1}
                onClick={() => {
                  this.settings.appTheme.update((currentTheme) =>
                    currentTheme === "light" ? "dark" : "light",
                  );
                }}
                // label={
                //   computed([this.settings.appTheme], ([appTheme]) =>
                //     appTheme === "light"
                //       ? "Koyu Temaya geç"
                //       : "Açık Temaya geç",
                //   ) as any
                // }
                icon={materialSymbolsOutlined("invert_colors")}
              ></Button>
            </div>
          </div>
          <sub>
            <p className="text-xs text-(--color-text-muted)">
              {this.appController.appName ?? "XDraw"} v
              {import.meta.env.PACKAGE_VERSION}
              <br></br>
              <Tr params={{ version: import.meta.env.PACKAGE_VERSION }}>
                xdraw.about.version
              </Tr>
              <br></br>
              <Tr
                params={{
                  author: "Tetakent(H.C.G)",
                  year: import.meta.env.PACKAGE_BUILD_DATE || 2026,
                }}
              >
                xdraw.about.copyright
              </Tr>
              <br></br>
              <a
                href="https://tetakent.com"
                target="_blank"
                rel="noopener noreferrer"
              >
                <img
                  src="tkneolitxdraw.png"
                  alt="Tetakent Logo"
                  style="display: inline-block; margin-left: 4px; height: 32px; "
                ></img>
              </a>
            </p>
          </sub>
          {/* <img src="tkneolitxdraw.png" alt="TKN Eolit XDraw Logo"></img> */}
        </WebDialog>
        <WebDialog
          show={this.showPencilSettingsDialog}
          mode="popover"
          anchorSelector="#toolbar"
          placement="right"
          width="280px"
          displayHeader={false}
          displayCloseButton={false}
        >
          {/* Checked checkbox içinde state olduğu için state değişikliklerini güncelleme konusunda onchange'e gerek yoktur. */}
          <h2>{tr("xdraw.draw.pen-settings")}</h2>
          <Trackbar
            label={tr("xdraw.draw.brush-size")}
            min={1}
            max={100}
            step={1}
            value={this.settings.baseStrokeWidth}
          ></Trackbar>
          <Trackbar
            label={tr("xdraw.draw.eraser-size")}
            min={4}
            max={200}
            step={1}
            value={this.settings.eraserSize}
          ></Trackbar>
          <Checkbox
            label={tr("xdraw.draw.allow-only-pen-on-tablet")}
            checked={this.settings.stylusModeEnabled}
          ></Checkbox>
          <Checkbox
            label={tr("xdraw.draw.size-change-by-pressure")}
            checked={this.settings.pressureWidthEnabled}
          ></Checkbox>
          <Checkbox
            label={tr("xdraw.draw.scale-tool-sizes-with-zoom")}
            checked={this.settings.scaleToolSizesWithZoom}
          ></Checkbox>
          <Trackbar
            label={tr("xdraw.draw.pen-pressure-smoothing")}
            min={0}
            max={1}
            step={0.01}
            value={this.settings.pressureSmoothing}
          ></Trackbar>
          <h2>{tr("xdraw.draw.navigation-settings")}</h2>
          <Checkbox
            label={tr("xdraw.draw.invert-zoom-direction")}
            checked={computed(
              [this.settings.zoomDirection],
              ([zoomDirection]) => zoomDirection === -1,
            )}
            onChange={(checked: boolean) => {
              this.settings.zoomDirection.set(checked ? -1 : 1);
            }}
          ></Checkbox>
        </WebDialog>

        <WebDialog
          show={this.showColorPickerDialog}
          mode="popover"
          anchorSelector="#toolbar"
          placement="right"
          width="280px"
          maxHeight="70dvh"
          onClose={() => this.closeColorPickerDialog()}
          displayHeader={false}
          displayCloseButton={false}
        >
          <h2>
            <Tr>xdraw.color.selector</Tr>
          </h2>
          <div className="flex flex-col gap-2">
            <div className="flex flex-col gap-1">
              <label className="text-sm">
                <Tr>xdraw.colors.predefined</Tr>
              </label>
              <div className="grid grid-cols-6 gap-1">
                {this.colorPresets.map((color) => (
                  <button
                    type="button"
                    className="w-8 h-8 rounded border border-(--color-border) cursor-pointer"
                    style={`background-color: ${color};`}
                    title={color}
                    aria-label={tr("xdraw.color.predefined", {
                      color: color,
                    }).get()}
                    onClick={() => this.applyColorPreset(color)}
                  ></button>
                ))}
              </div>
              <label className="text-sm">
                <Tr>xdraw.colors.previous</Tr>
              </label>
              {/* Diyalogta daha fazla önceki renkleri gösterebiliriz... */}
              <div className="grid grid-cols-6 gap-1">
                {fromState(this.settings.recentColors)
                  .keyFn((c) => c)
                  .renderFor((color) => (
                    <button
                      type="button"
                      className="w-8 h-8 rounded border border-(--color-border) cursor-pointer"
                      style={`background-color: ${color};`}
                      title={color}
                      aria-label={
                        <Tr params={{ color: color }}>xdraw.colors.previous</Tr>
                      }
                      onClick={() => this.applyColorPreset(color)}
                    ></button>
                  ))}
              </div>
            </div>
            <input
              type="color"
              value={this.settings.strokeColor}
              onInput={(event: Event) => {
                const target = event.target as HTMLInputElement;
                this.settings.strokeColor.set(target.value);
              }}
              onChange={() => this.commitColorDialogSelection()}
              title={tr("xdraw.color.stroke").get()}
              width="100%"
            />

            {/* <div
              className="h-8 rounded border border-(--color-border)"
              style={computed(
                [this.settings.strokeColor, this.settings.strokeAlpha],
                ([strokeColor, strokeAlpha]) =>
                  `background-color: ${ColorUtils.setColorWithAlpha(strokeColor, strokeAlpha)};`,
              )}
              title="Canli renk onizlemesi"
            ></div> */}
            <Trackbar
              label="R"
              min={0}
              max={255}
              step={1}
              value={computed(
                [this.settings.strokeColor],
                () => this.getColorChannels().r,
              )}
              onChange={(value: number) =>
                this.setStrokeChannel("r", String(value))
              }
              onChangeEnd={() => this.commitColorDialogSelection()}
            ></Trackbar>
            <Trackbar
              label="G"
              min={0}
              max={255}
              step={1}
              value={computed(
                [this.settings.strokeColor],
                () => this.getColorChannels().g,
              )}
              onChange={(value: number) =>
                this.setStrokeChannel("g", String(value))
              }
              onChangeEnd={() => this.commitColorDialogSelection()}
            ></Trackbar>
            <Trackbar
              label="B"
              min={0}
              max={255}
              step={1}
              value={computed(
                [this.settings.strokeColor],
                () => this.getColorChannels().b,
              )}
              onChange={(value: number) =>
                this.setStrokeChannel("b", String(value))
              }
              onChangeEnd={() => this.commitColorDialogSelection()}
            ></Trackbar>
            <Trackbar
              label="A"
              min={0}
              max={1}
              step={0.01}
              value={this.settings.strokeAlpha}
              onChange={(value: number) => this.setStrokeAlpha(value)}
            ></Trackbar>
            <div className="flex flex-col gap-1">
              <div className="grid grid-cols-6 gap-1">
                {this.alphaPresets.map((alpha) => (
                  <button
                    type="button"
                    className="h-8 rounded border border-(--color-border) text-xs"
                    title={tr("xdraw.color.alpha", {
                      alpha: String(alpha),
                    }).get()}
                    onClick={() => this.applyAlphaPreset(alpha)}
                  >
                    {alpha}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </WebDialog>
        <WebDialog
          show={this.layerSettingsDialog}
          mode="popover"
          anchorSelector="#toolbar"
          placement="right"
          width="280px"
          maxHeight="70dvh"
          onClose={() => this.layerSettingsDialog.set(false)}
          displayHeader={false}
          displayCloseButton={false}
        >
          <div className="flex flex-col gap-1">
            <div className="flex flex-col gap-1">
              {fromState(this.layersState)
                .keyFn((a) => a.id)
                .renderForLegacy((layer) => (
                  <div className="flex flex-row gap-1 items-center">
                    <Button
                      style={{ width: "100%" }}
                      onClick={() => {
                        if (
                          this.properties.xdrawDataHolder
                            .get()
                            .getActiveLayerId() === layer.id
                        ) {
                          this.layerSettingsDialog.set(true);
                          return;
                        }

                        this.runMutationWithHistory(() =>
                          this.properties.xdrawDataHolder
                            .get()
                            .setActiveLayer(layer.id),
                        );
                      }}
                      variant={
                        layer.currentSessionActive ? "filled-primary" : "ghost"
                      }
                      label={
                        layer.id === "base"
                          ? tr("xdraw.layer.base")
                          : tr("xdraw.layer.nth", { n: String(layer.id) })
                      }
                      icon={
                        layer.id === "base"
                          ? materialSymbolsOutlined("star")
                          : materialSymbolsOutlined("layers")
                      }
                    ></Button>
                    {layer.id !== "base" && (
                      <Button
                        variant="ghost"
                        icon={materialSymbolsOutlined("delete")}
                        onClick={() => {
                          if (layer.id === "base") {
                            alert(tr("xdraw.layer.delete-base").get());
                            return;
                          }
                          this.runMutationWithHistory(() => {
                            this.properties.xdrawDataHolder
                              .get()
                              .deleteLayer(layer.id);
                          });
                        }}
                      ></Button>
                    )}
                  </div>
                ))}
            </div>
            <Button
              style={{ width: "100%" }}
              onClick={this.runMutationWithHistory.bind(this, () => {
                this.xdrawHolder?.createLayer();
              })}
              label={tr("xdraw.layer.new")}
              icon={materialSymbolsOutlined("add")}
              variant={"outline-primary"}
            ></Button>
          </div>

          <h2>
            <Tr>xdraw.layer.settings</Tr>
          </h2>

          <Trackbar
            label={tr("xdraw.layer.opacity")}
            min={0}
            max={1}
            step={0.01}
            value={this.properties.xdrawDataHolder
              .get()
              .getActiveLayerOpacity()}
            onChange={(value: number) => {
              const activeLayerId = this.properties.xdrawDataHolder
                .get()
                .getActiveLayerId();
              this.properties.xdrawDataHolder
                .get()
                .setLayerOpacity(activeLayerId, value);
            }}
            onChangeEnd={(value: number) => {
              const activeLayerId = this.properties.xdrawDataHolder
                .get()
                .getActiveLayerId();
              this.runMutationWithHistory(() => {
                this.properties.xdrawDataHolder
                  .get()
                  .setLayerOpacity(activeLayerId, value);
              });
            }}
          ></Trackbar>
        </WebDialog>
      </div>
    );
  }
  generateNew() {
    this.properties.generateNew();
    this.menuDialog.set(false);
  }

  private runMutationWithHistory(mutate: () => void): void {
    const before = this.captureHistorySnapshot();
    mutate();
    const after = this.captureHistorySnapshot();
    this.pushHistorySnapshotOperation(before, after);
    this.flushAutosave();
  }

  flushAutosave(): void {
    this.properties.flushAutosave();
  }

  captureHistorySnapshot(): XDrawHistorySnapshot {
    if (!this.xdrawHolder) {
      throw new Error("SVG holder is not initialized.");
    }
    return this.xdrawHolder.captureUndoSnapshot();
  }

  pushHistorySnapshotOperation(
    before: XDrawHistorySnapshot,
    after: XDrawHistorySnapshot,
  ): void {
    this.properties.pushHistorySnapshotOperation(before, after);
  }
}
