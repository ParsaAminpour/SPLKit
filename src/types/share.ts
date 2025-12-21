export type Result<T = void> = 
    | { ok: true; value: T }
    | { ok: false; error: string };

export const Ok = <T = void>(value?: T): Result<T> => ({ ok: true, value: value as T });
export const Err = <T = void>(error: string): Result<T> => ({ ok: false, error });