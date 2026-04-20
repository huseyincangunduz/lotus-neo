import { NeolitComponent, state } from "@ubs-platform/neolit/core";
import { Button } from "@libs/ui/button";
import { KeltosKel } from "@libs/keltos-kel";
import "@libs/ui/webdialog"
import styles from "./app.module.scss";
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
        <WebDialog show={this.showDialog} title={this.staticText} onClose={() => this.showDialog.set(false)}>
          <KeltosKel />
          <Button label="Change title" onClick={() => this.staticText.set("New Title")}></Button>
        </WebDialog>
        <div className={styles.app}>
          <h1>Admin sayfasına hoş geldiniz!</h1>
          <Button label="asdasd" onClick={() => this.showDialog.set(true)}></Button>
        </div>
      </>
    );
  }
}
