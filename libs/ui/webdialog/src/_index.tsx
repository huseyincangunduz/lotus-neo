// import { NeolitComponent, type NeolitNode } from "@ubs-platform/neolit/core";

// export interface ButtonProps {
//     label: string;
//     onClick?: () => void;
// }

// export class Button extends NeolitComponent {
//     label: string;
//     onClick?: () => void;

//     /**
//      *
//      */
//     constructor({label, onClick}: ButtonProps) {
//         super();
//         this.label = label;
//         this.onClick = onClick;
//     }
//     render(): NeolitNode | NeolitNode[] | NeolitComponent | null {
//         return <button onClick={this.onClick}>{this.label}</button>
//     }
// }
// import { FrontGlobalButtonModule } from '@lotus/front-global/button';
// import {
//   Component,
//   ComponentFactoryResolver,
//   ComponentRef,
//   computed,
//   ElementRef,
//   EventEmitter,
//   input,
//   Input,
//   model,
//   OnChanges,
//   OnDestroy,
//   output,
//   Output,
//   signal,
//   SimpleChanges,
//   TemplateRef,
//   viewChild,
//   ViewChild,
//   ViewContainerRef,
// } from '@angular/core';
// import { CommonModule } from '@angular/common';
// import { OnLoadDirective } from '@lotus/front-global/ui-element-utils';
// import {
//   DialogVisibilityReference,
//   generateMobileOptimizedDialogHideController,
// } from '../util/mod-util';
// import { DocumentSwipeListener } from '@lotus/front-global/mobile-gestures-util';
// import { Subscription } from 'rxjs';
// import { TranslatorText } from '@ubs-platform/translator-core';
// import { UbsTranslatorNgxModule } from '@ubs-platform/translator-ngx';
// // export interface WebDialogConfig<INPUT> {
// //   data: INPUT;
// //   position?: 'center' | 'right' | 'left' | 'bottom';
// // }

// @Component({
//   selector: 'lib-webdialog',
//   imports: [
//     CommonModule,
//     FrontGlobalButtonModule,
//     OnLoadDirective,
//     UbsTranslatorNgxModule,
//   ],
//   templateUrl: './webdialog.component.html',
//   styleUrl: './webdialog.component.scss',
//   standalone: true,
// })
// export class WebdialogComponent implements OnChanges, OnDestroy {
//  show = model(false);
//   padding = model(true);
//   showChange = output<boolean>();
//   animationState = signal<'HIDE' | 'BEGIN' | 'HOLD' | 'OUT'>('HIDE');
//   viewStateBool = computed(
//     () => this.animationState() == 'BEGIN' || this.animationState() == 'HOLD'
//   );
//   animationDuration = signal(125);
//   animationDelay = signal(10);
//   animationDurationMs = computed(() => this.animationDuration() + 'ms');
//   animationDelayMs = computed(() => this.animationDelay() + 'ms');
//   animationAfterApply = computed(() => this.animationDuration() + 5);

//   dialog = viewChild<ElementRef<HTMLDivElement>>('dialog');
//   contentTemplate = viewChild<TemplateRef<HTMLDivElement>>('contentTemplate');
//   contentComponentRef?: ComponentRef<any>;
//   // componentInstance
//   position = model('center');
//   title = model<TranslatorText>('');
//   displayHeader = model(true);
//   displayCloseButton = model(true);
//   maxWidth = model('100dvw');
//   maxHeight = model('100dvh');
//   width = model('500px');
//   height = model('');
//   swipeTrigger = model<'RIGHT_TO_LEFT' | 'LEFT_TO_RIGHT' | ''>('');
//   suspendSwipe = model(false);
//   swipeFloor = model(1);
//   dissmissOnClickMask = model(true);
//   beginTimeout?: any;
//   dialogMobileRef?: DialogVisibilityReference<any>;
//   instantSwipeListenerSubscription?: Subscription;

//   constructor(private swipeListener: DocumentSwipeListener) { }

//   maskClick($event: MouseEvent) {
//     if (this.dissmissOnClickMask() && $event.target == $event.currentTarget) {
//       this.closeDialogByReference();
//     }
//   }

//   ngOnDestroy(): void {
//     this.closeDialogByReference();
//     this.instantSwipeListenerSubscription?.unsubscribe();
//   }

//   ngOnChanges(changes: SimpleChanges): void {
//     if (changes['show']) {
//       if (this.show()) {
//         // this.showDialog();
//         this.showDialogByReference();
//       } else {
//         this.closeDialogByReference();
//         // this.close();
//         // t this.dialogMobileRef?.closeMainAction(null, true);
//       }
//     }
//   }

//   ngAfterViewInit(): void {
//     if (this.swipeTrigger()) {
//       this.instantSwipeListenerSubscription = this.swipeListener
//         .instantSwipeListener()
//         .subscribe((a) => {
//           if (!this.suspendSwipe()) {
//             const swipeTrigger = this.swipeTrigger();
//             if (swipeTrigger == 'RIGHT_TO_LEFT') {
//               if (this.swipeListener.getLot() == 1 && a == 'LEFT_TO_RIGHT') {
//                 this.closeDialogByReference();
//               } else if (
//                 this.swipeListener.getLot() == 0 &&
//                 a == 'RIGHT_TO_LEFT'
//               ) {
//                 this.showDialogByReference(true);
//               }
//             } else if (swipeTrigger == 'LEFT_TO_RIGHT') {
//               if (this.swipeListener.getLot() == -1 && a == 'RIGHT_TO_LEFT') {
//                 this.closeDialogByReference();
//               } else if (
//                 this.swipeListener.getLot() == 0 &&
//                 a == 'LEFT_TO_RIGHT'
//               ) {
//                 // this.showMenu();
//                 this.showDialogByReference(true);
//               }
//             }
//           }
//         });
//     }
//   }

//   componentExtract(targetParent: any) {
//     const child = this.contentComponentRef!.location.nativeElement;
//     targetParent.appendChild(child);
//   }

//   showDialogByReference(emit = false) {
//     emit && this.showChange.emit(true);
//     this.dialogMobileRef = generateMobileOptimizedDialogHideController<void>(
//       () => {
//         this.close();
//         this.dialogMobileRef = undefined;
//       },
//       null
//     );
//     this.showDialog();
//     const swipeTrigger = this.swipeTrigger();
//     if (swipeTrigger == 'RIGHT_TO_LEFT') {
//       this.swipeListener.setLot(1);
//     } else if (swipeTrigger == 'LEFT_TO_RIGHT') {
//       this.swipeListener.setLot(-1);
//     }
//   }
//   closeDialogByReference() {
//     if (this.dialogMobileRef) {
//       this.dialogMobileRef.closeManually(false);
//     }
//   }

//   close(emitShowChange = true) {
//     if (this.viewStateBool()) {
//       if (this.swipeTrigger()) {
//         this.swipeListener.setLot(0);
//       }

//       emitShowChange && this.showChange.emit(false);

//       clearTimeout(this.beginTimeout);
//       this.animationState.set('OUT');
//       setTimeout(() => {
//         this.animationState.set('HIDE');
//       }, this.animationAfterApply());
//     }
//   }

//   showDialog() {
//     if (!this.viewStateBool()) {
//       this.animationState.set('BEGIN');
//       this.beginTimeout = setTimeout(() => {
//         this.animationState.set('HOLD');
//       }, this.animationAfterApply());
//     }
//   }
// }


{/* <div class="modal" [attr.animation-state]="animationState()" style="--duration: {{ animationDurationMs() }}; --animDelay: {{
    animationDelayMs()
  }}" (click)="maskClick($event)">
  <div class="dialog" [style.max-width]="maxWidth()" [style.width]="width()" [style.height]="height()"
    [style.max-height]="maxHeight()" [attr.animation-state]="animationState()" [attr.dialog-align]="position()" #dialog>
    <div class="header flex align-items-center justify-content-between" *ngIf="displayHeader()">
      <h2 class="my-1 w-full text-center">{{ title() | translate }}</h2>
      @if (displayCloseButton()) {
      <block-button *ngIf="displayCloseButton" iconClass="pi pi-times"
        (click)="closeDialogByReference()"></block-button>
      }

    </div>
    <div class="dialog-inner flex-grow-1 overflow-auto" [class.px-3]="padding()" [class.pb-3]="padding()">
      @if (contentComponentRef) {
      <div class="h-full w-full position-relative">
        <div class="h-full w-full position-relative" (on-load)="componentExtract($event)"></div>
      </div>
      } @else {
      <ng-content></ng-content>
      }

    </div>
  </div>
</div> */}

import { fromState } from "@ubs-platform/neolit/structural";
import { NeolitComponent, State, getStateValue, isState, state, type NeolitNode, type StateOrPlain } from "@ubs-platform/neolit/core";
import "./webdialog.module.scss";
export interface WebDialogProps {
    children: NeolitNode | NeolitNode[];
    title: StateOrPlain<string>;
    show: StateOrPlain<boolean>;
}

export class WebDialog extends NeolitComponent {
    show = state(false);
    title = state("");
    content: NeolitNode | NeolitNode[] = <></>;

    constructor({ children, title, show }: WebDialogProps) {
        super();
        this.content = children;
        this.title.set(title);
        this.show.set(show);
        // if (isState(title)) {
        //     this.title = title as State<string>;
        // } else {
        //     this.title.set(title as string);
        // }
        // if (isState(show)) {
        //     this.show = show as State<boolean>;
        // } else {
        //     this.show.set(show as boolean);
        // }
    }

    render() {

        return (
            <>
                {fromState(this.show).renderIf(() => {
                    return <div className="web-dialog">
                        <div className="web-dialog-header">
                            <h2>{this.title}</h2>
                            <button onClick={() => this.show.set(false)}>Close</button>
                        </div>
                        <div className="web-dialog-content">
                            {this.content}
                        </div>
                    </div>
                })}
            </>

        );
    }
}