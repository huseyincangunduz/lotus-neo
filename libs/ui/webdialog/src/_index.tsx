import {
  NeolitComponent,
  State,
  computed,
  getStateValue,
  isState,
  state,
  type NeolitChild,
  type NeolitNode,
  type StateOrPlain,
} from "@ubs-platform/neolit/core";
import styles from "./webdialog.module.scss";
import { fromState } from "@ubs-platform/neolit/structural";
import { Button } from "@libs/ui/button";
import { materialSymbolsOutlined } from "@libs/ui/icon";

export type DialogPosition =
  | "center"
  | "right"
  | "left"
  | "bottom-center"
  | "bottom";
export type DialogMode = "modal" | "popover";
export type DialogPlacement =
  | "top-start"
  | "top"
  | "top-end"
  | "right-start"
  | "right"
  | "right-end"
  | "bottom-start"
  | "bottom"
  | "bottom-end"
  | "left-start"
  | "left"
  | "left-end";
const ALL_POPOVER_PLACEMENTS: DialogPlacement[] = [
  "top-start",
  "top",
  "top-end",
  "right-start",
  "right",
  "right-end",
  "bottom-start",
  "bottom",
  "bottom-end",
  "left-start",
  "left",
  "left-end",
];
export type AnimationState = "HIDE" | "BEGIN" | "HOLD" | "OUT";

export interface WebDialogProps {
  children: NeolitChild[] | State<NeolitChild | NeolitChild[]>;
  title?: StateOrPlain<string>;
  show: StateOrPlain<boolean>;
  onClose?: () => void;
  padding?: StateOrPlain<boolean>;
  position?: StateOrPlain<DialogPosition>;
  displayHeader?: StateOrPlain<boolean>;
  displayCloseButton?: StateOrPlain<boolean>;
  maxWidth?: StateOrPlain<string>;
  maxHeight?: StateOrPlain<string>;
  width?: StateOrPlain<string>;
  height?: StateOrPlain<string>;
  dismissOnClickMask?: StateOrPlain<boolean>;
  animationDuration?: StateOrPlain<number>;
  animationDelay?: StateOrPlain<number>;
  mode?: StateOrPlain<DialogMode>;
  anchorElement?: StateOrPlain<HTMLElement | null>;
  anchorSelector?: StateOrPlain<string>;
  placement?: StateOrPlain<DialogPlacement>;
  autoFlip?: StateOrPlain<boolean>;
  popoverOffset?: StateOrPlain<number>;
  popoverBoundaryPadding?: StateOrPlain<number>;
  showMaskInPopover?: StateOrPlain<boolean>;
}

export class WebDialog extends NeolitComponent<WebDialogProps> {
  properties: WebDialogProps = {
    // title: state<string>(""),
    show: state<boolean>(false),
    padding: state<boolean>(true),
    position: state<DialogPosition>("center"),
    displayHeader: state<boolean>(true),
    displayCloseButton: state<boolean>(true),
    maxWidth: state<string>(""),
    maxHeight: state<string>("100vh"),
    width: state<string>(""),
    height: state<string>(""),
    dismissOnClickMask: state<boolean>(true),
    animationDuration: state<number>(150),
    animationDelay: state<number>(0),
    mode: state<DialogMode>("modal"),
    anchorElement: state<HTMLElement | null>(null),
    anchorSelector: state<string>(""),
    placement: state<DialogPlacement>("bottom-start"),
    autoFlip: state<boolean>(true),
    popoverOffset: state<number>(8),
    popoverBoundaryPadding: state<number>(8),
    showMaskInPopover: state<boolean>(false),
    onClose: () => { },
    children: <></>,
  };

  durationMs = computed(
    [this.properties.animationDuration],
    ([duration]) => duration + "ms",
  );
  delayMs = computed(
    [this.properties.animationDelay],
    ([delay]) => delay + "ms",
  );

  private renderDialog = state<boolean>(false);
  private animationState = state<AnimationState>("HIDE");
  private beginTimeout!: ReturnType<typeof setTimeout>;
  // TODO: Rastgele id üretimi daha önce crypto.randomUUID(); ile yapılıyordu ancak remote bağlanırken sorun çıkardı. Bu yüzden sonra bu id işlerine bakacağım...
  private dialogDomId = Math.random().toString(36).substring(2, 9);
  private popoverTop = state<string>("0px");
  private popoverLeft = state<string>("0px");
  private popoverMaxWidth = state<string>("calc(100dvw - 16px)");
  private dialogTopStyle = computed(
    [this.properties.mode, this.popoverTop],
    ([mode, top]) => (mode === "popover" ? top : ""),
  );
  private dialogLeftStyle = computed(
    [this.properties.mode, this.popoverLeft],
    ([mode, left]) => (mode === "popover" ? left : ""),
  );
  private dialogMaxWidthStyle = computed(
    [this.properties.mode, this.properties.maxWidth, this.popoverMaxWidth],
    ([mode, maxWidth, popoverMaxWidth]) =>
      mode === "popover" ? popoverMaxWidth : maxWidth,
  );

  private handleWindowReposition = () => {
    this.updatePopoverPosition();
  };

  onInit(): void {
    // debugger
    if (getStateValue(this.properties.show)) this.showDialog();
    if (!isState(this.properties.show)) return;
    (this.properties.show as State<boolean>).subscribe((show) => {
      if (show) {
        this.showDialog();
      } else {
        this.closeDialog(false);
      }
    });

    if (isState(this.properties.anchorElement)) {
      (this.properties.anchorElement as State<HTMLElement | null>).subscribe(() => {
        this.updatePopoverPosition();
      });
    }

    if (isState(this.properties.anchorSelector)) {
      (this.properties.anchorSelector as State<string>).subscribe(() => {
        this.updatePopoverPosition();
      });
    }
  }

  onDestroy(): void {
    this.detachPopoverListeners();
  }

  private isPopoverMode() {
    return this.getPropValue(this.properties.mode, "modal") === "popover";
  }

  private getPropValue<T>(
    value: StateOrPlain<T> | undefined,
    fallback: T,
  ): T {
    if (value === undefined) {
      return fallback;
    }

    return getStateValue(value);
  }

  private resolveAnchorElement(): HTMLElement | null {
    const directAnchor = this.getPropValue<HTMLElement | null>(
      this.properties.anchorElement,
      null,
    );
    if (directAnchor) {
      return directAnchor;
    }

    const selector = this.getPropValue(this.properties.anchorSelector, "");
    if (!selector) {
      return null;
    }

    return document.querySelector(selector) as HTMLElement | null;
  }

  private attachPopoverListeners() {
    window.addEventListener("resize", this.handleWindowReposition);
    window.addEventListener("scroll", this.handleWindowReposition, true);
  }

  private detachPopoverListeners() {
    window.removeEventListener("resize", this.handleWindowReposition);
    window.removeEventListener("scroll", this.handleWindowReposition, true);
  }

  private updatePopoverPosition() {
    if (!this.isPopoverMode() || this.animationState.get() === "HIDE") {
      return;
    }

    const anchorEl = this.resolveAnchorElement();
    if (!anchorEl) {
      return;
    }

    const dialogEl = document.querySelector(
      `[data-webdialog-id="${this.dialogDomId}"] .${styles.dialog}`,
    ) as HTMLElement | null;

    if (!dialogEl) {
      return;
    }

    const anchorRect = anchorEl.getBoundingClientRect();
    const dialogRect = dialogEl.getBoundingClientRect();
    const placement = this.getPropValue<DialogPlacement>(
      this.properties.placement,
      "bottom-start",
    );
    const autoFlip = this.getPropValue(this.properties.autoFlip, true);
    const offset = this.getPropValue(this.properties.popoverOffset, 8);
    const boundaryPadding = this.getPropValue(
      this.properties.popoverBoundaryPadding,
      8,
    );
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;

    const placementsToTry = autoFlip
      ? ALL_POPOVER_PLACEMENTS
      : [placement];

    let best = this.resolvePopoverCoordinates(
      placement,
      anchorRect,
      dialogRect,
      offset,
    );
    let bestOverflow = this.calculateOverflowScore(
      best.top,
      best.left,
      dialogRect,
      viewportWidth,
      viewportHeight,
      boundaryPadding,
    );

    for (const candidate of placementsToTry) {
      const coords = this.resolvePopoverCoordinates(
        candidate,
        anchorRect,
        dialogRect,
        offset,
      );
      const overflow = this.calculateOverflowScore(
        coords.top,
        coords.left,
        dialogRect,
        viewportWidth,
        viewportHeight,
        boundaryPadding,
      );

      if (overflow < bestOverflow) {
        best = coords;
        bestOverflow = overflow;

        if (bestOverflow === 0) {
          break;
        }
      }
    }

    let top = best.top;
    let left = best.left;

    const minLeft = boundaryPadding;
    const maxLeft = viewportWidth - dialogRect.width - boundaryPadding;
    const minTop = boundaryPadding;
    const maxTop = viewportHeight - dialogRect.height - boundaryPadding;

    left = Math.max(minLeft, Math.min(left, maxLeft));
    top = Math.max(minTop, Math.min(top, maxTop));

    this.popoverLeft.set(`${left}px`);
    this.popoverTop.set(`${top}px`);
    this.popoverMaxWidth.set(`calc(100dvw - ${boundaryPadding * 2}px)`);
  }

  private resolvePopoverCoordinates(
    placement: DialogPlacement,
    anchorRect: DOMRect,
    dialogRect: DOMRect,
    offset: number,
  ): { top: number; left: number } {
    const verticalCenter =
      anchorRect.top + anchorRect.height / 2 - dialogRect.height / 2;
    const horizontalCenter =
      anchorRect.left + anchorRect.width / 2 - dialogRect.width / 2;

    switch (placement) {
      case "top-start":
        return {
          top: anchorRect.top - dialogRect.height - offset,
          left: anchorRect.left,
        };
      case "top":
        return {
          top: anchorRect.top - dialogRect.height - offset,
          left: horizontalCenter,
        };
      case "top-end":
        return {
          top: anchorRect.top - dialogRect.height - offset,
          left: anchorRect.right - dialogRect.width,
        };
      case "right-start":
        return {
          top: anchorRect.top,
          left: anchorRect.right + offset,
        };
      case "right":
        return {
          top: verticalCenter,
          left: anchorRect.right + offset,
        };
      case "right-end":
        return {
          top: anchorRect.bottom - dialogRect.height,
          left: anchorRect.right + offset,
        };
      case "left-start":
        return {
          top: anchorRect.top,
          left: anchorRect.left - dialogRect.width - offset,
        };
      case "left":
        return {
          top: verticalCenter,
          left: anchorRect.left - dialogRect.width - offset,
        };
      case "left-end":
        return {
          top: anchorRect.bottom - dialogRect.height,
          left: anchorRect.left - dialogRect.width - offset,
        };
      case "bottom":
        return {
          top: anchorRect.bottom + offset,
          left: horizontalCenter,
        };
      case "bottom-end":
        return {
          top: anchorRect.bottom + offset,
          left: anchorRect.right - dialogRect.width,
        };
      case "bottom-start":
      default:
        return {
          top: anchorRect.bottom + offset,
          left: anchorRect.left,
        };
    }
  }

  private calculateOverflowScore(
    top: number,
    left: number,
    dialogRect: DOMRect,
    viewportWidth: number,
    viewportHeight: number,
    boundaryPadding: number,
  ): number {
    const right = left + dialogRect.width;
    const bottom = top + dialogRect.height;

    const overflowLeft = Math.max(0, boundaryPadding - left);
    const overflowTop = Math.max(0, boundaryPadding - top);
    const overflowRight = Math.max(0, right - (viewportWidth - boundaryPadding));
    const overflowBottom = Math.max(0, bottom - (viewportHeight - boundaryPadding));

    return overflowLeft + overflowTop + overflowRight + overflowBottom;
  }

  showDialog() {
    this.renderDialog.set(true);

    if (this.isPopoverMode()) {
      this.attachPopoverListeners();
      requestAnimationFrame(() => this.updatePopoverPosition());
    }

    const current = this.animationState.get();
    if (current !== "BEGIN" && current !== "HOLD") {
      this.animationState.set("BEGIN");
      const timeoutClose =
        getStateValue(this.properties.animationDuration || 0) - 30;

      this.beginTimeout = setTimeout(() => {
        this.animationState.set("HOLD");
      }, timeoutClose);
    }
  }

  closeDialog(emitOnClose = true) {
    if (this.isPopoverMode()) {
      this.detachPopoverListeners();
    }

    const current = this.animationState.get();
    if (current === "BEGIN" || current === "HOLD") {
      clearTimeout(this.beginTimeout);
      this.animationState.set("OUT");
      const timeoutClose =
        getStateValue(this.properties.animationDuration || 0) - 30;

      setTimeout(() => {
        this.animationState.set("HIDE");
        // bir nevi memorize yaparak diyaloğu silmek yerine gizliyoruz, böylece tekrar açarken animasyonun başından başlayabiliyoruz.
        // this.renderDialog.set(false);
      }, timeoutClose);
      if (emitOnClose && this.properties.onClose) {
        (this.properties.onClose as () => void)();
      }
    }

    (this.properties.show as State<boolean>).set(false);
  }

  maskClick(event: MouseEvent) {
    // Burada .get() gerekiyor, eğer içi null olsa bile get kullanılmazsa true döner ve diyalog her şekilde kapanır...
    if (
      (this.properties.dismissOnClickMask as State<boolean>).get() &&
      event.target === event.currentTarget
    ) {
      this.closeDialog();
    }
  }

  render() {
    // Neolit JSX'i parse ederken eğer gelen prop değeri state ise ona subscribe olup onun propertysini değiştiriyor html elementinin.
    // Bu yüzden burada ayrıca get yapmaya gerek yok, direkt olarak state'i vermek yeterli oluyor.
    // If neolit JSX, when parsing, encounters a prop value that is a state, it subscribes to it and updates the corresponding property of the HTML element when the state changes.
    // Therefore, there is no need to call get() here; simply passing the state is sufficient.
    return (
      <div
        className={styles.modal}
        animation-state={this.animationState}
        dialog-mode={this.properties.mode}
        show-mask-in-popover={this.properties.showMaskInPopover}
        data-webdialog-id={this.dialogDomId}
        style={{
          "--duration": this.durationMs,
          "--animDelay": this.delayMs,
        }}
        onClick={(e: MouseEvent) => this.maskClick(e)}
      >
        <div
          className={styles.dialog}
          animation-state={this.animationState}
          dialog-align={this.properties.position}
          dialog-mode={this.properties.mode}
          style={{
            top: this.dialogTopStyle,
            left: this.dialogLeftStyle,
            maxWidth: this.dialogMaxWidthStyle,
            width: this.properties.width,
            height: this.properties.height,
            maxHeight: this.properties.maxHeight,
          }}
        >
          {/* Burada eğer dinamik olarak displayHeader gizlenebilmesi isteniyorsa fromState(...).renderIf gerekecek. */}
          {getStateValue(
            this.properties.displayHeader as StateOrPlain<boolean>,
          ) && (
              <div
                className={`${styles.header} flex items-center justify-between px-3 pt-3`}
              >
                <h2 className="h2 flex-grow-1">{this.properties.title}</h2>
                {fromState(
                  this.properties.displayCloseButton as State<boolean>,
                ).renderIf(() => (
                  <Button
                    icon={materialSymbolsOutlined("close", "0", "1.5em")}
                    variant="ghost"
                    onClick={() => this.closeDialog()}
                    style={{ padding: "0.25em" }}
                  ></Button>
                ))}
              </div>
            )}
          <div
            className={[
              "dialog-inner",
              "flex-grow-1",
              "overflow-auto",
              computed([this.properties.padding], ([padding]) =>
                padding ? "px-3 pb-3" : "",
              ),
              computed([this.properties.padding, this.properties.displayHeader, this.properties.displayCloseButton], ([padding, displayHeader, displayCloseButton]) =>
                padding && !displayHeader && !displayCloseButton ? "pt-3" : "",
              ),
            ]}
          >
            {this.properties.children}
          </div>
        </div>
      </div>
    );
  }
}
