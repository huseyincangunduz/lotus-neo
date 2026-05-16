import { NeolitComponent, type NeolitNode } from "@ubs-platform/neolit/core";
import { Icon, materialSymbolsOutlined } from "@libs/ui/icon";
import {
  IntroNavbar,
  IntroHeroLarge,
  IntroHeroFeature,
  IntroFeaturesGrid,
  IntroPricing,
  IntroFooter,
  HeroDepressed,
  // HeroDepressed,
} from "@libs/extended/introductions";
import { inject } from "@ubs-platform/neolit/injectables";


export class PostralMainPage extends NeolitComponent {
  render(): NeolitNode | NeolitNode[] {
    return (
      <>

        <IntroHeroLarge
          header="Postral ile ödeme yönetimini kolaylaştırın"
          text="Postral, Lotus'un açık kaynaklı altyapısı UBS Mona üzerine geliştirilen bir ödeme yönetim sistemidir. Her ihtiyacınıza göre özelleştirilebilir, güvenilir ve ölçeklenebilir bir çözüm sunar. Postral ile ödeme süreçlerinizi kolayca yönetin, müşteri deneyimini artırın ve işinizi büyütün."
          primaryAction={{ label: "GitHub'da İncele", href: inject("GITHUB_URL") }}
          secondaryAction={{ label: "Özellikleri Keşfet", href: "#features" }}
          // backgroundNode={<HeroDepressed></HeroDepressed>}
        />

        <IntroHeroFeature
          header="İhtiyacınıza göre özelleştirilebilir, güvenilir ve ölçeklenebilir bir çözüm"
          text="Postral mimarisi ile ödeme hizmetlerini ekleyebilirsiniz, alınmış ödemeleri yönetebilir ve gelirlerinizi yönetebilirsiniz."
          image="/scability.png"
          imageAlt="Neolit Logo"
          imagePosition="right"
        />

        <IntroHeroFeature
          header="Core ile kendi uygulamanızı canlandırın"
          text="Postral Core, ödeme yönetimi için temel özellikler sunar. Kendi uygulamanızı geliştirmek veya mevcut sisteminize entegre etmek için esnek bir temel sağlar."
          image="/teknisyen-tetakun.png"
          imageAlt="Neolit Logo"
          imagePosition="left"
        />

        <IntroFeaturesGrid
          id="features"
          heading="Temel Özellikler"
          items={[
            {
              icon: materialSymbolsOutlined("bolt", "1.5rem", "1.5rem"),
              itemHead: "Esnek",
              itemDesc:
                "Postral sisteminin REST ve Engine5 APIlerinin desteği ile kolay entegrasyon sağlar.",
            },
            {
              icon: materialSymbolsOutlined(
                "encrypted_add",
                "1.5rem",
                "1.5rem",
              ),
              itemHead: "Güvenilir",
              itemDesc: "Postral, güvenilir bir ödeme yönetim sistemi sunar.",
            },
            {
              icon: materialSymbolsOutlined("heart_plus", "1.5rem", "1.5rem"),
              itemHead: "Açık kaynak",
              itemDesc:
                "Postral Core, MIT Lisansı ile açık kaynak olarak sunulur. Kendi ihtiyacınıza göre özelleştirebilir ve dağıtabilirsiniz. Ayrıca sizin katkılarınızı da bekliyoruz :)",
            },
            // { icon: materialSymbolsOutlined('bolt', '1.5rem', '1.5rem'), itemHead: 'State', itemDesc: 'Reaktif veriyi tutar, set/update ile anlık güncellenir.' },
            // { icon: materialSymbolsOutlined('layers', '1.5rem', '1.5rem'), itemHead: 'Stateful', itemDesc: 'Yalnızca ilgili alt bloğu yeniden çizer, verimli günceller.' },
            // { icon: materialSymbolsOutlined('repeat', '1.5rem', '1.5rem'), itemHead: 'For Loop', itemDesc: 'Dinamik listeleri state üzerinden yönetir ve render eder.' },
            // { icon: materialSymbolsOutlined('route', '1.5rem', '1.5rem'), itemHead: 'Routing', itemDesc: 'Yerleşik router ile SPA navigasyonu kolayca yönetilir.' },
            // { icon: materialSymbolsOutlined('hub', '1.5rem', '1.5rem'), itemHead: 'Injectables', itemDesc: 'Dependency injection ile servislerinizi bileşenlere enjekte edin.' },
            // {
            //   icon: materialSymbolsOutlined("speed", "1.5rem", "1.5rem"),
            //   itemHead: "Zero Overhead",
            //   itemDesc:
            //     "Virtual DOM yok, gereksiz yeniden render yok, minimum boyut.",
            // },
          ]}
        />
        <IntroHeroFeature
          header="Çok daha fazlası yolda"
          text={<>
          Postral'in güçlü altyapısı ile gelecekteki özellikler için hazır olun. 
          E-Ticaret uygulamalarınızda sizi öne çıkaracak <b>E-Commerce</b> sürümü, 
          restoran ve esnaf işletmeleri için özel olarak tasarlanmış <b>ASPAVA</b> sürümleri 
          ve son olarak tüm şubelerinizi ve işletmelerinizi tek bir çatı altında yönetmenizi sağlayacak <b>Zincir</b> gibi ürünler üzerinde yoğun bir şekilde
          üstünde çalışıyoruz ve sizlere en kısa sürede sunabilmek için sabırsızlanıyoruz.</>}
          image="/tetakun-with-lotuschan.png"
          imageAlt="Neolit Logo"
          imagePosition="right"
        />

      </>
    );
  }
}
