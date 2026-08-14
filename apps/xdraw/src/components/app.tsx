import { NeolitComponent } from "@ubs-platform/neolit/core";
import "@libs/ui/webdialog";
import { AlertToastContainer } from "@libs/ui/alert-toast";
import { Outlet, RouteMap } from "@ubs-platform/neolit/routing";
import { CanvasDraw } from "@libs/xdraw/components";
// import { CanvasDraw } from "./pages/canvas-draw";

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
