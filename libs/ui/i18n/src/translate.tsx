import {
  computed,
  NeolitComponent,
  state,
  type NeolitNode,
  type StateOrPlain,
} from "@ubs-platform/neolit/core";
import { TranslationRepository } from "@ubs-platform/translator-core";
import { inject } from "@ubs-platform/neolit/injectables";
import type { Observable } from "rxjs";
export interface TranslateProperties {
  children: StateOrPlain<string>;
  params?: StateOrPlain<Record<string, string>>;
}

export class Translate extends NeolitComponent<TranslateProperties> {
  properties = {
    children: state<string>(""),
    params: state<Record<string, string>>({}),
  };
  private translation!: Observable<string>;
  readonly translationRepository = inject(TranslationRepository);
  readonly text = state<string>("");
  readonly computedAll = computed([this.properties.children, this.properties.params], ([key, params]) => {
    this.translation = this.translationRepository.getStringListenChanges({
      key,
      parameters: params,
    });

    this.translation.subscribe((a) => {
      this.text.set(a);
    });
  });

  render(): NeolitNode | NeolitNode[] | NeolitComponent | null {
    return <>{this.text}</>;
  }
}

// Translate kısaltılmış hali. Kullanımı: <Tr>home.hello</Tr>
export const Tr = Translate;