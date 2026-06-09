import { NeolitComponent } from "@ubs-platform/neolit/core";
import { Router, RouteMap, Outlet } from "@ubs-platform/neolit/routing";
import {
  provideClass,
  provideValue,
  createInjector,
  rootInjector,
  inject,
} from "@ubs-platform/neolit/injectables";
import { MainComponent } from "./main";
import { PostralMainPage } from "./postral";
import { PostralNavbar } from "./postral-navbar";
import { Icon, iconifyIcon, materialSymbolsOutlined } from "@libs/ui/icon";
import { IntroFooter } from "@libs/extended/introductions";
import { DownloadLinks } from "./download-links";
import { Documentation } from "./documentation";

// const appBaseInjector = createInjector();
const GITHUB_URL = "https://github.com/ubs-platform/postral-core";
rootInjector.registerValue("GITHUB_URL", GITHUB_URL);
rootInjector.registerValue(
  RouteMap,
  new RouteMap([
    {
      path: "/",
      componentFactory: () => <PostralMainPage />,
    },
    {
      path: "/download",
      componentFactory: () => <DownloadLinks />,
    },
    {
      path: "/documentation",
      componentFactory: () => <Documentation />,
    },
  ]),
);

rootInjector.registerValue(
  Router,
  new Router({
    // vite config base path
    parentPath: import.meta.env.VITE_BASE_PATH || "",
    // initialPath: "/postral" + window.location.pathname.replace("/postral", ""),
    routeMap: rootInjector.resolve(RouteMap),
  }),
);

export class Application extends NeolitComponent {
  readonly router = rootInjector.resolve(Router);
  render() {
    return (
      <>
        <PostralNavbar></PostralNavbar>
        <Outlet router={this.router}></Outlet>

        <IntroFooter
          appCompanyLogo={
            <Icon
              imgSrc="/public/postral-with-tetakent-logo-colored.svg"
              imageHeight="40px"
            />
          }
          copyright="© 2026 Tetakent (Hüseyin Can Gündüz). Tüm hakları saklıdır. Postral Core ürününün kaynak kodları MIT Lisansı ile dağıtılmaktadır."
          linkGroups={[
            {
              title: "Kaynaklar",
              links: [
                { label: "Core Backend - GitHub", href: inject("GITHUB_URL") },
                { label: "Dokümantasyon", href: "/documentation" },
              ],
            },
            {
              title: "Topluluk",
              links: [{ label: "Katkıda Bulun", href: inject("GITHUB_URL") }],
            },
          ]}
          socialLinks={[
            {
              icon: iconifyIcon("github"),
              href: GITHUB_URL,
              label: "GitHub",
            },
            {
              icon: iconifyIcon("mdi:instagram"),
              href: "https://www.instagram.com/tetakentofficial",
              label: "Instagram",
            },
            {
              icon: iconifyIcon("fa6-brands:x-twitter"),
              href: "https://x.com/tetakent",
              label: "X (Twitter)",
            },
            {
              icon: iconifyIcon("mdi:linkedin"),
              href: "https://www.linkedin.com/company/tetakent",
              label: "Linkedin",
            },
          ]}
        />
      </>
    );
  }
}
