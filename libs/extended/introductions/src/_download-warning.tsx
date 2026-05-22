import { NeolitComponent } from "@ubs-platform/neolit/core";

export class DownloadWarning extends NeolitComponent {
  render() {
    return (
      <div className="bg-orange-200 p-3">
        <h2>Önemli uyarılar</h2>
        <ul className="list-disc list-inside text-sm text-(--color-fg)/80">
          <li>
            Resmi olarak sağlanan dosyalar ve terminal kodları güvenlidir, ancak
            her ihtimale karşı eğer emin değilseniz, ya da bağlantınız güvenli
            değilse çalıştırmadan önce bilgili teknisyenlere danışmanız şiddetle
            tavsiye edilir.
          </li>
          <li>
            Her ihtimale karşı indirdiğiniz dosyaların SHA256 checksumlarını
            doğrulayın. İndirme bağlantıları resmi kaynaklardan sağlanmaktadır,
            ancak üçüncü taraf müdahalelerine karşı dikkatli olmak önemlidir.
          </li>
          <li>
            Çalıştırdığınızda bilgisayarınız normalden fazla tuhaf davranırsa,
            lütfen derhal uygulamayı kapatın, internet bağlantılarını kesin ve
            bir teknisyene danışın. Bu hatayı info@tetakent.com adresine ya da
            resmi Tetakent sosyal medya hesaplarına bildirmeniz halinde
            yaşadığınız sorunun size ya da bir başkasına tekrarlanmamasına
            yardımcı olacaktır.
          </li>
          {/* <li>
                          Eğer yine de şüpheleriniz varsa, GitHub sayfamızda kaynak
                          kodlarına erişebilir ve kendi sisteminizde derleyebilirsiniz.
                        </li> */}
        </ul>
      </div>
    );
  }
}
