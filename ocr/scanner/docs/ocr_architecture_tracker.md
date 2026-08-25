# OCR Architecture Tracker

## Approved

- Birth certificate extraction contract

## Pending approval

- Certificate of indigency contract
- Grade form contract

## Current implementation state

- Existing code audit: complete for current worker path
- Document-specific contract registry: added
- Birth-certificate extraction: contract shape only, no real field extraction yet
- Indigency and grade-form contracts: review-only placeholders
- Worker integration: validated by unit tests

## Notes

- The worker now publishes `extracted_fields` as structured contract metadata.
- Unknown or pending document types stay flagged for admin review.
- No personal data from OCR output is written into logs by the new contract layer.

