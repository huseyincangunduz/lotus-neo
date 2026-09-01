export interface SubscriptionLike {
  unsubscribe(): void;
}

export interface ObservableLike<T> {
  subscribe(callback: (value: T) => void): SubscriptionLike;
}

class ReplayValue<T> implements ObservableLike<T> {
  private subscribers = new Set<(value: T) => void>();

  constructor(private currentValue: T) {}

  get value(): T {
    return this.currentValue;
  }

  next(value: T): void {
    this.currentValue = value;
    for (const subscriber of this.subscribers) {
      subscriber(value);
    }
  }

  subscribe(callback: (value: T) => void): SubscriptionLike {
    this.subscribers.add(callback);
    callback(this.currentValue);

    return {
      unsubscribe: () => {
        this.subscribers.delete(callback);
      },
    };
  }
}

export interface Operation {
  revert(): Promise<void> | void;
  apply(): Promise<void> | void;
}

export class UndoRedoHelper {
  private maxHistorySize: number;
  private queue: Promise<void> = Promise.resolve();
  private pendingOperationCount = 0;
  private operationsHistory: Array<Operation> = [];
  private operationReverted: Array<Operation> = [];
  private _canRedoSubscription = new ReplayValue<boolean>(false);
  private _canUndoSubscription = new ReplayValue<boolean>(false);

  constructor(maxHistorySize: number = 25) {
    this.maxHistorySize = Math.max(1, Math.floor(maxHistorySize));
  }

  public setMaxHistorySize(maxHistorySize: number): void {
    this.maxHistorySize = Math.max(1, Math.floor(maxHistorySize));
    this.enforceHistoryLimit();
    this.updateAbilities();
  }

  // public app
  public pushOperationQueue(
    operation: Operation,
    clearRedoList: boolean,
    runApply = true
  ): Promise<void> {
    return this.enqueue(async () => {
      await this.insertOperation(operation, runApply, clearRedoList);
    });
  }

  public get canRedo(): ObservableLike<boolean> {
    return this._canRedoSubscription;
  }
  public get canUndo(): ObservableLike<boolean> {
    return this._canUndoSubscription;
  }

  public get busy(): boolean {
    return this.pendingOperationCount > 0;
  }

  updateAbilities(): void {
    this._canUndoSubscription.next(this.operationsHistory.length > 0);
    this._canRedoSubscription.next(this.operationReverted.length > 0);
  }

  private async insertOperation(
    operation: Operation,
    runApply: boolean,
    clearRedoList: boolean
  ): Promise<void> {
    if (runApply) {
      await operation.apply();
    }

    this.operationsHistory.push(operation);
    this.enforceHistoryLimit();

    if (clearRedoList) {
      this.operationReverted = [];
    }

    this.updateAbilities();
  }

  public undo(): Promise<void> {
    return this.enqueue(async () => {
      await this.undoPure();
    });
  }

  private async undoPure(): Promise<void> {
    if (this.operationsHistory.length > 0) {
      const operation = this.operationsHistory.pop();
      if (operation) {
        await operation.revert();

        this.operationReverted.push(operation);
        this.updateAbilities();
      }
    }
  }

  public redo(): Promise<void> {
    return this.enqueue(async () => {
      await this.redoPure();
    });
  }

  private async redoPure(): Promise<void> {
    if (this.operationReverted.length > 0) {
      const operation = this.operationReverted.pop();

      if (operation) {
        await operation.apply();
        this.operationsHistory.push(operation);
        this.enforceHistoryLimit();
        this.updateAbilities();
      }
    }
  }

  public reset(): Promise<void> {
    return this.enqueue(async () => {
      await this.resetPure();
    });
  }

  private async resetPure(): Promise<void> {
    this.operationsHistory = [];
    this.operationReverted = [];
    this.updateAbilities();
  }

  private enqueue(task: () => Promise<void>): Promise<void> {
    const execute = async () => {
      this.pendingOperationCount += 1;
      try {
        await task();
      } finally {
        this.pendingOperationCount -= 1;
      }
    };

    const queued = this.queue.then(execute);
    this.queue = queued.catch(() => {
      // Keep queue chain alive after a failed operation.
    });
    return queued;
  }

  private enforceHistoryLimit(): void {
    const overflow = this.operationsHistory.length - this.maxHistorySize;
    if (overflow > 0) {
      this.operationsHistory.splice(0, overflow);
    }
  }
}
