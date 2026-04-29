import {
  computed,
  NeolitComponent,
  state,
  type StateOrPlain,
  type NeolitNode,
} from "@ubs-platform/neolit/core";
import { fromState } from "@ubs-platform/neolit/structural";
import styles from "./touch.module.scss";
export type Rotation = "FORWARD" | "BACKWARD" | "HOLD";

export interface PaginationPage {
  children: NeolitNode | (() => NeolitComponent);
  name: string;
}

export interface PaginationProperties {
  children: StateOrPlain<PaginationPage[]>;
  selectedPage: StateOrPlain<string>;
}

export class Pagination extends NeolitComponent<PaginationProperties> {
  properties = {
    children: state<PaginationPage[]>([]),
    selectedPage: state(""),
  };

  foreground = state("");
  previousPages = state<string[]>([]);
  backButtonStates = state<(() => void)[]>([]);
  sentForward = state("");
  sentBack = state("");
  rotation = state<Rotation>("HOLD");
  xPercent = state(0);
  backGesture = state(false);
  startPos = state<{ x: number; y: number }>({ x: 0, y: 0 });
  diff = state<{ x: number; y: number }>({ x: 0, y: 0 });
  previousDiff = state<{ x: number; y: number }>({ x: 0, y: 0 });
  swipeLeftPage = state("");
  swipeRightPage = state("");
  delaySecond = state("0s");
  animationDurationSecond = state("0.22s");

  onInit() {
    if (this.properties.selectedPage.get()) {
      this.foreground.set(this.properties.selectedPage.get());
    }
    this.properties.selectedPage.subscribe((selectedPage) => {
      if (
        this.rotation.get() === "HOLD" &&
        selectedPage &&
        selectedPage != this.foreground.get() &&
        this.properties.children.get().find((c) => c.name == selectedPage)
      ) {
        this.selectInternal(selectedPage);
      }
    });
  }

  maxSeconds() {
    return 0.22;
  }

  backGestureThreshold() {
    return Math.min(Math.max(window.innerWidth * 0.22, 72), 160);
  }

  animationDurationMs() {
    return this.maxSeconds() * 1000;
  }

  cancelAnimationSeconds() {
    return 0.14;
  }

  gestureStartEdgeThreshold() {
    return 32;
  }

  setAnimationDuration(seconds: number) {
    this.animationDurationSecond.set(`${seconds}s`);
  }

  selectHoldAndClear(t: string) {
    // this.backButtonStates.get().forEach((a) => a.closeManually());

    this.foreground.set(t);
    this.previousPages.set([]);
    this.backButtonStates.set([]);
  }

  selectInternal(t: string, sendTo: Rotation = "FORWARD") {
    this.xPercent.set(0);
    this.setAnimationDuration(this.maxSeconds());
    const oldForeground = this.foreground.get();

    if (sendTo == "FORWARD") {
      this.sentForward.set(oldForeground);
      this.sentBack.set("");
      this.backButtonStates.update((a) => [...a]);
    } else {
      this.sentBack.set(oldForeground);
      this.sentForward.set("");
    }
    this.foreground.set(t);
    this.rotation.set(sendTo);
    if (!this.backGesture.get()) {
      setTimeout(() => {
        this.holdAndExitAnimationMode();
      }, this.animationDurationMs());
    }
  }

  private holdAndExitAnimationMode(shouldStoreForwardPage = true) {
    if (
      shouldStoreForwardPage &&
      this.sentForward.get() &&
      !this.previousPages.get().includes(this.sentForward.get())
    ) {
      this.previousPages.update((a) => [...a, this.sentForward.get()]);
    }
    this.sentForward.set("");
    this.sentBack.set("");
    this.rotation.set("HOLD");
    this.setDelay(0);
    // TODO: Callback when animation is done
    // this.pageChange.emit(this.foreground.get());
  }

  // gesture

  mouseDownGroup(e: TouchEvent) {
    const currentTarget = e.currentTarget as HTMLElement | null;

    if (this.previousPages.get().length && currentTarget === e.target) {
      console.debug("back gesture start");
      const previousPages = this.previousPages.get();
      const swipeLeftPage = previousPages[previousPages.length - 1];
      if (!swipeLeftPage) {
        return;
      }
      this.backGesture.set(true);
      this.setAnimationDuration(this.maxSeconds());
      this.startPos.set({ x: e.touches[0].clientX, y: e.touches[0].clientY });
      this.diff.set({ x: 0, y: 0 });
      this.previousDiff.set({ x: 0, y: 0 });
      this.swipeLeftPage.set(swipeLeftPage);
      this.swipeRightPage.set(this.foreground.get()!);
      this.xPercent.set(this.maxSeconds());
      this.setDelay(this.maxSeconds());
      // this.setSwipeRotation(false);
    }
  }

  private setSwipeRotation(showCurrentPage: boolean) {
    const rightPage = this.swipeRightPage.get();
    const leftPage = this.swipeLeftPage.get();
    if (!rightPage || !leftPage) {
      return;
    }
    if (showCurrentPage) {
      this.rotation.set("FORWARD");
      this.sentForward.set(leftPage);
      this.sentBack.set("");
      this.foreground.set(rightPage);
    } else {
      this.rotation.set("BACKWARD");
      this.sentBack.set(rightPage);
      this.sentForward.set("");
      this.foreground.set(leftPage);
    }
  }

  mouseUpGroup() {
    if (this.backGesture.get()) {
      const shouldCompleteBack =
        this.diff.get().x > this.backGestureThreshold();
      const animationSeconds = shouldCompleteBack
        ? this.maxSeconds()
        : this.cancelAnimationSeconds();
      this.backGesture.set(false);
      this.diff.set({ x: 0, y: 0 });
      this.previousDiff.set({ x: 0, y: 0 });
      this.startPos.set({ x: 0, y: 0 });
      this.setAnimationDuration(animationSeconds);

      if (shouldCompleteBack) {
        this.previousPages.update((pages) => pages.slice(0, -1));
        this.setSwipeRotation(false);
      } else {
        this.setSwipeRotation(true);
      }
      const selectedPage = shouldCompleteBack
        ? this.swipeLeftPage.get()
        : this.swipeRightPage.get();
      if (selectedPage) {
        this.properties.selectedPage.set(selectedPage);
      }
      setTimeout(() => {
        this.holdAndExitAnimationMode(!shouldCompleteBack);
        this.setAnimationDuration(this.maxSeconds());
      }, animationSeconds * 1000);
    }
  }

  back() {
    let bbs = this.backButtonStates.get();
    const newI = bbs.length - 1;
    this.backButtonStates.get();
    this.backButtonStates.update((a) => a.slice(0, newI));
    // backTo?.closeMainAction();
  }

  mouseMoveGroup(e: TouchEvent) {
    if (
      !this.startPos.get() ||
      (this.startPos.get().x == 0 && this.startPos.get().y == 0) ||
      !this.backGesture.get()
    ) {
      return;
    }
    const nextDiff = {
      x: e.touches[0].clientX - this.startPos.get().x,
      y: e.touches[0].clientY - this.startPos.get().y,
    };
    this.diff.set(nextDiff);

    const positiveDiffX = Math.max(nextDiff.x, 0);
    const maxDistance = Math.max(window.innerWidth - this.startPos.get().x, 1);
    const progress = Math.min(positiveDiffX / maxDistance, 1);
    const showCurrentPage = nextDiff.x <= 0;
    let now = progress * this.maxSeconds();
    if (showCurrentPage) {
      now = this.maxSeconds() - now;
    }
    this.setDelay(now);

    this.setSwipeRotation(showCurrentPage);
    console.debug(this.rotation);

    this.previousDiff.set(nextDiff);
    // if (this.previousDiff.get().x != this.diff.get().x)
    e.preventDefault();
  }

  setDelay(d: number) {
    if (!this.backGesture.get()) d = 0;
    this.xPercent.set(-d);
    this.delaySecond.set(-d + "s");
  }

  render() {
    return (
      <div
        class={styles.touchHostPagination}
        style={{ height: "400px", width: "400px" }}
      >
        {fromState(this.properties.children)
          .keyFn((a) => a.name)
          .renderFor((blockPage) => {
            return (
              <div
                onTouchStart={(e: TouchEvent) => this.mouseDownGroup(e)}
                onTouchEnd={() => this.mouseUpGroup()}
                onTouchMove={(e: TouchEvent) => this.mouseMoveGroup(e)}
                style={{
                  animationDelay: this.delaySecond,
                  animationDuration: this.animationDurationSecond,
                }}
                className={{
                  [`${styles.group}`]: true,
                  [`${styles.animPause}`]: this.backGesture,
                  [`${styles.sendLeft}`]: computed(
                    [this.sentBack],
                    ([sentBack]) => sentBack == blockPage.name,
                  ),
                  [`${styles.sendRight}`]: computed(
                    [this.sentForward, this.rotation],
                    ([sentForward, rotation]) =>
                      sentForward == blockPage.name && rotation == "FORWARD",
                  ),
                  [`${styles.bringItFromLeft}`]: computed(
                    [this.foreground, this.rotation],
                    ([foreground, rotation]) =>
                      foreground == blockPage.name && rotation == "BACKWARD",
                  ),
                  [`${styles.holdFront}`]: computed(
                    [this.foreground, this.rotation],
                    ([foreground, rotation]) =>
                      foreground == blockPage.name && rotation == "HOLD",
                  ),
                  [`${styles.bringItFromRight}`]: computed(
                    [this.foreground, this.rotation],
                    ([foreground, rotation]) =>
                      foreground == blockPage.name && rotation == "FORWARD",
                  ),
                  [`${styles.hidden}`]: computed(
                    [this.sentBack, this.sentForward, this.foreground],
                    ([sentBack, sentForward, foreground]) =>
                      !(
                        blockPage.name == sentBack ||
                        blockPage.name == sentForward ||
                        blockPage.name == foreground
                      ),
                  ),
                }}
              >
                {typeof blockPage.children == "function"
                  ? blockPage.children()
                  : blockPage.children}
              </div>
            );
          })}
      </div>
    );
  }
}
