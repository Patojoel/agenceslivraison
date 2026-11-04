import { multiLine } from './plain-text';

/** Plain text typed by the agency: kept as is, never interpreted. */
export class SuspensionReason {
  private constructor(readonly value: string) {}

  static of(raw: string): SuspensionReason {
    return new SuspensionReason(multiLine(raw, 'reason', 3, 500));
  }
}
