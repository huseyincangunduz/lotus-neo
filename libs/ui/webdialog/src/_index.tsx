import {
  NeolitComponent,
  State,
  computed,
  getStateValue,
  isState,
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
}

export class WebDialog extends NeolitComponent<WebDialogProps> {
  properties: WebDialogProps = {
    // title: state<string>(""),
    show: state<boolean>(false),
    padding: state<boolean>(true),
    position: state<DialogPosition>("center"),
    displayHeader: state<boolean>(true),
    displayCloseButton: state<boolean>(true),
    maxWidth: state<string>("90vw"),
    maxHeight: state<string>("90vh"),
    width: state<string>("fit-content"),
    height: state<string>("fit-content"),
    dismissOnClickMask: state<boolean>(true),
    animationDuration: state<number>(300),
    animationDelay: state<number>(0),
    onClose: () => {},
    children: <></>,
  };

  private renderDialog = state<boolean>(false);
  private animationState = state<AnimationState>("HIDE");
  private beginTimeout!: ReturnType<typeof setTimeout>;

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
  }

  private get animationAfterApply() {

    return getStateValue(this.properties.animationDuration as State<number>) + 5;
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
      if (emitOnClose && this.properties.onClose) {
        (this.properties.onClose as () => void)();
      }
    }
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
      <>
        {/* fromState bir hatadan dolayı fragment içinden verilmesi lazım. Bunu düzelteceğim */}
        {fromState(this.renderDialog).renderIf(() => (
          <div
            className={styles.modal}
            animation-state={this.animationState}
            style={{
              "--duration": this.properties.animationDuration,
              "--animDelay": this.properties.animationDelay,
            }}
            onClick={(e: MouseEvent) => this.maskClick(e)}
          >
            <div
              className={styles.dialog}
              animation-state={this.animationState}
              dialog-align={this.properties.position}
              style={{
                maxWidth: this.properties.maxWidth,
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
                    <button onClick={() => this.closeDialog()}>✕</button>
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
                ]}
              >
                {this.properties.children}
              </div>
            </div>
          </div>
        ))}
      </>
    );
  }
}
