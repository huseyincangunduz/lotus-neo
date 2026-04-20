import { NeolitComponent, state } from "@ubs-platform/neolit/core";
import { Button } from "@libs/ui/button";
import { KeltosKel } from "@libs/keltos-kel";
import "@libs/ui/webdialog"
import { WebDialog } from "@libs/ui/webdialog";

export class AppComponent extends NeolitComponent {
  showDialog = state(false);
  staticText = state("Hello, World!");
  padding = state(true);

  constructor() {
    super();

    // setInterval(() => {
    //   this.showDialog.set(!this.showDialog.get());
    // }, 1000);
  }

  render() {
    return (
      <>
        <WebDialog padding={this.padding} position={"right"} show={this.showDialog} title={this.staticText} onClose={() => this.showDialog.set(false)}>
          <KeltosKel />
          {/* Monolit yazmışım :d kendim bile ismini karıştırıyorsam artık sşdlfksd */}
          <div className="mt-2 flex flex-row gap-2 justify-center">
            <Button label="Başlık değiştir" variant="primary" visual="ghost" onClick={() => this.staticText.set(prompt("Yeni başlık:")?.trim() || "Metinsiz")}></Button>
            <Button label="Diyalog kapat" variant="secondary" visual="outline" onClick={() => this.showDialog.set(false)}></Button>
            <Button label="Padding aç/kapa" variant="secondary" visual="outline" onClick={() => this.padding.update(v => !v)}></Button>
          </div>
        </WebDialog>
        <div >
          <h1>Admin sayfasına hoş geldiniz!</h1>
          <Button label="Diyalog göster" variant="primary" visual="filled" onClick={() => this.showDialog.set(true)}></Button>
        </div>
      </>
    );
  }
}
