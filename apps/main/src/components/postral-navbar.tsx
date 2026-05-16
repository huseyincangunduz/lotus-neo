import { IntroNavbar } from "@libs/extended/introductions";
import { Icon } from "@libs/ui/icon";
import { NeolitComponent } from "@ubs-platform/neolit/core";
export class PostralNavbar extends NeolitComponent {
  render() {
    return (
      <IntroNavbar
        logoHref="#"
        logo={<Icon imgSrc="/public/postral-logo.svg" imageHeight="40px" />}
        links={[
          { label: "Özellikler", href: "#features" },
          {
            label: "Ürün&Hizmetler",
            href: "#",
          },
          { label: "İndir", href: "/download" },
          { label: "Dokümantasyon", href: "#documentation" },
        ]}
      />
    );
  }
}
