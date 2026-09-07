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
  children: () => NeolitNode | NeolitNode[] | NeolitComponent | HTMLElement;
}

export interface WebDialogContainerProperties {
  dialogs: WebDialogConfig[];
}

export class WebDialogContainer extends NeolitComponent {
  properties: WebDialogContainerProperties = {
    dialogs: [
      {
        title: "Default Title",
        children: () => (
          <div>
            Default Content
            <Button
              onClick={() => {
                this.addDialogToStack({
                  title: "New Title",
                  children: () => <div>New Content</div>,
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
    ...this.properties.dialogs.map((dialog) => (
      <WebDialog displayHeader={true} title={dialog.title} show={true}>
        {dialog.children() as any}
      </WebDialog>
    )),
  ];

  addDialogToStack(dialog: WebDialogConfig) {
    const addMask = this.dialogStack.length === 0;
    this.dialogStack.push(
      <WebDialog displayHeader={true} title={dialog.title} show={true} showMaskInPopover={addMask}>
        {dialog.children() as any}
      </WebDialog>
    );

    this.rerender();
  }

  render(): NeolitNode | NeolitNode[] | NeolitComponent | null {
    return <>{this.dialogStack}</>;
  }
}
