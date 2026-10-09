import { createContext, useCallback, useContext, useEffect, useId, useRef, useState } from "react";
import type { KeyboardEvent as ReactKeyboardEvent, ReactNode } from "react";
import { IconAlert, IconCheck, IconCheckCircle, IconChevronDown, IconEye, IconEyeOff, IconInfo, IconX } from "./icons";

export function Loading({ label = "جارٍ التحميل..." }: { label?: string }) {
  return (
    <div className="loading-block">
      <div className="spinner" />
      <span>{label}</span>
    </div>
  );
}

export function EmptyState({ icon, title, sub }: { icon?: ReactNode; title: string; sub?: string }) {
  return (
    <div className="empty">
      <div className="empty__ico">{icon ?? <IconInboxMark />}</div>
      <div className="bold">{title}</div>
      {sub ? <div className="small muted mt-1">{sub}</div> : null}
    </div>
  );
}

function IconInboxMark() {
  return (
    <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M3.6 13.4h4.2l1.5 3h5.4l1.5-3h4.2" />
      <path d="M6.2 4.6h11.6l3 8.8v6H3.2v-6z" />
    </svg>
  );
}

/** حقل كلمة مرور مع زر إظهار/إخفاء. */
export function PasswordInput({
  id,
  value,
  onChange,
  autoComplete,
  required = true,
  minLength,
  invalid,
  placeholder,
  dir = "ltr",
}: {
  id?: string;
  value: string;
  onChange: (value: string) => void;
  autoComplete?: string;
  required?: boolean;
  minLength?: number;
  invalid?: boolean;
  placeholder?: string;
  dir?: "ltr" | "rtl";
}) {
  const [show, setShow] = useState(false);
  return (
    <div className="pass-field">
      <input
        id={id}
        className="input"
        dir={dir}
        type={show ? "text" : "password"}
        autoComplete={autoComplete}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        required={required}
        minLength={minLength}
        placeholder={placeholder}
        aria-invalid={invalid || undefined}
      />
      <button
        type="button"
        className="pass-field__toggle"
        onClick={() => setShow((s) => !s)}
        aria-label={show ? "إخفاء كلمة المرور" : "إظهار كلمة المرور"}
        aria-pressed={show}
        tabIndex={-1}
      >
        {show ? <IconEyeOff size={17} /> : <IconEye size={17} />}
      </button>
    </div>
  );
}

/** قائمة منسدلة مخصصة: تتبع ألوان النظام بعكس قائمة المتصفح الأصلية. */
export interface SelectOption {
  value: string;
  label: string;
  hint?: string;
  disabled?: boolean;
}

export function Select({
  value,
  onChange,
  options,
  placeholder = "— اختر —",
  id,
  disabled,
  invalid,
  size = "md",
}: {
  value: string;
  onChange: (value: string) => void;
  options: readonly SelectOption[];
  placeholder?: string;
  id?: string;
  disabled?: boolean;
  invalid?: boolean;
  size?: "sm" | "md";
}) {
  const autoId = useId();
  const baseId = id ?? autoId;
  const [open, setOpen] = useState(false);
  const [cursor, setCursor] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  const selected = options.find((o) => o.value === value) ?? null;

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const i = options.findIndex((o) => o.value === value);
    setCursor(i < 0 ? 0 : i);
  }, [open, value, options]);

  useEffect(() => {
    if (!open) return;
    (listRef.current?.children[cursor] as HTMLElement | undefined)?.scrollIntoView({ block: "nearest" });
  }, [open, cursor]);

  const choose = (v: string) => {
    onChange(v);
    setOpen(false);
  };

  const move = (delta: number) =>
    setCursor((c) => {
      if (options.length === 0) return 0;
      let next = (c + delta + options.length) % options.length;
      for (let i = 0; i < options.length && options[next]?.disabled; i += 1) {
        next = (next + delta + options.length) % options.length;
      }
      return next;
    });

  const onKey = (e: ReactKeyboardEvent<HTMLButtonElement>) => {
    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        if (open) move(1);
        else setOpen(true);
        break;
      case "ArrowUp":
        e.preventDefault();
        if (open) move(-1);
        else setOpen(true);
        break;
      case "Home":
      case "End":
        if (open) {
          e.preventDefault();
          setCursor(e.key === "Home" ? 0 : options.length - 1);
        }
        break;
      case "Enter":
      case " ":
        e.preventDefault();
        if (open) {
          const opt = options[cursor];
          if (opt && !opt.disabled) choose(opt.value);
        } else {
          setOpen(true);
        }
        break;
      case "Escape":
        if (open) {
          e.preventDefault();
          setOpen(false);
        }
        break;
      case "Tab":
        setOpen(false);
        break;
      default:
        break;
    }
  };

  return (
    <div className={`selectx ${size === "sm" ? "selectx--sm" : ""}`} ref={rootRef}>
      <button
        type="button"
        id={baseId}
        className={`selectx__trigger ${open ? "is-open" : ""} ${invalid ? "is-invalid" : ""}`}
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        onKeyDown={onKey}
      >
        <span className={selected ? "selectx__value" : "selectx__placeholder"}>
          {selected ? selected.label : placeholder}
        </span>
        <IconChevronDown size={17} className="selectx__chev" />
      </button>

      {open ? (
        <ul className="selectx__pop" role="listbox" ref={listRef} aria-activedescendant={`${baseId}-opt-${cursor}`} tabIndex={-1}>
          {options.length === 0 ? <li className="selectx__empty">لا خيارات</li> : null}
          {options.map((o, i) => (
            <li
              key={o.value}
              id={`${baseId}-opt-${i}`}
              role="option"
              aria-selected={o.value === value}
              aria-disabled={o.disabled || undefined}
              className={`selectx__opt ${i === cursor ? "is-cursor" : ""} ${o.value === value ? "is-on" : ""} ${o.disabled ? "is-disabled" : ""}`}
              onMouseEnter={() => setCursor(i)}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => !o.disabled && choose(o.value)}
            >
              <span className="selectx__opt-label">{o.label}</span>
              {o.hint ? <span className="selectx__opt-hint">{o.hint}</span> : null}
              {o.value === value ? <IconCheck size={15} /> : null}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

interface Toast {
  id: number;
  text: string;
  tone: "info" | "error" | "success";
}

interface ToastContextValue {
  showToast: (text: string, tone?: Toast["tone"]) => void;
  showError: (text: string) => void;
  showSuccess: (text: string) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const nextId = useRef(1);

  const showToast = useCallback((text: string, tone: Toast["tone"] = "info") => {
    const id = nextId.current++;
    setToasts((prev) => [...prev.slice(-3), { id, text, tone }]);
    window.setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4200);
  }, []);

  const value = useRef<ToastContextValue>({
    showToast,
    showError: (t) => showToast(t, "error"),
    showSuccess: (t) => showToast(t, "success"),
  });
  value.current.showToast = showToast;

  return (
    <ToastContext.Provider value={value.current}>
      {children}
      <div className="toasts" role="status" aria-live="polite">
        {toasts.map((t) => (
          <div key={t.id} className={`toast toast--${t.tone}`}>
            <span className="toast__ico">
              {t.tone === "error" ? <IconAlert size={17} /> : t.tone === "success" ? <IconCheckCircle size={17} /> : <IconInfo size={17} />}
            </span>
            <span className="flex1">{t.text}</span>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast outside provider");
  return ctx;
}

export function Modal({
  title,
  onClose,
  children,
  footer,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [onClose]);

  return (
    <div className="modal-overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal" role="dialog" aria-modal="true" aria-label={title}>
        <div className="modal__head">
          <h2>{title}</h2>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="إغلاق">
            <IconX size={17} />
          </button>
        </div>
        <div className="modal__body">{children}</div>
        {footer ? <div className="modal__foot">{footer}</div> : null}
      </div>
    </div>
  );
}

export function ConfirmModal({
  title,
  message,
  confirmLabel = "تأكيد",
  danger,
  busy,
  onConfirm,
  onClose,
}: {
  title: string;
  message: string;
  confirmLabel?: string;
  danger?: boolean;
  busy?: boolean;
  onConfirm: () => void;
  onClose: () => void;
}) {
  return (
    <Modal
      title={title}
      onClose={onClose}
      footer={
        <>
          <button type="button" className="btn" onClick={onClose} disabled={busy}>
            إلغاء
          </button>
          <button type="button" className={`btn ${danger ? "btn--danger" : "btn--primary"}`} onClick={onConfirm} disabled={busy}>
            {busy ? "جارٍ التنفيذ..." : confirmLabel}
          </button>
        </>
      }
    >
      <p className="mb-0">{message}</p>
    </Modal>
  );
}
