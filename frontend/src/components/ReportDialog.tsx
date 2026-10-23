import { useState } from "react";
import { Flag } from "lucide-react";
import { api, apiError } from "../lib/api";
import { useUI } from "../store/ui";
import { Modal, Spinner } from "./ui";

const reasons = [
  { value: "SPAM", label: "Spam or unwanted promotion" },
  { value: "HARASSMENT", label: "Harassment or bullying" },
  { value: "HATE_SPEECH", label: "Hate speech" },
  { value: "MISINFORMATION", label: "Misinformation" },
  { value: "OTHER", label: "Something else" },
];

export function ReportDialog({
  open,
  onClose,
  targetType,
  targetId,
}: {
  open: boolean;
  onClose: () => void;
  targetType: "post" | "comment";
  targetId: string;
}) {
  const pushToast = useUI((state) => state.pushToast);
  const [reason, setReason] = useState("SPAM");
  const [details, setDetails] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      const path = targetType === "post" ? `/api/posts/${targetId}/report` : `/api/comments/${targetId}/report`;
      await api.post(path, { reason, details: details.trim() || undefined });
      pushToast("Thanks — a moderator will take a look.", { tone: "success" });
      onClose();
      setDetails("");
    } catch (err) {
      setError(apiError(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Report content"
      description="Reports are private. Our moderators review every one."
    >
      <div className="space-y-4">
        <div>
          <label className="label" htmlFor="report-reason">
            Why are you reporting this?
          </label>
          <select
            id="report-reason"
            className="input"
            value={reason}
            onChange={(event) => setReason(event.target.value)}
          >
            {reasons.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="label" htmlFor="report-details">
            Anything else we should know? <span className="normal-case text-muted/70">(optional)</span>
          </label>
          <textarea
            id="report-details"
            className="input min-h-[96px] resize-y"
            maxLength={1000}
            value={details}
            onChange={(event) => setDetails(event.target.value)}
            placeholder="Add context for the moderation team…"
          />
        </div>
        {error && <p className="text-sm text-rose-600">{error}</p>}
        <div className="flex justify-end gap-2 pt-1">
          <button type="button" className="btn-secondary" onClick={onClose}>
            Cancel
          </button>
          <button type="button" className="btn-primary" onClick={submit} disabled={busy}>
            {busy ? <Spinner className="h-4 w-4 text-white" /> : <Flag className="h-4 w-4" />}
            Send report
          </button>
        </div>
      </div>
    </Modal>
  );
}
