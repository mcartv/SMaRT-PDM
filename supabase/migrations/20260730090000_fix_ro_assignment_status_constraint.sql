-- Allow coordinator approval states in the RO assignment workflow.
ALTER TABLE public.return_of_obligations
  DROP CONSTRAINT IF EXISTS return_of_obligations_assignment_status_check;

ALTER TABLE public.return_of_obligations
  ADD CONSTRAINT return_of_obligations_assignment_status_check
  CHECK (
    assignment_status IN (
      'Pending Coordinator Approval',
      'Coordinator Rejected',
      'Assigned',
      'Acknowledged',
      'Conflict Reported',
      'In Progress',
      'For Validation',
      'Cleared'
    )
  );
