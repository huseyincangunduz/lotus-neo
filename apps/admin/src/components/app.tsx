import { NeolitComponent, state } from "@ubs-platform/neolit/core";
import { Button } from "@libs/ui/button";
import { KeltosKel } from "@libs/keltos-kel";
import "@libs/ui/webdialog";
import { WebDialog } from "@libs/ui/webdialog";
import { materialSymbolsOutlined } from "@libs/ui/icon";
import { Pagination } from "@libs/ui/touch/pagination";
import { Checkbox } from "@libs/ui/checkbox";
import { ToggleSwitch } from "@libs/ui/toggle-switch";
import { AlertToastContainer, toastService } from "@libs/ui/alert-toast";

export class AppComponent extends NeolitComponent {
  showDialog = state(false);
  staticText = state("Hello, World!");
  padding = state(true);
  position = state<"center" | "right" | "left" | "bottom-center" | "bottom">(
    "center",
  );
  selectedPage = state<string>("1");
  toastService = toastService;

  onInit(): void {}

  showToasts(): void {
    this.toastService.info("Hoş Geldiniz!");
    this.toastService.error("Bir hata oluştu.");
    this.toastService.success("İşlem başarıyla tamamlandı.");
    this.toastService.warning("Dikkatli olun!");
  }

  render() {
    return (
      <>
        <AlertToastContainer messageTimeout={5000}></AlertToastContainer>
        <WebDialog
          padding={this.padding}
          position={this.position}
          show={this.showDialog}
          title={this.staticText}
          onClose={() => this.showDialog.set(false)}
        >
          <div style={{ width: "300px" }}>
            <Pagination selectedPage={this.selectedPage}>
              {[1, 2, 3, 4, 5].map((page) => {
                return {
                  name: `${page}`,
                  children: (
                    <>
                      {`Bu sayfa ${page}.`}
                      <Button
                        label="Sonraki"
                        onClick={() => this.selectedPage.set(`${page + 1}`)}
                      ></Button>
                    </>
                  ),
                };
              })}
            </Pagination>
          </div>
          <div className="mt-2 flex flex-row gap-2 justify-center flex-wrap w-100">
            <Button
              icon={materialSymbolsOutlined("edit")}
              label="Başlık değiştir"
              variant="filled-primary"
              onClick={() =>
                this.staticText.set(
                  prompt("Yeni başlık:")?.trim() || "Metinsiz",
                )
              }
            ></Button>
            <Button
              label="Diyalog kapat"
              variant="ghost"
              onClick={() => this.showDialog.set(false)}
            ></Button>
            <Button
              label="Padding aç/kapa"
              variant="outline-primary"
              onClick={() => this.padding.update((v) => !v)}
            ></Button>
            <Button
              label="Merkez"
              variant="outline-primary"
              onClick={() => this.position.set("center")}
            ></Button>
            <Button
              label="Sağa bitişik"
              variant="outline-primary"
              onClick={() => this.position.set("right")}
            ></Button>
          </div>
        </WebDialog>
        <div>
          <h1>Admin sayfasına hoş geldiniz!</h1>
          <Button
            label="Diyalog göster"
            variant="outline-primary"
            onClick={() => this.showDialog.set(true)}
          ></Button>
          <Button
            label="Toast göster"
            variant="outline-primary"
            onClick={() => this.showToasts()}
          ></Button>

          <Checkbox label="Şartları kabul ediyorum" checked={state(false)} />
          <ToggleSwitch
            label="Bildirimleri aç"
            checked={state(false)}
            onChange={(v: boolean) => console.log(v)}
          />
        </div>
      </>
    );
  }
}
