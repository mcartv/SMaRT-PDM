import React, { useState } from 'react';
import { AlertTriangle, X, XCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import {
  MAJOR_REJECTION_OPTIONS,
  MINOR_REUPLOAD_OPTIONS,
} from '@/utils/documentReviewPolicy';

export default function DocumentReviewIssueModal({
  mode,
  documentName,
  onClose,
  onConfirm,
}) {
  const isMajor = mode === 'major';
  const options = isMajor
    ? MAJOR_REJECTION_OPTIONS
    : MINOR_REUPLOAD_OPTIONS;

  const [reasonCode, setReasonCode] = useState('');
  const [remarks, setRemarks] = useState('');

  const selectedReason = options.find(
    (option) => option.code === reasonCode
  );

  const handleConfirm = () => {
    if (!selectedReason) return;

    const comment = [
      `Reason: ${selectedReason.label}`,
      remarks.trim() ? `Remarks: ${remarks.trim()}` : '',
    ]
      .filter(Boolean)
      .join('\n');

    onConfirm({
      status: isMajor ? 'rejected' : 'reupload_required',
      issueSeverity: isMajor ? 'major' : 'minor',
      reasonCode: selectedReason.code,
      comment,
    });
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/35 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <Card
        className="w-full max-w-lg overflow-hidden border-stone-200 shadow-xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-stone-100 bg-stone-50 px-5 py-4">
          <div>
            <h3 className="text-base font-semibold text-stone-800">
              {isMajor
                ? 'Reject Application'
                : 'Request Document Re-upload'}
            </h3>
            <p className="mt-0.5 text-sm text-stone-500">
              {documentName || 'Selected document'}
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-stone-400 transition-colors hover:bg-stone-100 hover:text-stone-600"
          >
            <X size={16} />
          </button>
        </div>

        <CardContent className="space-y-4 p-5">
          <div
            className={`rounded-xl border px-3 py-3 text-sm leading-relaxed ${
              isMajor
                ? 'border-red-200 bg-red-50 text-red-800'
                : 'border-amber-200 bg-amber-50 text-amber-800'
            }`}
          >
            {isMajor
              ? 'Major action: saving this review will reject the entire scholarship application. Use this only for fraud, document tampering, deliberate falsification, or another serious disqualifying violation.'
              : 'Minor issue: the application stays active. The applicant will be allowed to upload a corrected replacement document.'}
          </div>

          <div>
            <p className="mb-2 text-xs font-medium uppercase tracking-wide text-stone-400">
              {isMajor ? 'Major violation' : 'Reason for re-upload'}
            </p>

            <div className="space-y-2">
              {options.map((option) => (
                <label
                  key={option.code}
                  className="flex cursor-pointer items-start gap-3 rounded-lg border border-stone-200 bg-white px-3 py-2"
                >
                  <input
                    type="radio"
                    name={
                      isMajor
                        ? 'major_document_reason'
                        : 'minor_document_reason'
                    }
                    checked={reasonCode === option.code}
                    onChange={() => setReasonCode(option.code)}
                    className="mt-1 h-4 w-4"
                  />
                  <span className="text-[15px] text-stone-700">
                    {option.label}
                  </span>
                </label>
              ))}
            </div>
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-stone-400">
              Admin remarks
            </label>
            <Textarea
              value={remarks}
              onChange={(event) => setRemarks(event.target.value)}
              placeholder="Optional additional remarks..."
              className="h-20 resize-none rounded-lg border-stone-200 bg-stone-50/50 text-[15px]"
            />
          </div>
        </CardContent>

        <div className="flex items-center justify-end gap-2 border-t border-stone-100 bg-stone-50 px-5 py-4">
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            className="h-9 rounded-lg border-stone-200 text-sm"
          >
            Cancel
          </Button>

          <Button
            type="button"
            disabled={!selectedReason}
            onClick={handleConfirm}
            className={`h-9 rounded-lg border-none text-sm text-white disabled:opacity-50 ${
              isMajor
                ? 'bg-red-600 hover:bg-red-700'
                : 'bg-amber-600 hover:bg-amber-700'
            }`}
          >
            {isMajor ? (
              <>
                <XCircle className="mr-2 h-4 w-4" />
                Confirm Major Rejection
              </>
            ) : (
              <>
                <AlertTriangle className="mr-2 h-4 w-4" />
                Request Re-upload
              </>
            )}
          </Button>
        </div>
      </Card>
    </div>
  );
}
