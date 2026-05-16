import { IntroDownloads } from "@libs/extended/introductions";
import { NeolitComponent, type NeolitNode } from "@ubs-platform/neolit/core";

export class DownloadLinks extends NeolitComponent {
  readonly links = [
    {
      os: "macOS",
      osGroup: "macOS",
      downloads: [
        {
          processorArchitecture: "x64",
          url: "",
          checksum: "",
          size: 0,
          title: "64bit Intel/AMD tabanlı işlemci için DMG Paketi",
        },
        {
          processorArchitecture: "arm64",
          url: "",
          checksum: "",
          size: 0,
          title: "Apple Silicon (M serisi) tabanlı işlemci için DMG Paketi",
        },
      ],
    },
    {
      os: "Windows 10 ve üzeri",
      osGroup: "Windows",
      downloads: [
        {
          processorArchitecture: "x64",
          url: "",
          checksum: "",
          size: 0,
          title:
            "64bit Intel/AMD tabanlı işlemci için Windows Kurulum uygulaması",
        },
        {
          processorArchitecture: "arm64",
          url: "",
          checksum: "",
          size: 0,
          title: "ARM tabanlı işlemci için Windows Kurulum uygulaması",
        },
      ],
    },
    {
      os: "Redhat, Fedora",
      osGroup: "Linux",
      downloads: [
        {
          processorArchitecture: "x64",
          url: "",
          checksum: "",
          size: 0,
          title: "64bit Intel/AMD tabanlı işlemci için RPM Paketi",
        },
        {
          processorArchitecture: "arm64",
          url: "https://google.com",
          checksum: "sadas",
          size: 0,
          title: "ARM tabanlı işlemci için RPM Paketi",
        },
      ],
    },
    {
      os: "Generic GNU/Linux",
      osGroup: "Linux",
      downloads: [
        {
          processorArchitecture: "x64",
          terminalCommand:
            "sudo rm -rf \\ #şaka yapıyorum, bu şeyi çalıştırmayın! Bu sadece bir örnek komut.",
          title: "Listelenmeyen GNU/Linux dağıtımları için 64bit Intel/AMD tabanlı işlemci için kurulum komutu",
        },
      ],
    },
  ];

  render(): NeolitNode {
    return (
      <IntroDownloads
        groups={this.links}
        heading={"İndir"}
        description={
          "Postral Core'u bu bölümden size uygun işletim sistemine göre indirebilirsiniz."
        }
      />
    );
  }
}
