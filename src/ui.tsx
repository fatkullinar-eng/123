import {
  useEffect,
  useId,
  useRef,
  type ButtonHTMLAttributes,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
} from "react";
import { X, LoaderCircle } from "lucide-react";

export function Button({
  children,
  intent = "neutral",
  emphasis = "outline",
  busy,
  className = "",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  intent?: "brand" | "neutral" | "danger";
  emphasis?: "solid" | "outline" | "ghost";
  busy?: boolean;
}) {
  return (
    <button
      type="button"
      className={`button ${intent} ${emphasis} ${className}`}
      aria-busy={busy || undefined}
      data-autofocus={props.autoFocus || undefined}
      {...props}
      disabled={props.disabled || busy}
    >
      {busy && <LoaderCircle className="spin" size={16} aria-hidden="true" />}
      {children}
    </button>
  );
}
export function Field({
  label,
  suffix,
  error,
  hint,
  ...props
}: InputHTMLAttributes<HTMLInputElement> & {
  label: string;
  suffix?: string;
  error?: string;
  hint?: string;
}) {
  const generated = useId();
  const id = props.id || generated;
  return (
    <div className={`field ${error ? "invalid" : ""}`}>
      <label htmlFor={id}>{label}</label>
      <div className="input-wrap">
        <input
          {...props}
          id={id}
          aria-invalid={Boolean(error)}
          aria-describedby={error || hint ? `${id}-help` : undefined}
        />
        {suffix && <span>{suffix}</span>}
      </div>
      {(error || hint) && (
        <small id={`${id}-help`} className={error ? "error-text" : "hint"}>
          {error || hint}
        </small>
      )}
    </div>
  );
}
export function Select({
  label,
  children,
  ...props
}: SelectHTMLAttributes<HTMLSelectElement> & { label: string }) {
  const id = useId();
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      <select {...props} id={id}>
        {children}
      </select>
    </div>
  );
}
export function Modal({
  title,
  children,
  onClose,
  wide = false,
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
  wide?: boolean;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const node = dialog.current;
    node?.showModal();
    node?.querySelector<HTMLElement>("[data-autofocus]")?.focus();
    return () => {
      node?.close();
      previous?.focus();
    };
  }, []);
  return (
    <dialog
      ref={dialog}
      className={`modal ${wide ? "wide" : ""}`}
      aria-labelledby={titleId}
      onCancel={(event) => {
        event.preventDefault();
        closeRef.current();
      }}
    >
      <header>
        <h2 id={titleId}>{title}</h2>
        <Button emphasis="ghost" aria-label="Закрыть окно" onClick={onClose}>
          <X size={20} />
        </Button>
      </header>
      <div className="modal-body">{children}</div>
    </dialog>
  );
}
