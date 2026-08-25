-- Allow announcements to target recipients of any Scholarship Program maintained
-- in Maintenance > Scholarship Programs.

ALTER TABLE public.announcements
    ADD COLUMN IF NOT EXISTS target_program_id uuid NULL;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'announcements_target_program_id_fkey'
          AND conrelid = 'public.announcements'::regclass
    ) THEN
        ALTER TABLE public.announcements
            ADD CONSTRAINT announcements_target_program_id_fkey
            FOREIGN KEY (target_program_id)
            REFERENCES public.scholarship_program(program_id)
            ON DELETE SET NULL;
    END IF;
END
$$;

ALTER TABLE public.announcements
    DROP CONSTRAINT IF EXISTS announcements_target_audience_check;

ALTER TABLE public.announcements
    ADD CONSTRAINT announcements_target_audience_check
    CHECK (
        target_audience::text = ANY (
            ARRAY[
                'all'::varchar,
                'applicants'::varchar,
                'scholars'::varchar,
                'program'::varchar,
                -- Legacy values remain valid for historical rows.
                'tes'::varchar,
                'tdp'::varchar
            ]::text[]
        )
    );

ALTER TABLE public.announcements
    DROP CONSTRAINT IF EXISTS announcements_program_audience_target_check;

ALTER TABLE public.announcements
    ADD CONSTRAINT announcements_program_audience_target_check
    CHECK (
        (target_audience = 'program' AND target_program_id IS NOT NULL)
        OR
        (target_audience <> 'program' AND target_program_id IS NULL)
    );

CREATE INDEX IF NOT EXISTS idx_announcements_target_program_id
    ON public.announcements(target_program_id)
    WHERE target_program_id IS NOT NULL;
