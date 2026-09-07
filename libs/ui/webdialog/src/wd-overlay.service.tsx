import {
  NeolitComponent,
  type NeolitNode,
  type StateOrPlain,
  state,
} from "@ubs-platform/neolit/core";
import { provideValue } from "@ubs-platform/neolit/injectables";
import { Button } from "@libs/ui/button";
import { TextInput } from "@libs/ui/text-input";
import { tr } from "@libs/ui/i18n";
export interface WebDialogConfig {
  title: StateOrPlain<string>;
  children: (
    closeDialog: (closeValue: any) => void,
  ) => NeolitNode | NeolitNode[] | NeolitComponent | HTMLElement;
  onClose?: (closeValue: any) => void;
}

export class WebdialogOverlayService {
  lastDialogConfig = state<WebDialogConfig | null>(null);

  showDialog(dialogConfig: WebDialogConfig) {
    this.lastDialogConfig.set(dialogConfig);
  }

  listenDialogConfig(callback: (dialogConfig: WebDialogConfig) => void) {
    this.lastDialogConfig.subscribe((a) => {
      if (a) {
        callback(a);
      }
    });
  }

  showApproveDialog(
    title: StateOrPlain<string>,
    description: StateOrPlain<string>,
    onClose?: (closeValue: any) => void,
  ) {
    this.showDialog({
      title,
      children: (closeDialog) => (
        <div>
          <p>{description}</p>
          <Button
            onClick={() => {
              closeDialog(true);
            }}
            label={tr("general.yes")}
          ></Button>
          <Button
            onClick={() => {
              closeDialog(false);
            }}
            label={tr("general.no")}
          ></Button>
        </div>
      ),
      onClose,
    });
  }

  showAlertDialog(
    title: StateOrPlain<string>,
    description: StateOrPlain<string>,
    onClose?: (closeValue: any) => void,
  ) {
    this.showDialog({
      title,
      children: (closeDialog) => (
        <div>
          <p>{description}</p>
          <Button
            onClick={() => {
              closeDialog(true);
            }}
            label={tr("general.ok")}
          ></Button>
        </div>
      ),
      onClose,
    });
  }

  showTextPrompt(
    title: StateOrPlain<string>,
    description: StateOrPlain<string>,
    initialValue: StateOrPlain<string>,
    onClose?: (closeValue: any) => void,
  ) {
    let inputValue = initialValue;
    this.showDialog({
      title,
      children: (closeDialog) => (
        <div>
          <p>{description}</p>
          <TextInput
            onChange={(e) => {
              inputValue = e;
            }}
            value={inputValue}
          ></TextInput>
          <Button
            onClick={() => {
              closeDialog(inputValue);
            }}
            label="OK"
          ></Button>
        </div>
      ),
      onClose,
    });
  }
}

provideValue(WebdialogOverlayService, new WebdialogOverlayService());
