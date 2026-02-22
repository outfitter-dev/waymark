// tldr ::: thin Result-returning wrappers around @clack/prompts (replaces @outfitter/cli/prompt)

import {
  confirm as clackConfirm,
  select as clackSelect,
  text as clackText,
  isCancel,
  type Option,
} from "@clack/prompts";
import { Err, Ok } from "better-result";

// note ::: @outfitter/cli/prompt was removed in 0.5.2; these wrappers preserve the Result API

type PromptSelectOptions<T> = {
  message: string;
  options: Option<T>[];
  initialValue?: T;
};

type PromptConfirmOptions = {
  message: string;
  initialValue?: boolean;
};

type PromptTextOptions = {
  message: string;
  defaultValue?: string;
  initialValue?: string;
  placeholder?: string;
};

type PromptCancelledError = Error & { readonly _cancelled: true };

function promptCancelledError(): PromptCancelledError {
  const e = new Error("Prompt cancelled") as PromptCancelledError;
  (e as { _cancelled: boolean })._cancelled = true;
  return e;
}

/**
 * Prompt the user to select a value from a list.
 * Returns Err when the user cancels.
 * @param opts - Select prompt options.
 */
export async function promptSelect<T>(
  opts: PromptSelectOptions<T>
): Promise<Ok<T, PromptCancelledError> | Err<T, PromptCancelledError>> {
  const result = await clackSelect<T>({
    message: opts.message,
    options: opts.options,
    ...(opts.initialValue !== undefined
      ? { initialValue: opts.initialValue }
      : {}),
  });
  if (isCancel(result)) {
    return new Err(promptCancelledError());
  }
  return new Ok(result as T);
}

/**
 * Prompt the user for a boolean confirmation.
 * Returns Err when the user cancels.
 * @param opts - Confirm prompt options.
 */
export async function promptConfirm(
  opts: PromptConfirmOptions
): Promise<
  Ok<boolean, PromptCancelledError> | Err<boolean, PromptCancelledError>
> {
  const result = await clackConfirm({
    message: opts.message,
    ...(opts.initialValue !== undefined
      ? { initialValue: opts.initialValue }
      : {}),
  });
  if (isCancel(result)) {
    return new Err(promptCancelledError());
  }
  return new Ok(result);
}

/**
 * Prompt the user for free-form text input.
 * Returns Err when the user cancels.
 * @param opts - Text prompt options.
 */
export async function promptText(
  opts: PromptTextOptions
): Promise<
  Ok<string, PromptCancelledError> | Err<string, PromptCancelledError>
> {
  const result = await clackText({
    message: opts.message,
    ...(opts.defaultValue !== undefined
      ? { defaultValue: opts.defaultValue }
      : {}),
    ...(opts.initialValue !== undefined
      ? { initialValue: opts.initialValue }
      : {}),
    ...(opts.placeholder !== undefined
      ? { placeholder: opts.placeholder }
      : {}),
  });
  if (isCancel(result)) {
    return new Err(promptCancelledError());
  }
  return new Ok(result);
}
