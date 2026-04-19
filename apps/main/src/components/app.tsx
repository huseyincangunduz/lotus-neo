import { NeolitComponent, state } from "@ubs-platform/neolit/core";
import { Button } from "@libs/ui/button";
import { KeltosKel } from "@libs/keltos-kel";


export class AppComponent extends NeolitComponent {
  readonly name = state("Hüsniye");
  render() {
    return (
      <>
        <div>
          <h1>Normal kullanıcı sayfasına hoş geldin, {this.name}!</h1>
          <Button label="Tıkla!" onClick={() => 
            {
              const newName = prompt("Yeni ismini gir:");
              if (newName) {
                this.name.set(newName);
              }
            }
          } />
          <KeltosKel />
        </div>
      </>
    );
  }
}
