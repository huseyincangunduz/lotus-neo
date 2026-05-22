import { DownloadWarning, IntroDownloads } from "@libs/extended/introductions";
import { NeolitComponent, type NeolitNode } from "@ubs-platform/neolit/core";

export class DownloadLinks extends NeolitComponent {
  readonly serviceEditionLinks = [
    {
      os: "Docker Compose",
      osGroup: "docker",
      downloads: [
        {
          processorArchitecture: "x64",
          title:
            "64bit Intel/AMD tabanlı işlemci tam paket docker konfigürasyonu",
          url: "https://github.com/ubs-platform/postral-core/blob/master/infrastructure/docker-compose.yml",
          terminalCommand:
            "docker pull ghcr.io/ubs-platform/postral-core:latest",
        },
      ],
    },
  ];

  readonly allInOneEditionLinks = [
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
          title:
            "Listelenmeyen GNU/Linux dağıtımları için 64bit Intel/AMD tabanlı işlemci için kurulum komutu",
        },
      ],
    },
  ];

  render(): NeolitNode {
    return (
      <>
        <DownloadWarning />
        <IntroDownloads
          groups={this.serviceEditionLinks}
          heading={"Sunucu Sürümü İndirme"}
          description={
            "Postral Core'un mikroservis versiyonu docker üzerinden dağıtılmaktadır. Aşağıdaki bağlantılardan docker-compose konfigürasyonunu indirerek hızlıca kurulum yapabilirsiniz."
          }
        />
        <IntroDownloads
          groups={this.allInOneEditionLinks}
          heading={"Hepsi Bir Arada Sürümü İndirme"}
          description={
            "Postral Core'un masaüstü uygulaması, tüm platformlarda çalışacak şekilde tasarlanmıştır. Aşağıdaki bağlantılardan işletim sisteminize uygun paketi indirerek kolayca kurulum yapabilirsiniz."
          }
        />
      </>
    );
  }
}
