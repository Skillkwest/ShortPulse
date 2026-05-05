/**
 * Project naming modal.
 * Collects the initial dashboard project title before server-authoritative creation.
 */
import { useEffect, useId, useRef, type FormEvent } from "react";
import { useGuardedBackdropDismiss } from "../../../components/useGuardedBackdropDismiss";

type ProjectNameModalProps = {
  value: string;
  isCreating: boolean;
  error: string | null;
  onChange: (value: string) => void;
  onCancel: () => void;
  onSubmit: () => void;
};

/**
 * Renders the blocking project-name form used by dashboard New Project.
 */
export function ProjectNameModal({
  value,
  isCreating,
  error,
  onChange,
  onCancel,
  onSubmit,
}: ProjectNameModalProps) {
  const titleId = useId();
  const inputId = useId();
  const inputRef = useRef<HTMLInputElement | null>(null);
  const trimmedValue = value.trim();
  const submitDisabled = isCreating || trimmedValue.length === 0;
  const backdropDismiss = useGuardedBackdropDismiss<HTMLDivElement>(
    () => {
      if (!isCreating) {
        onCancel();
      }
    },
    { disabled: isCreating }
  );

  useEffect(() => {
    inputRef.current?.focus();
    inputRef.current?.select();
  }, []);

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!submitDisabled) {
      onSubmit();
    }
  };

  return (
    <div
      {...backdropDismiss}
      className="confirm-modal-backdrop"
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
    >
      <form
        className="confirm-modal confirm-modal--primary project-name-modal"
        onClick={(event) => event.stopPropagation()}
        onSubmit={handleSubmit}
      >
        <div className="confirm-modal__copy">
          <h3 id={titleId} className="confirm-modal__title">
            Name project
          </h3>
          <label className="project-name-modal__field" htmlFor={inputId}>
            <span>Project name</span>
            <input
              ref={inputRef}
              id={inputId}
              className="project-name-modal__input"
              type="text"
              value={value}
              maxLength={120}
              onChange={(event) => onChange(event.target.value)}
              disabled={isCreating}
            />
          </label>
          {error ? (
            <p className="project-name-modal__error" role="alert">
              {error}
            </p>
          ) : null}
        </div>
        <div className="confirm-modal__actions">
          <button
            type="button"
            className="confirm-modal__button confirm-modal__button--cancel"
            onClick={onCancel}
            disabled={isCreating}
          >
            Cancel
          </button>
          <button
            type="submit"
            className="confirm-modal__button confirm-modal__button--primary"
            disabled={submitDisabled}
          >
            {isCreating ? "Creating..." : "Create"}
          </button>
        </div>
      </form>
    </div>
  );
}
