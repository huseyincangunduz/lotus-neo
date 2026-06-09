import {
  DownloadWarning,
  IntroDownloads,
  type DownloadGroup,
} from "@libs/extended/introductions";
import { Icon, iconifyIcon } from "@libs/ui/icon";
import { NeolitComponent, type NeolitNode } from "@ubs-platform/neolit/core";

export class DownloadLinks extends NeolitComponent {
  readonly serviceEditionLinks = [
    {
      os: "Windows 10 ve üzeri",
      osGroup: "Windows",
      downloads: [
        {
          processorArchitecture: "x64",
          terminalCommand:
            "irm https://raw.githubusercontent.com/ubs-platform/postral-core/master/install.ps1 | iex",
          url: "https://raw.githubusercontent.com/ubs-platform/postral-core/master/infrastructure/docker-compose.yml",
          checksum: "",
          size: 0,
          title:
            "64bit Intel/AMD tabanlı işlemci için Windows powershell komutu ile kurulum",
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
            "curl -fsSL https://raw.githubusercontent.com/ubs-platform/postral-core/master/install.sh | bash",
          title:
            "Bir çok genel GNU/Linux dağıtımlarında çalışacak bash komutu ile kurulum.",
        },
      ],
    },
    {
      os: "MacOS 10.15 ve üzeri",
      osGroup: "MacOS",
      downloads: [
        {
          processorArchitecture: "x64",
          terminalCommand:
            "curl -fsSL https://raw.githubusercontent.com/ubs-platform/postral-core/master/install.sh | bash",
          title:
            "2019 model Mac cihazlarda ve Güncel MacOS çalışacak bash komutu ile kurulum. (Resmi olarak Apple Silicon şu anda desteklenmemektedir. Rosetta ile çalıştırılabilir ancak test edilmemiştir.)",
        },
      ],
    },
  ] as DownloadGroup[];

  readonly allInOneEditionLinks = [
    {
      os: "Windows 10 ve üzeri",
      osGroup: "Windows",
      downloads: [
        {
          processorArchitecture: "x64",
          // url: "https://raw.githubusercontent.com/ubs-platform/postral-core/master/infrastructure/docker-compose.yml",
          checksum: "",
          size: 0,
          title:
            "64bit Intel/AMD tabanlı işlemci için Windows Kurulum uygulaması",
        },
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
          heading={
            <>
              {<Icon {...iconifyIcon("docker", "2rem")} />} Docker destekli
              Sunucu Sürümü
            </>
          }
          description={
            "Postral Core'un mikroservis versiyonu docker üzerinden dağıtılmaktadır. Aşağıdaki bağlantılardan docker-compose konfigürasyonunu indirerek hızlıca kurulum yapabilirsiniz."
          }
        />
        <IntroDownloads
          groups={this.allInOneEditionLinks}
          heading={"ÇOK YAKINDA - Hepsi Bir Arada Sürümü"}
          description={
            // Şu anda hepsi bir arada sürümü üstünde çalışıyorum. Bu yüzden bağlantılar 'Çok yakında' olarak görünecek ve açıklamada çok yakında olduğunu yazacağız
            <>
              Postral'in AIO sürümü, docker tabanlı sunucu sürümünün aksine, tek
              bir uygulama olarak dağıtılacak ve özellikle teknik olmayan
              kullanıcıların kurulumunu kolaylaştırmak için tasarlanmıştır. Bu
              sürüm üstünde çalışıyoruz ve sizinle en kısa sürede paylaşmak için
              sabırsızlanıyoruz. <b>Çok yakında</b>
            </>
          }
        />
      </>
    );
  }
}
