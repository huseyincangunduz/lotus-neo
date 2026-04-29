import { NeolitComponent, state } from "@ubs-platform/neolit/core";
import { Button } from "@libs/ui/button";
import { KeltosKel } from "@libs/keltos-kel";
import "@libs/ui/webdialog";
import { WebDialog } from "@libs/ui/webdialog";
import { materialSymbolsOutlined } from "@libs/ui/icon";
import { Pagination } from "@libs/ui/touch/pagination";
import { Checkbox } from "@libs/ui/checkbox";
import { ToggleSwitch } from "@libs/ui/toggle-switch";
import { AlertToastContainer, toastService } from "@libs/ui/alert-toast";
import { Outlet, RouteMap } from "@ubs-platform/neolit/routing";
import { MainPage } from "./main";
import { CanvasTest } from "./canvas-test";

export class AppComponent extends NeolitComponent {
  routeMap = new RouteMap([
    {
      path: "/",
      componentFactory: () => <MainPage></MainPage>,
      // TODO: Lazyload desteği
      // componentFactory: () => import("./main").then((mod) => mod.MainPage),
    },
    {
      path: "/canvas-test",
      componentFactory: () => <CanvasTest></CanvasTest>,
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
