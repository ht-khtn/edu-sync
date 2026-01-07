export type ActionState = {
  error?: string | null;
  success?: string | null;
  data?: Record<string, unknown> | null;
};

export type FormAction<TState> = (prevState: TState, formData: FormData) => Promise<TState>;
