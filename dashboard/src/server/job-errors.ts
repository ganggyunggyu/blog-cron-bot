export class InvalidJobInputError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InvalidJobInputError';
  }
}

export class JobConflictError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'JobConflictError';
  }
}
