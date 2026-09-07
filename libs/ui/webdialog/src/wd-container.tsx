import { NeolitComponent, type NeolitNode } from "@ubs-platform/neolit/core";
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
    this.dialogStack.push({
      dialogConfig: dialog,
      dialogId: this.dialogStack.length,
      dialogDom: (
        <WebDialog
          displayHeader={true}
          title={dialog.title}
          show={true}
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
      this.dialogStack[index].dialogConfig.onClose?.(closeValue);
      this.dialogStack = this.dialogStack.slice(0, index).concat(this.dialogStack.slice(index + 1));
      this.rerender();
    }
  }

  render(): NeolitNode | NeolitNode[] | NeolitComponent | null {
    return <>{this.dialogStack.map((a) => a.dialogDom)}</>;
  }
}
