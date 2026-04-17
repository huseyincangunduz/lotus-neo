import { NeolitComponent } from "@ubs-platform/neolit/core";
import { KeltosKel } from "@libs/ui/keltos-kel";
export class AppComponent extends NeolitComponent {
  render() {
    return (
      <>
        <div>
          <h1>Admin sayfasına hoş geldiniz!</h1>
          <KeltosKel />
        </div>
      </>
    );
  }
}
