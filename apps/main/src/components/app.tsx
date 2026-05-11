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

const GITHUB_URL = 'https://github.com/huseyincangunduz/sacma-sapan-ui-frameworku';

export class AppComponent extends NeolitComponent {
  render(): NeolitNode | NeolitNode[] {
    return (
      <>
        <IntroNavbar
          logo="Neolit"
          logoHref="#"
          links={[
            { label: 'Özellikler', href: '#features' },
            {
              label: 'API',
              children: [
                { label: 'State', href: '#features' },
                { label: 'Stateful', href: '#features' },
                { label: 'For', href: '#features' },
              ],
            },
            { label: 'Fiyatlandırma', href: '#pricing' },
            { label: 'GitHub', href: GITHUB_URL, target: '_blank' },
          ]}
        />


        <IntroHeroLarge
          header="Modern, Yalın ve Hızlı UI Geliştirme"
          text="Neolit ile reaktif state yönetimi, esnek bileşen mimarisi ve sezgisel JSX desteğiyle modern web uygulamaları geliştirin. Virtual DOM yok, gereksiz yeniden render yok."
          primaryAction={{ label: "GitHub'da İncele", href: GITHUB_URL }}
          secondaryAction={{ label: 'Özellikleri Keşfet', href: '#features' }}
          gradient="from-cyan-50 via-white to-orange-50"
        />
        {/* <HeroDepressed /> */}

        <IntroHeroFeature
          header="Sadece ihtiyacın kadar framework"
          text="Virtual DOM yok. Ağır runtime yok. Neolit, reaktif state ile doğrudan DOM'u günceller. Sınıf tabanlı bileşenler ve deklaratif JSX'in gücüyle, minimum overhead ile maksimum kontrol elde edersin."
          image="/assets/neolit-full.png"
          imageAlt="Neolit Logo"
          imagePosition="right"
        />

        <IntroFeaturesGrid
          id="features"
          heading="Temel Özellikler"
          items={[
            { icon: materialSymbolsOutlined('bolt', '1.5rem', '1.5rem'), itemHead: 'State', itemDesc: 'Reaktif veriyi tutar, set/update ile anlık güncellenir.' },
            { icon: materialSymbolsOutlined('layers', '1.5rem', '1.5rem'), itemHead: 'Stateful', itemDesc: 'Yalnızca ilgili alt bloğu yeniden çizer, verimli günceller.' },
            { icon: materialSymbolsOutlined('repeat', '1.5rem', '1.5rem'), itemHead: 'For Loop', itemDesc: 'Dinamik listeleri state üzerinden yönetir ve render eder.' },
            { icon: materialSymbolsOutlined('route', '1.5rem', '1.5rem'), itemHead: 'Routing', itemDesc: 'Yerleşik router ile SPA navigasyonu kolayca yönetilir.' },
            { icon: materialSymbolsOutlined('hub', '1.5rem', '1.5rem'), itemHead: 'Injectables', itemDesc: 'Dependency injection ile servislerinizi bileşenlere enjekte edin.' },
            { icon: materialSymbolsOutlined('speed', '1.5rem', '1.5rem'), itemHead: 'Zero Overhead', itemDesc: 'Virtual DOM yok, gereksiz yeniden render yok, minimum boyut.' },
          ]}
        />

        <IntroPricing
          id="pricing"
          heading="Fiyatlandırma"
          plans={[
            {
              name: 'Community',
              price: 'Ücretsiz',
              features: ['Core API', 'JSX Runtime', 'Structural API', 'MIT Lisansı'],
              buttonLabel: 'Hemen Başla',
              onAction: () => window.open(GITHUB_URL, '_blank'),
            },
            {
              name: 'Pro',
              price: '99₺/ay',
              features: ['Community özellikleri', 'Öncelikli Destek', 'Bileşen Kütüphanesi', 'Güncelleme Bildirimleri'],
              buttonLabel: 'Satın Al',
              highlight: true,
            },
            {
              name: 'Enterprise',
              price: '499₺/ay',
              features: ['Pro özellikleri', 'Özel SLA', 'Kurumsal Destek', 'Özel Entegrasyon'],
              buttonLabel: 'Bize Ulaşın',
            },
          ]}
        />

        <IntroFooter
          copyright="© 2026 Tetakent (Hüseyin Can Gündüz). MIT Lisansı ile dağıtılmaktadır."
          linkGroups={[
            {
              title: 'Kaynaklar',
              links: [
                { label: 'GitHub', href: GITHUB_URL },
                { label: 'Dokümantasyon', href: '#' },
              ],
            },
            {
              title: 'Topluluk',
              links: [
                { label: 'Discord', href: '#' },
                { label: 'Katkıda Bulun', href: GITHUB_URL },
              ],
            },
          ]}
          socialLinks={[
            { icon: materialSymbolsOutlined('code'), href: GITHUB_URL, label: 'GitHub' },
          ]}
        />
      </>
    );
  }
}

