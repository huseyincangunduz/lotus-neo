import { NeolitComponent } from "@ubs-platform/neolit/core";
import { Router, RouteMap, Outlet } from "@ubs-platform/neolit/routing";
import {
  provideClass,
  provideValue,
  createInjector,
} from "@ubs-platform/neolit/injectables";
import { MainComponent } from "./main";
import { PostralMainPage } from "./postral";

const appBaseInjector = createInjector();
appBaseInjector.registerValue(
  RouteMap,
  new RouteMap([
    {
      path: "/",
      componentFactory: () => <MainComponent />,
    },
    {
      path: "/postral",
      componentFactory: () => <PostralMainPage />,
    },
  ]),
);

appBaseInjector.registerValue(
  Router,
  new Router({
    routeMap: appBaseInjector.resolve(RouteMap),
  }),
);

export class Application extends NeolitComponent {
  readonly router = appBaseInjector.resolve(Router);
  render() {
    return (
        <Outlet router={this.router}></Outlet>

    );
  }
}
