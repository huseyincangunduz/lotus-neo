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
    // {
    //   os: "macOS",
    //   osGroup: "macOS",
    //   downloads: [
    //     {
    //       processorArchitecture: "x64",
    //       url: "",
    //       checksum: "",
    //       size: 0,
    //       title: "64bit Intel/AMD tabanlı işlemci için DMG Paketi",
    //     },
    //     {
    //       processorArchitecture: "arm64",
    //       url: "",
    //       checksum: "",
    //       size: 0,
    //       title: "Apple Silicon (M serisi) tabanlı işlemci için DMG Paketi",
    //     },
    //   ],
    // },
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
        }
      ],
    },
    {
      os: "Generic GNU/Linux",
      osGroup: "Linux",
      downloads: [
        {
          processorArchitecture: "x64",
          
          title:
            "Bir çok genel GNU/Linux dağıtımlarında çalışacak tar.gz paketi.",
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
            // Şu anda hepsi bir arada sürümü üstünde çalışıyorum. Bu yüzden bağlantılar 'Çok yakında' olarak görünecek ve açıklamada çok yakında olduğunu yazacağız
            <>Postral'in AIO sürümü, docker tabanlı sunucu sürümünün aksine, tek bir uygulama olarak dağıtılacak ve özellikle teknik olmayan kullanıcıların kurulumunu kolaylaştırmak için tasarlanmıştır. Bu sürüm üstünde çalışıyoruz ve sizinle en kısa sürede paylaşmak için sabırsızlanıyoruz. <b>Çok yakında</b></>
          }
        />
      </>
    );
  }
}
