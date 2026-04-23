import { NeolitComponent, state, type StateOrPlain, type NeolitNode } from "@ubs-platform/neolit/core"
import { fromState } from "@ubs-platform/neolit/structural";
import styles from "./touch.module.scss";

export interface PaginationPage {
  children: NeolitNode | (() => NeolitComponent)
  name: string
}

export interface PaginationProperties {
  children: StateOrPlain<PaginationPage[]>
}

interface PaginationSlot {
  id: 'prev' | 'current' | 'next'
  page: PaginationPage | null
}


export class Pagination extends NeolitComponent<PaginationProperties> {
  properties = {
    children: state<PaginationPage[]>([]),
  }

  private scrollHost: HTMLElement | null = null;
  private scrollSettleTimer: number | null = null;
  private currentIndex = 0;

  foreground = state('');
  previousPages = state<string[]>([]);
  slots = state<PaginationSlot[]>([]);

  onInit() {
    const pages = this.getPages();
    if (!pages.length) return;

    const currentName = this.foreground.get();
    const foundIndex = currentName ? pages.findIndex((a) => a.name === currentName) : -1;
    this.currentIndex = foundIndex > -1 ? foundIndex : 0;
    this.foreground.set(pages[this.currentIndex].name);
    this.slots.set(this.createSlots(this.currentIndex));
  }

  selectHoldAndClear(t: string) {
    const pages = this.getPages();
    const selectedIndex = pages.findIndex((a) => a.name === t);
    if (selectedIndex < 0) return;

    this.foreground.set(t);
    this.previousPages.set([]);
    this.currentIndex = selectedIndex;
    this.slots.set(this.createSlots(selectedIndex));
    window.setTimeout(() => this.resetToCenter(), 0);
  }

  select(t: string) {
    const pages = this.getPages();
    const targetIndex = pages.findIndex((a) => a.name === t);
    if (targetIndex < 0) {
      return;
    }

    if (targetIndex === this.currentIndex) {
      return;
    }

    if (!this.scrollHost || Math.abs(targetIndex - this.currentIndex) > 1) {
      this.applyDirectSelection(targetIndex);
      return;
    }

    const width = this.scrollHost.clientWidth || 1;
    this.scrollHost.scrollTo({
      left: targetIndex > this.currentIndex ? width * 2 : 0,
      behavior: 'smooth',
    });
  }

  private getPages() {
    return this.properties.children.get() || [];
  }

  private createSlots(index: number): PaginationSlot[] {
    const pages = this.getPages();
    return [
      { id: 'prev', page: pages[index - 1] ?? null },
      { id: 'current', page: pages[index] ?? null },
      { id: 'next', page: pages[index + 1] ?? null },
    ];
  }

  private resetToCenter() {
    if (!this.scrollHost) return;
    const width = this.scrollHost.clientWidth || 1;
    this.scrollHost.scrollTo({ left: width, behavior: 'auto' });
  }

  private applyDirectSelection(targetIndex: number) {
    const pages = this.getPages();
    const oldIndex = this.currentIndex;
    const oldName = pages[oldIndex]?.name;
    const targetName = pages[targetIndex]?.name;
    if (!targetName) return;

    if (targetIndex > oldIndex) {
      if (oldName) {
        this.previousPages.update((a) => [...a, oldName]);
      }
    } else {
      this.previousPages.update((a) => {
        if (a[a.length - 1] === targetName) {
          return a.slice(0, -1);
        }
        return a;
      });
    }

    this.currentIndex = targetIndex;
    this.foreground.set(targetName);
    this.slots.set(this.createSlots(targetIndex));
    window.setTimeout(() => this.resetToCenter(), 0);
  }

  private bindScrollHost(e: Event) {
    const currentTarget = e.currentTarget as HTMLElement | null;
    if (!currentTarget) {
      return;
    }

    if (this.scrollHost !== currentTarget) {
      this.scrollHost = currentTarget;
      this.resetToCenter();
    }
  }

  onTouchStartHost(e: TouchEvent) {
    this.bindScrollHost(e);
  }

  onMouseDownHost(e: MouseEvent) {
    this.bindScrollHost(e);
  }

  onScrollHost(e: Event) {
    this.bindScrollHost(e);

    if (!this.scrollHost) return;
    if (this.scrollSettleTimer !== null) {
      window.clearTimeout(this.scrollSettleTimer);
    }

    this.scrollSettleTimer = window.setTimeout(() => {
      this.commitByScrollPosition();
      this.scrollSettleTimer = null;
    }, 90);
  }

  private commitByScrollPosition() {
    if (!this.scrollHost) return;

    const width = this.scrollHost.clientWidth || 1;
    const slotIndex = Math.round(this.scrollHost.scrollLeft / width);

    if (slotIndex === 2) {
      this.commitDirection('forward');
    } else if (slotIndex === 0) {
      this.commitDirection('backward');
    }
  }

  private commitDirection(direction: 'forward' | 'backward') {
    const pages = this.getPages();
    if (!pages.length) return;

    const targetIndex = direction === 'forward' ? this.currentIndex + 1 : this.currentIndex - 1;
    if (targetIndex < 0 || targetIndex >= pages.length) {
      this.resetToCenter();
      return;
    }

    const oldName = pages[this.currentIndex]?.name;
    const targetName = pages[targetIndex]?.name;
    if (!targetName) {
      this.resetToCenter();
      return;
    }

    if (direction === 'forward') {
      if (oldName) {
        this.previousPages.update((a) => [...a, oldName]);
      }
    } else {
      this.previousPages.update((a) => {
        if (a[a.length - 1] === targetName) {
          return a.slice(0, -1);
        }
        return a;
      });
    }

    this.currentIndex = targetIndex;
    this.foreground.set(targetName);
    this.slots.set(this.createSlots(targetIndex));
    window.setTimeout(() => this.resetToCenter(), 0);
  }

  onWheelHost(e: WheelEvent) {
    this.bindScrollHost(e);

    if (!this.scrollHost) {
      return;
    }
    const threshold = 10;
    if (Math.abs(e.deltaY) > Math.abs(e.deltaX) && Math.abs(e.deltaY) > threshold) {
      this.scrollHost.scrollBy({ left: e.deltaY, behavior: 'smooth' });
      e.preventDefault();
    }
  }

  back() {
    const previous = this.previousPages.get();
    const previousPageName = previous[previous.length - 1];
    if (!previousPageName) {
      return;
    }
    this.select(previousPageName);
  }

  render() {
    return (
      <div
        class={styles.touchHostPagination}
        style={{ 'height': '400px', 'width': '400px' }}
        onTouchStart={(e: TouchEvent) => this.onTouchStartHost(e)}
        onMouseDown={(e: MouseEvent) => this.onMouseDownHost(e)}
        onScroll={(e: Event) => this.onScrollHost(e)}
        onWheel={(e: WheelEvent) => this.onWheelHost(e)}
      >
        {fromState(this.slots).keyFn(a => a.id).renderFor(slot => {
          return <div class={styles.card}>
            {slot.page ? (typeof slot.page.children == 'function' ? slot.page.children() : slot.page.children) : null}
          </div>
        })}
      </div>
    )
  }
}