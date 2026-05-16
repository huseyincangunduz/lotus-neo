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
      os: "Windows",
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
          url: "",
          checksum: "",
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
          title: "64bit Intel/AMD tabanlı işlemci için Generic Linux Paketi",
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
