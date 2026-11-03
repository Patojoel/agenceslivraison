/** A required dependency (configuration, third party) is missing: the request may succeed later. */
export class ServiceUnavailableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ServiceUnavailableError';
  }
}
