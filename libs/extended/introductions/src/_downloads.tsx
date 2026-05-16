import {
  NeolitComponent,
  type NeolitNode,
  type StateOrPlain,
} from "@ubs-platform/neolit/core";
import { Button } from "@libs/ui/button";
import { Icon, iconifyIcon, type IconProperties } from "@libs/ui/icon";

export interface DownloadItem {
  processorArchitecture: string;
  url?: string;
  checksum?: string;
  size?: number;
  title: string;
  terminalCommand?: string;
}

export interface DownloadGroup {
  os: string;
  osGroup: string;
  downloads: DownloadItem[];
}

export interface DownloadsProperties {
  id?: string;
  heading?: NeolitNode | StateOrPlain<string>;
  description?: NeolitNode | StateOrPlain<string>;
  groups?: DownloadGroup[];
}

function formatBytes(bytes: number): string {
  if (!bytes || bytes === 0) return "";
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024)
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

function osIcon(osGroup: string): IconProperties {
  switch (osGroup.toLowerCase()) {
    case "macos":
      return iconifyIcon("apple");
    case "windows":
      return iconifyIcon("windows");
    case "linux":
      return iconifyIcon("linux");
    case "docker":
      return iconifyIcon("logos:docker-icon");
    default:
      return iconifyIcon("terminal");
  }
}

function detectCurrentOsGroup(): string {
  const platform: string =
    (navigator as any).userAgentData?.platform ?? navigator.platform ?? "";
  const ua = navigator.userAgent;
  const lc = platform.toLowerCase();

  if (lc.includes("mac") || ua.includes("Mac OS")) return "macOS";
  if (lc.includes("win") || ua.includes("Windows")) return "Windows";
  if (lc.includes("linux") || ua.includes("Linux")) return "Linux";
  return "";
}

export class IntroDownloads extends NeolitComponent<DownloadsProperties> {
  properties: DownloadsProperties = {
    heading: "İndir",
    description: "Alt başlık",
    groups: [],
  };

  render(): NeolitNode {
    const { id, heading, groups } = this.properties;

    // Group by osGroup
    const groupedMap = new Map<string, DownloadGroup[]>();
    for (const g of groups ?? []) {
      const existing = groupedMap.get(g.osGroup) ?? [];
      existing.push(g);
      groupedMap.set(g.osGroup, existing);
    }
    const detectedOs = detectCurrentOsGroup();
    const osGroups = Array.from(groupedMap.entries()).sort(([a], [b]) => {
      if (a === detectedOs) return -1;
      if (b === detectedOs) return 1;
      return 0;
    });

    return (
      <section id={id} className="w-full py-20 px-6 bg-(--color-surface)">
        {/* <div className="bg-orange-100 mt-4">
            Warning: Always verify the SHA256 checksums of the files you download. The download links are provided from official sources, but it's important to be cautious against potential third-party tampering.
        </div> */}
        <div className="mx-auto max-w-7xl flex flex-col gap-12">
          {heading ? (
            <div className="text-center flex flex-col gap-3">
              <h2 className="text-3xl font-black text-(--color-fg)">
                {heading}
              </h2>
            </div>
          ) : null}
          <div>
            <div className="bg-orange-200 p-3">
              <h2>Önemli uyarılar</h2>
              <ul className="list-disc list-inside text-sm text-(--color-fg)/80">
                <li>
                  Resmi olarak sağlanan dosyalar ve terminal kodları güvenlidir,
                  ancak her ihtimale karşı eğer emin değilseniz, ya da
                  bağlantınız güvenli değilse çalıştırmadan önce bilgili
                  teknisyenlere danışmanız şiddetle tavsiye edilir.
                </li>
                <li>
                  Her ihtimale karşı indirdiğiniz dosyaların SHA256
                  checksumlarını doğrulayın. İndirme bağlantıları resmi
                  kaynaklardan sağlanmaktadır, ancak üçüncü taraf müdahalelerine
                  karşı dikkatli olmak önemlidir.
                </li>
                <li>
                  Çalıştırdığınızda bilgisayarınız normalden fazla tuhaf
                  davranırsa, lütfen derhal uygulamayı kapatın, internet
                  bağlantılarını kesin ve bir teknisyene danışın. Bu hatayı
                  info@tetakent.com adresine ya da resmi Tetakent sosyal medya
                  hesaplarına bildirmeniz halinde yaşadığınız sorunun size ya da
                  bir başkasına tekrarlanmamasına yardımcı olacaktır.
                </li>
                {/* <li>
                  Eğer yine de şüpheleriniz varsa, GitHub sayfamızda kaynak
                  kodlarına erişebilir ve kendi sisteminizde derleyebilirsiniz.
                </li> */}
              </ul>
            </div>
          </div>
          <div className="flex flex-col gap-10">
            {osGroups.map(([osGroup, subGroups]) => (
              <div className="flex flex-col gap-4">
                {/* OS Group Header */}
                <div className="flex items-center gap-3 border-b border-(--color-border) pb-3">
                  <Icon
                    {...osIcon(osGroup)}
                    size="1.5rem"
                    color="var(--color-fg)"
                  />
                  {/* <i
                    class="material-symbols-outlined"
                    style={{ fontSize: "1.5rem", lineHeight: "1.5rem", color: "var(--color-primary-card-bg-text)" }}
                  >
                    {osIcon(osGroup)}
                  </i> */}
                  <h3 className="text-xl font-bold text-(--color-fg)">
                    {osGroup}
                  </h3>
                  {osGroup === detectedOs ? (
                    <span className="inline-flex items-center gap-1 rounded-full bg-(--color-primary) px-2.5 py-0.5 text-xs font-semibold text-(--color-primary-text-on-bg)">
                      <i
                        class="material-symbols-outlined"
                        style={{ fontSize: "0.85rem", lineHeight: "0.85rem" }}
                      >
                        devices
                      </i>
                      Sizin sisteminiz
                    </span>
                  ) : null}
                </div>

                {/* Sub-OS sections */}
                <div className="flex flex-col gap-6">
                  {subGroups.map((group) => (
                    <div className="flex flex-col gap-3">
                      {group.os !== osGroup ? (
                        <p className="text-sm font-semibold text-(--color-fg)/60 uppercase tracking-wide">
                          {group.os}
                        </p>
                      ) : null}

                      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
                        {group.downloads.map((item) => (
                          <div className="rounded-(--radius-md) border border-(--color-border) bg-(--color-surface-1) p-5 shadow-sm flex flex-col gap-4">
                            {/* Title + arch badge */}
                            <div className="flex flex-col gap-1.5">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="inline-flex items-center gap-1 rounded-full bg-(--color-surface-2) px-2.5 py-0.5 text-xs font-semibold text-(--color-fg)/70 border border-(--color-border)">
                                  <i
                                    class="material-symbols-outlined"
                                    style={{
                                      fontSize: "0.85rem",
                                      lineHeight: "0.85rem",
                                    }}
                                  >
                                    memory
                                  </i>
                                  {item.processorArchitecture}
                                </span>
                                {item.size ? (
                                  <span className="text-xs text-(--color-fg)/50">
                                    {formatBytes(item.size)}
                                  </span>
                                ) : null}
                              </div>
                              <p className="text-sm font-medium text-(--color-fg) leading-snug">
                                {item.title}
                              </p>
                            </div>

                            {/* Terminal command */}
                            {item.terminalCommand ? (
                              <div className="flex flex-col gap-2">
                                <code className="block rounded-(--radius-sm) bg-(--color-surface-2) border border-(--color-border) px-3 py-2 text-xs font-mono text-(--color-fg)/80 break-all leading-relaxed">
                                  {item.terminalCommand}
                                </code>
                              </div>
                            ) : null}

                            {/* Download button */}
                            {item.url ? (
                              <div className="mt-auto">
                                <Button
                                  onClick={() => {
                                    window.open(item.url, "_blank");
                                  }}
                                  variant={"filled-primary"}
                                  label="İndir"
                                ></Button>
                              </div>
                            ) : !item.terminalCommand ? (
                              <div className="mt-auto">
                                <Button
                                  variant={"filled-secondary"}
                                  label="Yakında"
                                ></Button>
                              </div>
                            ) : null}

                            {/* Checksum */}
                            {item.checksum ? (
                              <p className="text-xs text-(--color-fg)/40 font-mono break-all">
                                SHA256: {item.checksum}
                              </p>
                            ) : null}
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>
    );
  }
}
