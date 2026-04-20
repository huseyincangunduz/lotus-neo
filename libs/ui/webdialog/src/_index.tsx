import {
  NeolitComponent,
  State,
  getStateValue,
  isState,
  state,
  type NeolitNode,
  type StateOrPlain,
} from "@ubs-platform/neolit/core";
import "./webdialog.scss";

export type DialogPosition =
  | "center"
  | "right"
  | "left"
  | "bottom-center"
  | "bottom";
export type AnimationState = "HIDE" | "BEGIN" | "HOLD" | "OUT";

export interface WebDialogProps {
  children: NeolitNode | NeolitNode[];
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
  // TODO: swipeTrigger?: StateOrPlain<"RIGHT_TO_LEFT" | "LEFT_TO_RIGHT" | "">;
  //   Neolit'te DocumentSwipeListener / gesture servis mekanizması henüz mevcut değil.
  // TODO: suspendSwipe?: StateOrPlain<boolean>;
  // TODO: swipeFloor?: StateOrPlain<number>;
}

export class WebDialog extends NeolitComponent {
  animationState = state<AnimationState>("HIDE");
  title = state("");
  padding = state(true);
  position = state<DialogPosition>("center");
  displayHeader = state(true);
  displayCloseButton = state(true);
  maxWidth = state("100dvw");
  maxHeight = state("100dvh");
  width = state("500px");
  height = state("");
  dismissOnClickMask = state(true);
  animationDuration = state(125);
  animationDelay = state(10);

  onClose?: () => void;
  content: NeolitNode | NeolitNode[] = (<></>);

  private beginTimeout?: ReturnType<typeof setTimeout>;

  constructor({
    children,
    title = "",
    show,
    onClose,
    padding = true,
    position = "center",
    displayHeader = true,
    displayCloseButton = true,
    maxWidth = "100dvw",
    maxHeight = "100dvh",
    width = "500px",
    height = "",
    dismissOnClickMask = true,
    animationDuration = 125,
    animationDelay = 10,
  }: WebDialogProps) {
    super();
    this.content = children;
    this.onClose = onClose;

    this.title.set(getStateValue(title));
    this.padding.set(getStateValue(padding));
    this.position.set(getStateValue(position));
    this.displayHeader.set(getStateValue(displayHeader));
    this.displayCloseButton.set(getStateValue(displayCloseButton));
    this.maxWidth.set(getStateValue(maxWidth));
    this.maxHeight.set(getStateValue(maxHeight));
    this.width.set(getStateValue(width));
    this.height.set(getStateValue(height));
    this.dismissOnClickMask.set(getStateValue(dismissOnClickMask));
    this.animationDuration.set(getStateValue(animationDuration));
    this.animationDelay.set(getStateValue(animationDelay));

    // Dışarıdan gelen State prop'larını izle, değişince internal state'e yansıt
    if (isState(title))
      (title as State<string>).subscribe((v) => this.title.set(v));
    if (isState(padding))
      (padding as State<boolean>).subscribe((v) => this.padding.set(v));
    if (isState(position))
      (position as State<DialogPosition>).subscribe((v) =>
        this.position.set(v),
      );
    if (isState(displayHeader))
      (displayHeader as State<boolean>).subscribe((v) =>
        this.displayHeader.set(v),
      );
    if (isState(displayCloseButton))
      (displayCloseButton as State<boolean>).subscribe((v) =>
        this.displayCloseButton.set(v),
      );
    if (isState(maxWidth))
      (maxWidth as State<string>).subscribe((v) => this.maxWidth.set(v));
    if (isState(maxHeight))
      (maxHeight as State<string>).subscribe((v) => this.maxHeight.set(v));
    if (isState(width))
      (width as State<string>).subscribe((v) => this.width.set(v));
    if (isState(height))
      (height as State<string>).subscribe((v) => this.height.set(v));
    if (isState(dismissOnClickMask))
      (dismissOnClickMask as State<boolean>).subscribe((v) =>
        this.dismissOnClickMask.set(v),
      );
    if (isState(animationDuration))
      (animationDuration as State<number>).subscribe((v) =>
        this.animationDuration.set(v),
      );
    if (isState(animationDelay))
      (animationDelay as State<number>).subscribe((v) =>
        this.animationDelay.set(v),
      );

    // show prop'u değişince animasyon state machine'ini tetikle
    const handleShow = (newShow: boolean) => {
      if (newShow) this.showDialog();
      else this.closeDialog();
    };
    if (isState(show)) {
      (show as State<boolean>).subscribe(handleShow);
    }
    if (getStateValue(show)) this.showDialog();

    // TODO: Mobile geçmiş (history) geri-tuşu ile dialog kapatma mekanizması
    //   (Angular'daki generateMobileOptimizedDialogHideController karşılığı) henüz mevcut değil.

    // this.watchToRerender(this.animationState);
    // this.watchToRerender(this.title);
    // this.watchToRerender(this.padding);
    // this.watchToRerender(this.position);
    // this.watchToRerender(this.displayHeader);
    // this.watchToRerender(this.displayCloseButton);
    // this.watchToRerender(this.maxWidth);
    // this.watchToRerender(this.maxHeight);
    // this.watchToRerender(this.width);
    // this.watchToRerender(this.height);
  }

  private get animationAfterApply() {
    return this.animationDuration.get() + 5;
  }

  showDialog() {
    const current = this.animationState.get();
    if (current !== "BEGIN" && current !== "HOLD") {
      this.animationState.set("BEGIN");
      this.beginTimeout = setTimeout(() => {
        this.animationState.set("HOLD");
      }, this.animationAfterApply);
    }
  }

  closeDialog(emitOnClose = true) {
    const current = this.animationState.get();
    if (current === "BEGIN" || current === "HOLD") {
      clearTimeout(this.beginTimeout);
      this.animationState.set("OUT");
      setTimeout(() => {
        this.animationState.set("HIDE");
      }, this.animationAfterApply);
      if (emitOnClose && this.onClose) {
        this.onClose();
      }
    }
  }

  maskClick(event: MouseEvent) {
    if (this.dismissOnClickMask.get() && event.target === event.currentTarget) {
      this.closeDialog();
    }
  }

  render() {
    const animState = this.animationState.get();
    const durationMs = this.animationDuration.get() + "ms";
    const delayMs = this.animationDelay.get() + "ms";

    return (
      <div
        className="modal"
        animation-state={animState}
        style={{ "--duration": durationMs, "--animDelay": delayMs }}
        onClick={(e: MouseEvent) => this.maskClick(e)}
      >
        <div
          className="dialog"
          animation-state={animState}
          dialog-align={this.position.get()}
          style={`max-width: ${this.maxWidth.get()}; width: ${this.width.get()}; height: ${this.height.get()}; max-height: ${this.maxHeight.get()}`}
        >
          {this.displayHeader.get() && (
            <div className="header flex align-items-center justify-content-between">
              <h2 className="my-1 w-full text-center">{this.title}</h2>
              {this.displayCloseButton.get() && (
                <button onClick={() => this.closeDialog()}>✕</button>
              )}
            </div>
          )}
          <div
            className={`dialog-inner flex-grow-1 overflow-auto${
              this.padding.get() ? " px-3 pb-3" : ""
            }`}
          >
            {this.content}
          </div>
        </div>
      </div>
    );
  }
}
