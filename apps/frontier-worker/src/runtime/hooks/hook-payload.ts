export class HookPayload<T = unknown> {
  constructor(
    public readonly type: string,
    public readonly payload: T,
    public readonly metadata: Record<string, unknown> = {},
  ) {}

  withMetadata(newMetadata: Record<string, unknown>): HookPayload<T> {
    return new HookPayload(this.type, this.payload, { ...this.metadata, ...newMetadata });
  }

  toJSON(): { type: string; payload: T; metadata: Record<string, unknown> } {
    return {
      type: this.type,
      payload: this.payload,
      metadata: this.metadata,
    };
  }
}
