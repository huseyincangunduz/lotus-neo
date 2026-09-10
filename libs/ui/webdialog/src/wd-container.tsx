import {
  NeolitComponent,
  state,
  type NeolitNode,
} from "@ubs-platform/neolit/core";
import { WebdialogOverlayService } from "./wd-overlay.service";
import type { WebDialogConfig } from "./wd-overlay.service";
import { WebDialog } from "./_index";
import { inject } from "@ubs-platform/neolit/injectables";

export interface WebDialogContainerProperties {
  dialogs: WebDialogConfig[];
}

type DialogStackItem = {
  dialogConfig: WebDialogConfig;
  dialogId: number;
  dialogDom: NeolitNode | NeolitNode[] | NeolitComponent | HTMLElement;
  closed: boolean;
};

export class WebDialogContainer extends NeolitComponent {
  readonly webDialogOverlayService = inject<WebdialogOverlayService>(
    WebdialogOverlayService,
  );

  dialogStack: DialogStackItem[] = [];

  onInit(): void {
    this.webDialogOverlayService.listenDialogConfig((dialogConfig) => {
      if (dialogConfig) {
        this.addDialogToStack(dialogConfig);
      }
    });
  }

  addDialogToStack(dialog: WebDialogConfig) {
    const addMask = this.dialogStack.length === 0;
    const showState = state(true);
    showState.subscribe((a) => {
      if (!a) {
        this.closeDialog(dialog);
      }
    });

    this.dialogStack = this.dialogStack.filter((item) => !item.closed);
    this.dialogStack.push({
      dialogConfig: dialog,
      dialogId: this.dialogStack.length,
      closed: false,
      dialogDom: (
        <WebDialog
          displayHeader={true}
          title={dialog.title}
          show={showState}
          showMask={addMask}
        >
          {
            dialog.children((closeValue) =>
              this.closeDialog(dialog, closeValue),
            ) as any
          }
        </WebDialog>
      ),
    });

    this.rerender();
  }

  closeDialog(dialog: WebDialogConfig, closeValue?: any) {
    const index = this.dialogStack.findIndex((d) => d.dialogConfig == dialog);
    if (index !== -1) {
      const dialogItem = this.dialogStack[index];
      dialogItem.closed = true;
      dialogItem.dialogConfig.onClose?.(closeValue);
      this.dialogStack = this.dialogStack
        .slice(0, index)
        .concat(this.dialogStack.slice(index + 1));
      this.rerender();
    }
  }

  render(): NeolitNode | NeolitNode[] | NeolitComponent | null {
    return (
      <>
        {this.dialogStack.map((a) => a.dialogDom)}
        <WebDialog
          show={this.webDialogOverlayService.isLoading}
          mode="modal"
          displayHeader={false}
          displayCloseButton={false}
          dismissOnClickMask={false}
          width="280px"
        >
          {[
            <div className="flex flex-col items-center gap-3 p-2 text-center">
              <span className="material-symbols-outlined animate-spin">
                progress_activity
              </span>
              <p>{this.webDialogOverlayService.loadingMessage}</p>
            </div>,
          ]}
        </WebDialog>
      </>
    );
  }
}
