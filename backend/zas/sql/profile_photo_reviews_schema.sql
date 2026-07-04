create table if not exists public.profile_photo_reviews (
  review_id uuid primary key default gen_random_uuid(),
  student_id uuid not null,
  user_id uuid not null,
  storage_path text not null,
  status text not null default 'pending',
  submitted_at timestamptz not null default now(),
  reviewed_at timestamptz,
  reviewed_by_admin_id uuid,
  rejection_reason text,
  remarks text,
  constraint profile_photo_reviews_status_check
    check (status in ('pending', 'approved', 'rejected', 'superseded')),
  constraint profile_photo_reviews_student_id_fkey
    foreign key (student_id) references public.students (student_id) on delete cascade,
  constraint profile_photo_reviews_user_id_fkey
    foreign key (user_id) references public.users (user_id) on delete cascade,
  constraint profile_photo_reviews_reviewed_by_admin_id_fkey
    foreign key (reviewed_by_admin_id) references public.admin_profiles (admin_id) on delete set null
);

create index if not exists profile_photo_reviews_student_submitted_idx
  on public.profile_photo_reviews (student_id, submitted_at desc);

create index if not exists profile_photo_reviews_status_submitted_idx
  on public.profile_photo_reviews (status, submitted_at desc);

create unique index if not exists profile_photo_reviews_one_pending_per_student_idx
  on public.profile_photo_reviews (student_id)
  where status = 'pending';
