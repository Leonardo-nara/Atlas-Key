interface ConfirmDialogProps {
  title: string;
  description: string;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: "danger" | "warning";
  isSubmitting?: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}

export function ConfirmDialog({
  title,
  description,
  confirmLabel = "Confirmar",
  cancelLabel = "Cancelar",
  tone = "warning",
  isSubmitting = false,
  onCancel,
  onConfirm
}: ConfirmDialogProps) {
  return (
    <div className="modal-backdrop" role="presentation">
      <div
        aria-modal="true"
        className="modal-card confirm-dialog"
        role="dialog"
      >
        <div className="modal-header">
          <div>
            <p className="section-kicker">
              {tone === "danger" ? "Ação sensível" : "Confirmação"}
            </p>
            <h3>{title}</h3>
          </div>
        </div>
        <p className="muted-text">{description}</p>
        <div className="modal-actions">
          <button
            className="ghost-button"
            disabled={isSubmitting}
            onClick={onCancel}
            type="button"
          >
            {cancelLabel}
          </button>
          <button
            className={tone === "danger" ? "danger-button" : "primary-button"}
            disabled={isSubmitting}
            onClick={onConfirm}
            type="button"
          >
            {isSubmitting ? "Processando..." : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
