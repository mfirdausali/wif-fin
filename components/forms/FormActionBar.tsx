import { Button } from '../ui/button';

interface FormActionBarProps {
  onCancel: () => void;
  onSubmit?: () => void;
  submitLabel?: string;
  isSubmitting?: boolean;
  submitDisabled?: boolean;
  submitType?: 'button' | 'submit';
}

export function FormActionBar({
  onCancel,
  onSubmit,
  submitLabel = 'Save',
  isSubmitting = false,
  submitDisabled = false,
  submitType = 'submit'
}: FormActionBarProps) {
  return (
    <div className="flex justify-end gap-3 pt-4 border-t">
      <Button variant="outline" onClick={onCancel} disabled={isSubmitting}>
        Cancel
      </Button>
      <Button
        type={submitType}
        onClick={onSubmit}
        disabled={isSubmitting || submitDisabled}
      >
        {isSubmitting ? 'Saving...' : submitLabel}
      </Button>
    </div>
  );
}
