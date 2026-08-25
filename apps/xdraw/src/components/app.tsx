import { NeolitComponent } from "@ubs-platform/neolit/core";
import "@libs/ui/webdialog";
import { AlertToastContainer } from "@libs/ui/alert-toast";
import { Outlet, RouteMap } from "@ubs-platform/neolit/routing";
import {
  APP_NATIVE_CONTROLLER_TOKEN,
  CanvasDraw,
  type IAppNativeController,
} from "@libs/xdraw/components";
import { provideValue } from "@ubs-platform/neolit/injectables";
// import { CanvasDraw } from "./pages/canvas-draw";

const WebAppController: IAppNativeController = {
  isMobileApp: false,
  isBrowserWebApp: true,
  isElectronApp: false,
  downloadDataRequest: (
    data: Blob,
    saveMimetype: string,
    fileNameOrPath?: string,
  ) => {
    const url = URL.createObjectURL(data);
    const a = document.createElement("a");
    a.href = url;
    a.download =
      fileNameOrPath ||
      new Date().toISOString() +
        ".xdraw." +
        saveMimetype
          .replace("image/", ".")
          .replace("text/", ".")
          .replace("application/", ".");
    a.click();
    URL.revokeObjectURL(url);
  },
  openFileRequest: async (accept: string) => {
    return new Promise<File | null>((resolve) => {
      const input = document.createElement("input");
      input.type = "file";
      input.accept = accept;
      input.onchange = () => {
        if (input.files && input.files.length > 0) {
          resolve(input.files[0]);
        } else {
          resolve(null);
        }
      };
      input.click();
    });
  },
  async shareDataRequest(data: Blob, mimeType: string, fileName: string) {
    const file = new File([data], fileName, { type: mimeType });
    if (navigator.canShare?.({ files: [file] })) {
      await navigator.share({ files: [file] });
      return;
    }
    // Web Share API dosyayla desteklenmiyorsa indirmeye düş
    const url = URL.createObjectURL(data);
    const a = document.createElement("a");
    a.href = url;
    a.download = fileName;
    a.click();
    URL.revokeObjectURL(url);
  },
};

provideValue(APP_NATIVE_CONTROLLER_TOKEN, WebAppController);

export class AppComponent extends NeolitComponent {
  routeMap = new RouteMap([
    {
      path: "/",
      componentFactory: () => <CanvasDraw></CanvasDraw>,
    },
  ]);
  render() {
    return (
      <>
        <AlertToastContainer messageTimeout={5000}></AlertToastContainer>
        <Outlet routeMap={this.routeMap}></Outlet>
      </>
    );
  }
}
