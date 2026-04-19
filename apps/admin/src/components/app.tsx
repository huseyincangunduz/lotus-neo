import { NeolitComponent } from "@ubs-platform/neolit/core";
import { Button } from "@libs/ui/button";
import { KeltosKel } from "@libs/keltos-kel";
import styles from "./app.module.scss";

export class AppComponent extends NeolitComponent {
  render() {
    return (
      <>
        <div className={styles.app}>
          <h1>Admin sayfasına hoş geldiniz!</h1>
          <Button label="asdasd"></Button>
          <KeltosKel />
        </div>
      </>
    );
  }
}
