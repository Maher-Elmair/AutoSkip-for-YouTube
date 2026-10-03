import React from "react";
import { AnimatePresence, motion } from "motion/react";
import { ShieldCheck } from "lucide-react";

interface PermissionConfirmDialogProps {
  open: boolean;
  title: string;
  body: string;
  confirmLabel: string;
  cancelLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
}

/**
 * Lightweight in-popup confirmation shown BEFORE Chrome's own (very technical)
 * `debugger` permission prompt, so the user understands what they are allowing.
 * Built with motion only — no extra dialog dependency.
 */
const PermissionConfirmDialog: React.FC<PermissionConfirmDialogProps> = ({
  open,
  title,
  body,
  confirmLabel,
  cancelLabel,
  onConfirm,
  onCancel,
}) => (
  <AnimatePresence>
    {open && (
      <motion.div
        className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 p-4 backdrop-blur-sm"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onCancel}
      >
        <motion.div
          role="dialog"
          aria-modal="true"
          className="w-full max-w-xs rounded-xl border border-border/40 bg-card p-5 shadow-xl"
          initial={{ opacity: 0, scale: 0.94, y: 12 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.94, y: 12 }}
          transition={{ type: "spring", stiffness: 320, damping: 26 }}
          onClick={(event) => event.stopPropagation()}
        >
          <div className="mb-3 flex items-center gap-2.5">
            <div className="rounded-md bg-primary/20 p-2">
              <ShieldCheck className="h-5 w-5 text-primary" />
            </div>
            <h4 className="text-sm font-semibold text-foreground text-start">
              {title}
            </h4>
          </div>
          <p className="mb-5 text-xs leading-relaxed text-muted-foreground text-start">
            {body}
          </p>
          <div className="flex gap-2">
            <motion.button
              type="button"
              whileTap={{ scale: 0.95 }}
              onClick={onCancel}
              className="flex-1 rounded-lg bg-accent px-3 py-2 text-xs font-medium text-foreground"
            >
              {cancelLabel}
            </motion.button>
            <motion.button
              type="button"
              whileTap={{ scale: 0.95 }}
              onClick={onConfirm}
              className="flex-1 rounded-lg bg-primary px-3 py-2 text-xs font-medium text-primary-foreground"
            >
              {confirmLabel}
            </motion.button>
          </div>
        </motion.div>
      </motion.div>
    )}
  </AnimatePresence>
);

export default PermissionConfirmDialog;
