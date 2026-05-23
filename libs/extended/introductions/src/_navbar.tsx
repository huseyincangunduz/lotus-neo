import {
  NeolitComponent,
  state,
  type NeolitNode,
} from "@ubs-platform/neolit/core";
import { WebDialog } from "@libs/ui/webdialog";
import { Accordion } from "@libs/ui/accordion";
import { HeroDepressed } from "./_hero_depressed";

export interface NavLink {
  label: string;
  href?: string;
  target?: string;
  children?: NavLink[];
  onClick?: () => void;
}

export interface NavbarProperties {
  id?: string;
  logo?: NeolitNode;
  logoHref?: string;
  links?: NavLink[];
}

export class IntroNavbar extends NeolitComponent<NavbarProperties> {
  mobileMenuOpen = state(false);

  properties: NavbarProperties = {
    logo: <HeroDepressed></HeroDepressed>,
    logoHref: "#",
    links: [],
  };

  render(): NeolitNode {
    const { id, logo, logoHref, links } = this.properties;

    return (
      <nav id={id} className="sticky top-0 z-50 w-full border-b border-(--color-border) text-(--color-primary-text-on-bg) bg-(--color-primary) backdrop-blur-md">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-3">
          {/* Logo */}
          <a
            href={logoHref ?? "#"}
            className="text-xl font-black tracking-tight text-(--color-primary-text-on-bg)"
          >
            {logo}
          </a>

          {/* Desktop Links */}
          <div className="hidden items-center gap-1 md:flex">
            {(links ?? []).map((link) =>
              link.children && link.children.length > 0 ? (
                <div className="relative group">
                  <button className="flex items-center gap-0.5 rounded-(--radius-sm) px-3 py-2 text-sm font-medium text-(--color-primary-text-on-bg) hover:bg-(--color-primary-hover) transition-colors">
                    {link.label}
                    <i
                      class="material-symbols-outlined"
                      style={{ fontSize: "1.1rem", lineHeight: "1.1rem" }}
                    >
                      keyboard_arrow_down
                    </i>
                  </button>
                  <div className="absolute right-0 top-full mt-1.5 min-w-[160px] rounded-(--radius-md) border border-(--color-border) bg-(--color-surface) py-1 shadow-xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-150 z-10">
                    {link.children.map((child) => (
                      <a
                        href={child.href ?? "#"}
                        target={child.target}
                        onclick={() => child.onClick?.()}
                        className="block px-4 py-2 text-sm text-(--color-fg) hover:bg-(--color-surface-1) transition-colors"
                      >
                        {child.label}
                      </a>
                    ))}
                  </div>
                </div>
              ) : (
                <a
                  href={link.href ?? "#"}
                  target={link.target}
                  onclick={() => link.onClick?.()}
                  className="rounded-(--radius-sm) px-3 py-2 text-sm font-medium text-(--color-primary-text-on-bg) hover:bg-(--color-primary-hover) transition-colors"
                >
                  {link.label}
                </a>
              )
            )}
          </div>

          {/* Mobile Hamburger */}
          <button
            className="inline-flex items-center justify-center rounded-(--radius-sm) p-2 text-(--color-primary-text-on-bg) hover:bg-(--color-primary-hover) md:hidden"
            onClick={() => this.mobileMenuOpen.set(true)}
            aria-label="Menüyü aç"
          >
            <i
              class="material-symbols-outlined"
              style={{ fontSize: "1.4rem", lineHeight: "1.4rem" }}
            >
              menu
            </i>
          </button>
        </div>

        <WebDialog
          show={this.mobileMenuOpen}
          position={"right"}
          width={"min(90vw, 360px)"}
          maxWidth={"360px"}
          maxHeight={"100dvh"}
          displayHeader={false}
          padding={false}
          onClose={() => this.mobileMenuOpen.set(false)}
        >
          <div className="flex flex-col gap-2 p-4">
            <div className="mb-1 flex items-center justify-between border-b border-(--color-border) pb-3">
              <span className="text-base font-semibold text-(--color-fg)">
                Menü
              </span>
              <button
                className="inline-flex items-center justify-center rounded-(--radius-sm) p-1 text-(--color-fg) hover:bg-(--color-surface-1)"
                onClick={() => this.mobileMenuOpen.set(false)}
                aria-label="Menüyü kapat"
              >
                <i class="material-symbols-outlined">close</i>
              </button>
            </div>

            {(links ?? []).map((link) =>
              link.children && link.children.length > 0 ? (
                <Accordion
                  title={link.label}
                  className="overflow-hidden"
                  headerClassName="rounded-none"
                >
                  <div>
                    {link.children.map((child) => (
                      <a
                        href={child.href ?? "#"}
                        target={child.target}
                        onclick={() => {
                          child.onClick?.();
                          this.mobileMenuOpen.set(false);
                        }}
                        className="block px-3 py-2 text-sm text-(--color-fg) hover:bg-(--color-surface-1)"
                      >
                        {child.label}
                      </a>
                    ))}
                  </div>
                </Accordion>
              ) : (
                <a
                  href={link.href ?? "#"}
                  target={link.target}
                  onclick={() => {
                    link.onClick?.();
                    this.mobileMenuOpen.set(false);
                  }}
                  className="rounded-(--radius-sm) px-3 py-2 text-sm font-medium text-(--color-fg) hover:bg-(--color-surface-1)"
                >
                  {link.label}
                </a>
              ),
            )}
          </div>
        </WebDialog>
      </nav>
    );
  }
}
