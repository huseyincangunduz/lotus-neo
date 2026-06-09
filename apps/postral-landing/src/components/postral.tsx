import { NeolitComponent, type NeolitNode } from "@ubs-platform/neolit/core";
import { materialSymbolsOutlined } from "@libs/ui/icon";
import {
  IntroHeroLarge,
  IntroHeroFeature,
  IntroFeaturesGrid,
  // HeroDepressed,
} from "@libs/extended/introductions";
import { inject } from "@ubs-platform/neolit/injectables";
import { Router } from "@ubs-platform/neolit/routing";
import { asset } from "@libs/asset";


export class PostralMainPage extends NeolitComponent {
  readonly router = inject(Router)
  render(): NeolitNode | NeolitNode[] {
    return (
      <>

        <IntroHeroLarge
          header="Postral ile ödeme yönetimini kolaylaştırın"
          text="Postral, Lotus'un açık kaynaklı altyapısı UBS Mona üzerine geliştirilen bir ödeme yönetim sistemidir. Her ihtiyacınıza göre özelleştirilebilir, güvenilir ve ölçeklenebilir bir çözüm sunar. Postral ile ödeme süreçlerinizi kolayca yönetin, müşteri deneyimini artırın ve işinizi büyütün."
          primaryAction={{ label: "İndir", onClick: () => this.router.navigate("/download") }}
          secondaryAction={{ label: "Özellikleri Keşfet", href: "#features" }}
          // backgroundNode={<HeroDepressed></HeroDepressed>}
        />

        <IntroHeroFeature
          header="İhtiyacınıza göre özelleştirilebilir, güvenilir ve ölçeklenebilir bir çözüm"
          text="Postral mimarisi ile ödeme hizmetlerini ekleyebilirsiniz, alınmış ödemeleri yönetebilir ve gelirlerinizi yönetebilirsiniz."
          image={<img src={asset('scability.png')} alt="Neolit Logo" class="max-w-full max-h-80 object-contain drop-shadow-xl" />}
          imagePosition="right"
        />

        <IntroHeroFeature
          header="Core ile kendi uygulamanızı canlandırın"
          text="Postral Core, ödeme yönetimi için temel özellikler sunar. Kendi uygulamanızı geliştirmek veya mevcut sisteminize entegre etmek için esnek bir temel sağlar."
          image={<img src={asset('teknisyen-tetakun.png')} alt="Neolit Logo" class="max-w-full max-h-80 object-contain drop-shadow-xl" />}
          imagePosition="left"
        />
        {/* 
        Özellikler:
        - Esnek: Postral sisteminin REST ve Engine5 APIlerinin desteği ile kolay entegrasyon sağlar.
        - Çoklu ödeme yöntemleri: Kredi kartları, banka kartları, dijital cüzdanlar ve daha fazlasını destekler.
        - Çoklu pazar: Postral, dilediğiniz zaman farklı satıcıları ve pazarları ekleyip yönetmenize olanak tanır, böylece işinizi kolayca ölçeklendirebilirsiniz.
        - Çoklu para birimi: Postral, farklı para birimlerini destekler, böylece uluslararası müşterilere hizmet verebilirsiniz.
        - Komisyon yönetimi: Postral, satıcılarınız için esnek komisyon oranları belirlemenize ve yönetmenize olanak tanır.
        - Türk Vergi Sistemine uyumlu: Postral, Türkiye'nin vergi mevzuatına uygun olarak tasarlanmıştır, böylece yasal gereklilikleri karşılar.
        - Gelir yönetimi: Sizin ve satıcılarınızın gelirlerini günlük, haftalık veya aylık olarak takip edebilirsiniz.
        - Faturalama: Postral'in event yönetimi ile faturalama süreçlerinizi otomatikleştirebilir ve kolaylaştırabilirsiniz. Ayrıca UBL export ile e-fatura entegrasyonununuzu zahmetsizce gerçekleştirebilirsiniz.
        - Güvenilir: Postral, güvenilir bir ödeme yönetim sistemi sunar.
        - Açık kaynak: Postral Core, MIT Lisansı ile açık kaynak olarak sunulur. Kendi ihtiyacınıza göre özelleştirebilir ve dağıtabilirsiniz. Ayrıca sizin katkılarınızı da bekliyoruz :)
        
        */}
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
              icon: materialSymbolsOutlined("payment", "1.5rem", "1.5rem"),
              itemHead: "Çoklu ödeme yöntemleri",
              itemDesc:
                "Kredi kartları, banka kartları, dijital cüzdanlar ve daha fazlasını destekler.",
            },
            {
              icon: materialSymbolsOutlined("storefront", "1.5rem", "1.5rem"),
              itemHead: "Çoklu pazar",
              itemDesc:
                "Postral, dilediğiniz zaman farklı satıcıları ve pazarları ekleyip yönetmenize olanak tanır, böylece işinizi kolayca ölçeklendirebilirsiniz.",
            },
            {
              icon: materialSymbolsOutlined("currency_exchange", "1.5rem", "1.5rem"),
              itemHead: "Çoklu para birimi",
              itemDesc:
                "Postral, farklı para birimlerini destekler, böylece uluslararası müşterilere hizmet verebilirsiniz.",
            },
            {
              icon: materialSymbolsOutlined("account_balance", "1.5rem", "1.5rem"),
              itemHead: "Komisyon yönetimi",
              itemDesc:
                "Postral, satıcılarınız için esnek komisyon oranları belirlemenize ve yönetmenize olanak tanır.",
            },
            {
              icon: materialSymbolsOutlined("receipt_long", "1.5rem", "1.5rem"),
              itemHead: "Türk Vergi Sistemine uyumlu",
              itemDesc:
                "Postral, Türkiye'nin vergi mevzuatına uygun olarak tasarlanmıştır, böylece yasal gereklilikleri karşılar.",
            },
            {
              icon: materialSymbolsOutlined("account_balance_wallet", "1.5rem", "1.5rem"),
              itemHead: "Gelir yönetimi",
              itemDesc:
                "Sizin ve satıcılarınızın gelirlerini günlük, haftalık veya aylık olarak takip edebilirsiniz.", 
            },{
              icon: materialSymbolsOutlined("receipt", "1.5rem", "1.5rem"),
              itemHead: "Faturalama",
              itemDesc:
                "Postral'in event yönetimi ile faturalama süreçlerinizi otomatikleştirebilir ve kolaylaştırabilirsiniz. Ayrıca UBL export ile e-fatura entegrasyonununuzu zahmetsizce gerçekleştirebilirsiniz.",
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
          image={<img src={asset('tetakun-with-lotuschan.png')} alt="Neolit Logo" class="max-w-full max-h-80 object-contain drop-shadow-xl" />}
          imagePosition="right"
        />

      </>
    );
  }
}
