import {
  computed,
  NeolitComponent,
  type NeolitNode,
  type StateOrPlain,
  state,
} from "@ubs-platform/neolit/core";
import { materialSymbolsOutlined } from "@libs/ui/icon";
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
  private loadingStack = state<{ id: number; message: StateOrPlain<string> }[]>([]);
  private nextLoadingId = 0;
  isLoading = computed([this.loadingStack], ([stack]) => stack.length > 0);
  loadingMessage = computed(
    [this.loadingStack],
    ([stack]) => stack[stack.length - 1]?.message ?? "",
  );

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

  showLoading(message: StateOrPlain<string>): () => void {
    const id = this.nextLoadingId++;
    this.loadingStack.update((stack) => [...stack, { id, message }]);
    let closed = false;
    return () => {
      if (closed) return;
      closed = true;
      this.loadingStack.update((stack) => stack.filter((item) => item.id !== id));
    };
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
          <div className="mt-1 flex gap-2 justify-center">
            <Button
              onClick={() => {
                closeDialog(true);
              }}
              icon={materialSymbolsOutlined("check")}
              label={tr("general.yes")}
            ></Button>
            <Button
              onClick={() => {
                closeDialog(false);
              }}
              icon={materialSymbolsOutlined("close")}
              label={tr("general.no")}
            ></Button>
          </div>
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
            icon={materialSymbolsOutlined("check")}
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
          <div className="mt-1 flex justify-center">
            <Button
              onClick={() => {
                closeDialog(inputValue);
              }}
              label={tr("general.ok")}
            ></Button>
          </div>
        </div>
      ),
      onClose,
    });
  }
}

provideValue(WebdialogOverlayService, new WebdialogOverlayService());
