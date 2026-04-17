import { NeolitComponent } from "@ubs-platform/neolit/core";
import { Button } from "@libs/ui";
export class AppComponent extends NeolitComponent {
  render() {
    return (
      <>
        <div><h1>Normal kullanıcı sayfasına hoş geldiniz!</h1>
        <Button label="Tıkla!" onClick={() => alert("Butona tıklandı!")} />
        </div>
      </>
    );
  }
}
