import { IntroNavbar } from "@libs/extended/introductions";
import { Icon } from "@libs/ui/icon";
import { NeolitComponent } from "@ubs-platform/neolit/core";
import { inject } from "@ubs-platform/neolit/injectables";
import { Router } from "@ubs-platform/neolit/routing";
export class PostralNavbar extends NeolitComponent {
  readonly router = inject(Router);
  
  render() {
    return (
      <IntroNavbar
        logoHref="/"
        logo={<Icon imgSrc="/public/postral-logo.svg" imageHeight="40px" />}
        links={[
          { label: "Ana sayfa", onClick: () => this.router.navigate("/") },
          { label: "İndir", onClick: () => this.router.navigate("/download") },
          { label: "Dokümantasyon", onClick: () => this.router.navigate("/#documentation") },
        ]}
      />
    );
  }
}
