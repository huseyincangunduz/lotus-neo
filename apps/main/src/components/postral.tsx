import { NeolitComponent, type NeolitNode } from "@ubs-platform/neolit/core";
import { materialSymbolsOutlined } from "@libs/ui/icon";
import {
  IntroNavbar,
  IntroHeroLarge,
  IntroHeroFeature,
  IntroFeaturesGrid,
  IntroPricing,
  IntroFooter,
  // HeroDepressed,
} from "@libs/extended/introductions";

const GITHUB_URL =
  "https://github.com/huseyincangunduz/sacma-sapan-ui-frameworku";

export class PostralMainPage extends NeolitComponent {
  render(): NeolitNode | NeolitNode[] {
    return (
      <>
        <IntroNavbar
          logo="Postral"
          logoHref="#"
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
          ]}
        />

        <IntroHeroLarge
          header="Postral ile ödeme yönetimini kolaylaştırın"
          text="Postral, Lotus'un açık kaynaklı altyapısı UBS Mona üzerine geliştirilen bir ödeme yönetim sistemidir. Her ihtiyacınıza göre özelleştirilebilir, güvenilir ve ölçeklenebilir bir çözüm sunar. Postral ile ödeme süreçlerinizi kolayca yönetin, müşteri deneyimini artırın ve işinizi büyütün."
          primaryAction={{ label: "GitHub'da İncele", href: GITHUB_URL }}
          secondaryAction={{ label: "Özellikleri Keşfet", href: "#features" }}
          gradient="from-cyan-50 via-white to-orange-50"
        />
        {/* <HeroDepressed /> */}

        <IntroHeroFeature
          header="İhtiyacınıza göre özelleştirilebilir, güvenilir ve ölçeklenebilir bir çözüm"
          text="Postral mimarisi ile ödeme hizmetlerini ekleyebilirsiniz, alınmış ödemeleri yönetebilir ve gelirlerinizi yönetebilirsiniz."
          image="/assets/neolit-full.png"
          imageAlt="Neolit Logo"
          imagePosition="right"
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
              icon: materialSymbolsOutlined("safe", "1.5rem", "1.5rem"),
              itemHead: "Güvenilir",
              itemDesc: "Postral, güvenilir bir ödeme yönetim sistemi sunar.",
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

        <IntroPricing
          id="pricing"
          heading="Fiyatlandırma"
          plans={[
            {
              name: "Core",
              price: "Ücretsiz",
              features: [
                "Core API ile ödeme yönetimininizi kolaylaştırın",
                "MIT Lisansı ile kendi ihtiyacınıza göre özelleştirin",
              ],
              buttonLabel: "Hemen Başla",
              onAction: () => window.open(GITHUB_URL, "_blank"),
            },
            {
              name: "E-Commerce",
              price: "200₺/ay",
              features: [
                "Core özellikleri",
                "Gelişmiş ürün filtreleme",
                "Stok yönetimi",
                "Kargo yönetimi",
                "Müşteri segmentasyonu",
              ],
              buttonLabel: "İletişime geç",
            },
            {
              name: "Aspava Lite",
              price: "Ücretsiz",
              features: [
                "Core özellikleri",
                "Gelişmiş ürün filtreleme",
                "Barkod okuyucu entegrasyonu",
                "Stok yönetimi",
              ],
              buttonLabel: "İndir",
            },
            {
              name: "Aspava",
              price: "Ücretsiz",
              features: [
                "Core özellikleri",
                "Gelişmiş ürün filtreleme",
                "Barkod okuyucu entegrasyonu",
                "Stok yönetimi",
              ],
              buttonLabel: "İndir",
            },
          ]}
        />

        <IntroFooter
          copyright="© 2026 Tetakent (Hüseyin Can Gündüz). MIT Lisansı ile dağıtılmaktadır."
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
