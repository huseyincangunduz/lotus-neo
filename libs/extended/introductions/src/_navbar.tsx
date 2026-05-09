import { NeolitComponent, type NeolitNode } from "@ubs-platform/neolit/core";

export interface NavLink {
  label: string;
  href?: string;
  target?: string;
  children?: NavLink[];
  onClick?: () => void;
}

export interface NavbarProperties {
  id?: string;
  logo?: string;
  logoHref?: string;
  links?: NavLink[];
}

export class IntroNavbar extends NeolitComponent<NavbarProperties> {
  properties: NavbarProperties = {
    logo: 'Logo',
    logoHref: '#',
    links: [],
  };

  render(): NeolitNode {
    const { id, logo, logoHref, links } = this.properties;

    return (
      <nav id={id} className="sticky top-0 z-50 w-full border-b border-slate-200/60 bg-white/70 backdrop-blur-md">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-3">

          {/* Logo */}
          <a href={logoHref ?? '#'} className="text-xl font-black tracking-tight text-slate-900">
            {logo}
          </a>

          {/* Links */}
          <div className="flex items-center gap-1">
            {(links ?? []).map((link) =>
              link.children && link.children.length > 0 ? (
                <div className="relative group">
                  <button className="flex items-center gap-0.5 rounded-lg px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 transition-colors">
                    {link.label}
                    <i class="material-symbols-outlined" style={{ fontSize: '1.1rem', lineHeight: '1.1rem' }}>keyboard_arrow_down</i>
                  </button>
                  <div className="absolute right-0 top-full mt-1.5 min-w-[160px] rounded-xl border border-slate-200 bg-white py-1 shadow-xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-150 z-10">
                    {link.children.map((child) => (
                      <a
                        href={child.href ?? '#'}
                        target={child.target}
                        onclick={() => child.onClick?.()}
                        className="block px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 transition-colors"
                      >
                        {child.label}
                      </a>
                    ))}
                  </div>
                </div>
              ) : (
                <a
                  href={link.href ?? '#'}
                  target={link.target}
                  onclick={() => link.onClick?.()}
                  className="rounded-lg px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 transition-colors"
                >
                  {link.label}
                </a>
              )
            )}
          </div>

        </div>
      </nav>
    );
  }
}
