import { NeolitComponent, state, type State } from "@ubs-platform/neolit/core";
import { fromState } from "@ubs-platform/neolit/structural";
import { WebDialog } from "@libs/ui/webdialog";
import { tr } from "@libs/ui/i18n";
import type {
  IRecentFileEntry,
  IRecentFilesProvider,
} from "../app-native-controller";

export interface RecentFilesDialogProps {
  show: State<boolean>;
  provider: IRecentFilesProvider;
  onOpenFile: (id: string) => void;
}

/** Son dosyalari onizlemeleriyle birlikte gosteren tam ekran gecmis sayfasi. */
export class RecentFilesDialog extends NeolitComponent<RecentFilesDialogProps> {
  properties: RecentFilesDialogProps = {
    show: state(false),
    provider: undefined as any,
    onOpenFile: () => {},
  };

  // id -> object URL. Sadece dialog acikken dolu tutulur, kapaninca revoke edilir.
  private thumbnailUrls = state<Record<string, string>>({});
  private loadToken = 0;

  onInit(): void {
    this.properties.show.subscribe((show) => {
      if (show) {
        void this.loadThumbnails();
      } else {
        this.releaseThumbnails();
      }
    });
    this.properties.provider.list.subscribe(() => {
      if (this.properties.show.get()) {
        void this.loadThumbnails();
      }
    });
  }

  onDestroy(): void {
    this.releaseThumbnails();
  }

  private async loadThumbnails(): Promise<void> {
    const token = ++this.loadToken;
    const entries = this.properties.provider.list.get();
    const current = this.thumbnailUrls.get();
    const next: Record<string, string> = {};
    for (const entry of entries) {
      if (current[entry.id]) {
        next[entry.id] = current[entry.id];
        continue;
      }
      const blob = await this.properties.provider.getThumbnail(entry.id);
      if (token !== this.loadToken) {
        return;
      }
      if (blob) {
        next[entry.id] = URL.createObjectURL(blob);
      }
    }
    // Listeden dusenlerin URL'lerini birak.
    for (const [id, url] of Object.entries(current)) {
      if (!next[id]) URL.revokeObjectURL(url);
    }
    this.thumbnailUrls.set(next);
  }

  private releaseThumbnails(): void {
    this.loadToken++;
    for (const url of Object.values(this.thumbnailUrls.get())) {
      URL.revokeObjectURL(url);
    }
    this.thumbnailUrls.set({});
  }

  private close(): void {
    this.properties.show.set(false);
  }

  private openFile(id: string): void {
    this.close();
    this.properties.onOpenFile(id);
  }

  private removeFile(event: Event, id: string): void {
    event.stopPropagation();
    void this.properties.provider.remove(id);
  }

  private formatDate(savedAt?: number): string {
    return savedAt ? new Date(savedAt).toLocaleString() : "";
  }

  private renderCard(entry: IRecentFileEntry) {
    const thumbnailUrl = this.thumbnailUrls.map((urls) => urls[entry.id] ?? "");
    const hasThumbnail = thumbnailUrl.map((url) => !!url);
    return (
      <div
        role="button"
        tabIndex={0}
        className="relative flex flex-col overflow-hidden rounded-md border border-(--color-surface-3) bg-(--color-surface-2) cursor-pointer hover:border-(--color-primary-bg)"
        onClick={() => this.openFile(entry.id)}
      >
        <div className="flex aspect-[4/3] items-center overflow-hidden justify-center bg-white">
          {fromState(hasThumbnail)
            .renderIf(() => (
              <img
                src={thumbnailUrl}
                alt={entry.fileName}
                className="h-full w-full object-cover"
                draggable={false}
              />
            ))
            .else(() => (
              <i
                className="material-symbols-outlined text-gray-400"
                style="font-size: 40px;"
              >
                draw
              </i>
            ))}
        </div>
        <div className="flex flex-col gap-0.5 p-2 pr-9 text-sm">
          <span className="truncate font-medium">{entry.fileName}</span>
          <span className="truncate text-xs opacity-70">
            {this.formatDate(entry.savedAt)}
          </span>
        </div>
        <button
          type="button"
          className="absolute bottom-1.5 right-1 rounded-sm bg-transparent p-1 text-(--color-primary-text) hover:bg-(--color-primary-bg-hover)"
          title={tr("xdraw.recent.remove")}
          onClick={(event: Event) => this.removeFile(event, entry.id)}
        >
          <i
            className="material-symbols-outlined"
            style="line-height: 20px; font-size: 20px;"
          >
            delete
          </i>
        </button>
      </div>
    );
  }

  render() {
    const list = this.properties.provider.list;
    const isEmpty = list.map((items) => items.length === 0);
    return (
      <WebDialog
        show={this.properties.show}
        mode="modal"
        position="center"
        width="100dvw"
        height="100dvh"
        maxHeight="100dvh"
        title={tr("xdraw.recent.title")}
        onClose={() => this.close()}
      >
        {[
          <div className="flex flex-col gap-3">
            {fromState(isEmpty).renderIf(() => (
              <p className="py-8 text-center opacity-70">
                {tr("xdraw.recent.empty")}
              </p>
            ))}
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
              {fromState(list)
                .keyFn((entry) => entry.id)
                .renderFor((entry) => this.renderCard(entry))}
            </div>
          </div>,
        ]}
      </WebDialog>
    );
  }
}
