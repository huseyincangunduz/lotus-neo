import {
  NeolitComponent,
  State,
  type NeolitNode,
  type StateOrPlain,
} from "@ubs-platform/neolit/core";
import { WebDialog } from "./_index";
import { fromState } from "@ubs-platform/neolit/structural";
import { Button } from "@libs/ui/button";

export interface WebDialogConfig {
  title: StateOrPlain<string>;
  children: (
    closeDialog: (closeValue: any) => void,
  ) => NeolitNode | NeolitNode[] | NeolitComponent | HTMLElement;
  onClose?: (closeValue: any) => void;
}

export interface WebDialogContainerProperties {
  dialogs: WebDialogConfig[];
}

export class WebDialogContainer extends NeolitComponent {
  properties: WebDialogContainerProperties = {
    dialogs: [
      {
        title: "Default Title",
        onClose: (closeValue) => {
          console.log("Dialog closed with value:", closeValue);
        },
        children: (closeDialog) => (
          <div>
            Default Content
            <Button
              onClick={() => {
                this.addDialogToStack({
                  title: "New Title",
                  children: (closeDialog) => (
                    <div>
                      New Content
                      <Button
                        onClick={() => closeDialog("lala")}
                        label={"Close"}
                      ></Button>
                    </div>
                  ),
                });
              }}
              label={"Click Me"}
            ></Button>
          </div>
        ),
      },
    ],
  };

  dialogStack = [
    ...this.properties.dialogs.map((dialog, index) => ({
      dialogId: index,
      dialogConfig: dialog,
      dialogDom: (
        <WebDialog displayHeader={true} title={dialog.title} show={true}>
          {dialog.children(() => this.closeDialog(dialog)) as any}
        </WebDialog>
      ),
    })),
  ];

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
          {dialog.children(() => this.closeDialog(dialog)) as any}
        </WebDialog>
      ),
    });

    this.rerender();
  }

  closeDialog(dialog: WebDialogConfig) {
    const index = this.dialogStack.findIndex((d) => d.dialogConfig == dialog);
    if (index !== -1) {
      this.dialogStack.splice(index, 1);
      this.rerender();
    }
  }

  render(): NeolitNode | NeolitNode[] | NeolitComponent | null {
    return <>{this.dialogStack.map((a) => a.dialogDom)}</>;
  }
}
