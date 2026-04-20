import { NeolitComponent, state } from "@ubs-platform/neolit/core";
import { Button } from "@libs/ui/button";
import { KeltosKel } from "@libs/keltos-kel";
import "@libs/ui/webdialog"
import { WebDialog } from "@libs/ui/webdialog";

export class AppComponent extends NeolitComponent {
  showDialog = state(false);
  staticText = state("Hello, World!");

  constructor() {
    super();

    // setInterval(() => {
    //   this.showDialog.set(!this.showDialog.get());
    // }, 1000);
  }

  render() {
    return (
      <>
        <WebDialog position={"right"} show={this.showDialog} title={this.staticText} onClose={() => this.showDialog.set(false)}>
          <KeltosKel />
          {/* Monolit yazmışım :d kendim bile ismini karıştırıyorsam artık sşdlfksd */}
          <Button label="Change title" variant="primary" visual="ghost" onClick={() => this.staticText.set("Neolit'ten selamlar")}></Button>
        </WebDialog>
        <div >
          <h1>Admin sayfasına hoş geldiniz!</h1>
          <Button label="Diyalog göster" variant="primary" visual="filled" onClick={() => this.showDialog.set(true)}></Button>
        </div>
      </>
    );
  }
}
