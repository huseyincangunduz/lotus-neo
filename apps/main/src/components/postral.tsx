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

const GITHUB_URL = "https://github.com/ubs-platform/postral-core";

export class PostralMainPage extends NeolitComponent {
  render(): NeolitNode | NeolitNode[] {
    return (
      <>
        <IntroNavbar
          logoHref="#"
          logo={<Icon imgSrc="/public/postral-logo.svg" imageHeight="40px" />}
          links={[
            { label: "Özellikler", href: "#features" },
            {
              label: "Ürün&Hizmetler",
              children: [
                { label: "Core", href: "#features" },
                { label: "E-Commerce", href: "#features" },
                { label: "ASPAVA Lite", href: "#features" },
                { label: "ASPAVA", href: "#features" },
                { label: "Zincir", href: "#features" },
              ],
            },
            { label: "Fiyatlandırma", href: "#pricing" },
            { label: "Dokümantasyon", href: "#documentation" },
          ]}
        />

        <IntroHeroLarge
          header="Postral ile ödeme yönetimini kolaylaştırın"
          text="Postral, Lotus'un açık kaynaklı altyapısı UBS Mona üzerine geliştirilen bir ödeme yönetim sistemidir. Her ihtiyacınıza göre özelleştirilebilir, güvenilir ve ölçeklenebilir bir çözüm sunar. Postral ile ödeme süreçlerinizi kolayca yönetin, müşteri deneyimini artırın ve işinizi büyütün."
          primaryAction={{ label: "GitHub'da İncele", href: GITHUB_URL }}
          secondaryAction={{ label: "Özellikleri Keşfet", href: "#features" }}
          backgroundNode={<HeroDepressed></HeroDepressed>}
        />

        <IntroHeroFeature
          header="İhtiyacınıza göre özelleştirilebilir, güvenilir ve ölçeklenebilir bir çözüm"
          text="Postral mimarisi ile ödeme hizmetlerini ekleyebilirsiniz, alınmış ödemeleri yönetebilir ve gelirlerinizi yönetebilirsiniz."
          image="/assets/neolit-full.png"
          imageAlt="Neolit Logo"
          imagePosition="right"
        />

        <IntroHeroFeature
          header="Core ile kendi uygulamanızı canlandırın"
          text="Postral Core, ödeme yönetimi için temel özellikler sunar. Kendi uygulamanızı geliştirmek veya mevcut sisteminize entegre etmek için esnek bir temel sağlar."
          image="/assets/neolit-full.png"
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
              icon: materialSymbolsOutlined(
                "heart_plus",
                "1.5rem",
                "1.5rem",
              ),
              itemHead: "Açık kaynak",
              itemDesc: "Postral Core, MIT Lisansı ile açık kaynak olarak sunulur. Kendi ihtiyacınıza göre özelleştirebilir ve dağıtabilirsiniz. Ayrıca sizin katkılarınızı da bekliyoruz :)",
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
          header="Yerel işletmeniz için mükemmel çözüm"
          text="Postral Aspava ürünleri, yerel işletmelerin ihtiyaçlarına uygun, esnek ve güvenilir bir ödeme yönetim sistemi sunar."
          image="/assets/neolit-full.png"
          imageAlt="Neolit Logo"
          imagePosition="right"
        />

        <IntroPricing
          id="pricing"
          heading="Restaurant ve esnaf işletmeleri için"
          plans={[
            {
              name: "Aspava Lite",
              price: "Ücretsiz",
              features: [
                "Core özellikleri",
                "Gelişmiş ürün filtreleme",
                "Barkod okuyucu entegrasyonu",
                "Stok yönetimi",
              ],
              buttonLabel: "Daha fazla bilgi",
            },
            {
              name: "Aspava",
              price: "Ücretsiz",
              features: [
                "Aspava Lite özellikleri",
                "Yerleşik Yemeksepeti, Getir, Uber eats (Trendyol) ve Migros Yemek entegrasyonları",
                "Gelişmiş müşteri segmentasyonu",
              ],
              buttonLabel: "Daha fazla bilgi",
            },
          ]}
        />

        <IntroFooter
          appCompanyLogo={
            <Icon
              imgSrc="/public/postral-with-tetakent-logo-colored.svg"
              imageHeight="40px"
            />
          }
          copyright="© 2026 Tetakent (Hüseyin Can Gündüz). Tüm hakları saklıdır. Postral Core ürününün kaynak kodları MIT Lisansı ile dağıtılmaktadır."
          linkGroups={[
            {
              title: "Kaynaklar",
              links: [
                { label: "GitHub", href: GITHUB_URL },
                { label: "Dokümantasyon", href: "#" },
              ],
            },
            {
              title: "Topluluk",
              links: [
                { label: "Discord", href: "#" },
                { label: "Katkıda Bulun", href: GITHUB_URL },
              ],
            },
          ]}
          socialLinks={[
            {
              icon: materialSymbolsOutlined("code"),
              href: GITHUB_URL,
              label: "GitHub",
            },
          ]}
        />
      </>
    );
  }
}
