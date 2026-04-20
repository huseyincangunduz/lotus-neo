import {
  NeolitComponent,
  computed,
  getStateValue,
  state,
  type NeolitNode,
  type StateOrPlain,
} from "@ubs-platform/neolit/core";
import styles from "./webdialog.module.scss";
import { fromState } from "@ubs-platform/neolit/structural";

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
  paddingClass = computed([this.padding], () =>
    this.padding.get() ? " px-3 pb-3" : "",
  );
  dialogContentClassName = computed(
    [this.paddingClass],
    () => `dialog-inner flex-grow-1 overflow-auto ${this.paddingClass.get()}`,
  );
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
  durationMs = computed(
    [this.animationDuration],
    () => this.animationDuration.get() + "ms",
  );
  delayMs = computed(
    [this.animationDelay],
    () => this.animationDelay.get() + "ms",
  );
  show = state(false);
  renderDialog = state(false);

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

    this.title.set(title, { notifyIncoming: true, subscribeIncoming: true });
    this.padding.set(padding, {
      notifyIncoming: true,
      subscribeIncoming: true,
    });
    this.position.set(position, {
      notifyIncoming: true,
      subscribeIncoming: true,
    });
    this.displayHeader.set(displayHeader, {
      notifyIncoming: true,
      subscribeIncoming: true,
    });
    this.displayCloseButton.set(displayCloseButton, {
      notifyIncoming: true,
      subscribeIncoming: true,
    });
    this.maxWidth.set(maxWidth, {
      notifyIncoming: true,
      subscribeIncoming: true,
    });
    this.maxHeight.set(maxHeight, {
      notifyIncoming: true,
      subscribeIncoming: true,
    });
    this.width.set(width, { notifyIncoming: true, subscribeIncoming: true });
    this.height.set(height, { notifyIncoming: true, subscribeIncoming: true });
    this.dismissOnClickMask.set(dismissOnClickMask, {
      notifyIncoming: true,
      subscribeIncoming: true,
    });
    this.animationDuration.set(animationDuration, {
      notifyIncoming: true,
      subscribeIncoming: true,
    });
    this.animationDelay.set(animationDelay, {
      notifyIncoming: true,
      subscribeIncoming: true,
    });
    this.show.set(show, { notifyIncoming: true, subscribeIncoming: true });
    this.show.subscribe((newShow) => {
      if (newShow) this.showDialog();
      else this.closeDialog(false);
    });
    if (getStateValue(show)) this.showDialog();
  }

  private get animationAfterApply() {
    console.info("animationDuration ", this.animationDuration.get());
    return this.animationDuration.get() + 5;
  }

  showDialog() {
    this.renderDialog.set(true);
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
        // bir nevi memorize yaparak diyaloğu silmek yerine gizliyoruz, böylece tekrar açarken animasyonun başından başlayabiliyoruz.
        // this.renderDialog.set(false);
      }, this.animationAfterApply);
      if (emitOnClose && this.onClose) {
        this.onClose();
      }
    }
  }

  maskClick(event: MouseEvent) {
    // Burada .get() gerekiyor, eğer içi null olsa bile get kullanılmazsa true döner ve diyalog her şekilde kapanır...
    if (this.dismissOnClickMask.get() && event.target === event.currentTarget) {
      this.closeDialog();
    }
  }

  render() {
    // Neolit JSX'i parse ederken eğer gelen prop değeri state ise ona subscribe olup onun propertysini değiştiriyor html elementinin.
    // Bu yüzden burada ayrıca get yapmaya gerek yok, direkt olarak state'i vermek yeterli oluyor.
    // If neolit JSX, when parsing, encounters a prop value that is a state, it subscribes to it and updates the corresponding property of the HTML element when the state changes.
    // Therefore, there is no need to call get() here; simply passing the state is sufficient.
    return (
      <>
        {/* fromState bir hatadan dolayı fragment içinden verilmesi lazım. Bunu düzelteceğim */}
        {fromState(this.renderDialog).renderIf(() => (
          <div
            className={styles.modal}
            animation-state={this.animationState}
            style={{
              "--duration": this.durationMs,
              "--animDelay": this.delayMs,
            }}
            onClick={(e: MouseEvent) => this.maskClick(e)}
          >
            <div
              className={styles.dialog}
              animation-state={this.animationState}
              dialog-align={this.position}
              style={{
                maxWidth: this.maxWidth,
                width: this.width,
                height: this.height,
                maxHeight: this.maxHeight,
              }}
            >
              {/* Burada eğer dinamik olarak displayHeader gizlenebilmesi isteniyorsa fromState(...).renderIf gerekecek. */}
              {this.displayHeader.get() && (
                <div className={`${styles.header} flex items-center justify-between px-3 pt-3`}>
                  <h2 className="h2 flex-grow-1">{this.title}</h2>
                  {fromState(this.displayCloseButton).renderIf(() => (
                    <button onClick={() => this.closeDialog()}>✕</button>
                  ))}
                </div>
              )}
              <div

                className={["dialog-inner", "flex-grow-1", "overflow-auto", computed([this.padding],() => (this.padding.get() ? "px-3 pb-3" : ""))]}
              >
                {this.content}
              </div>
            </div>
          </div>
        ))}
      </>
    );
  }
}
