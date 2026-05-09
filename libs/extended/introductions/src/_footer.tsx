import { NeolitComponent, type NeolitNode } from "@ubs-platform/neolit/core";
import { Icon, type IconProperties } from "@libs/ui/icon";

export interface FooterLink {
  label: string;
  href: string;
}

export interface FooterLinkGroup {
  title: string;
  links: FooterLink[];
}

export interface SocialLink {
  icon: IconProperties;
  href: string;
  label?: string;
}

export interface FooterProperties {
  id?: string;
  copyright?: string;
  linkGroups?: FooterLinkGroup[];
  socialLinks?: SocialLink[];
}

export class IntroFooter extends NeolitComponent<FooterProperties> {
  properties: FooterProperties = {
    copyright: '© 2026',
    linkGroups: [],
    socialLinks: [],
  };

  render(): NeolitNode {
    const { id, copyright, linkGroups, socialLinks } = this.properties;
    const groupList = linkGroups ?? [];
    const socialList = socialLinks ?? [];

    return (
      <footer id={id} className="w-full border-t border-slate-200 bg-slate-50 px-6 py-12">
        <div className="mx-auto max-w-7xl flex flex-col gap-8 sm:flex-row sm:justify-between sm:items-start">

          {/* Left: copyright + social icons */}
          <div className="flex flex-col gap-4">
            <p className="text-sm text-slate-500 max-w-xs leading-relaxed">{copyright}</p>
            {socialList.length > 0 ? (
              <div className="flex items-center gap-2">
                {socialList.map((social) => (
                  <a
                    href={social.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={social.label ?? 'Sosyal medya'}
                    className="flex items-center justify-center w-9 h-9 rounded-lg border border-slate-200 bg-white text-slate-600 hover:border-slate-400 hover:text-slate-900 transition-colors shadow-sm"
                  >
                    <Icon {...social.icon} />
                  </a>
                ))}
              </div>
            ) : null}
          </div>

          {/* Right: link groups */}
          {groupList.length > 0 ? (
            <div className="flex flex-wrap gap-10">
              {groupList.map((group) => (
                <div className="flex flex-col gap-3">
                  <h4 className="text-xs font-bold uppercase tracking-widest text-slate-500">
                    {group.title}
                  </h4>
                  <ul className="flex flex-col gap-2">
                    {group.links.map((link) => (
                      <li>
                        <a
                          href={link.href}
                          className="text-sm text-slate-600 hover:text-slate-900 transition-colors"
                        >
                          {link.label}
                        </a>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          ) : null}

        </div>
      </footer>
    );
  }
}
