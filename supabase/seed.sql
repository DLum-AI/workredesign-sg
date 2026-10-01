-- ============================================================
-- Optional starter content — run after schema.sql if you want
-- the admin portal to open with real content already in place
-- instead of empty tables. Safe to skip or edit before running.
-- ============================================================

insert into public.grants (grant_key, name, short_desc, url, funding_summary, best_for, checklist_items, sort_order) values
('ccp', 'Career Conversion Programmes (CCP)',
 'Salary support to hire or retrain a mid-career PMET into a new role.',
 'https://www.ourworkforce.gov.sg/programmes-directory/programme/career-conversion-programmes',
 'Government co-funds salary during structured on-the-job training. Not a lump-sum grant.',
 'Hiring a mid-career PMET into a genuinely new / redesigned role, or reskilling an existing employee into one.',
 '["Company is registered/incorporated in Singapore with a valid UEN","Complies with the Employment Act 1968 for all trainees","Have identified the specific growth job role the candidate will train for","For a NEW HIRE: candidate has not started work, or CCP starts within 3 months of their start date","For an EXISTING EMPLOYEE: they have been with the company ≥ 1 year and are being reskilled","The new role is substantially different from the trainee''s previous role","Have NOT started training before securing programme approval"]'::jsonb,
 1),
('wdgjr', 'SkillsFuture Workforce Development Grant — Job Redesign+ (WDG(JR+))',
 'Up to 70% funding (cap $150,000) for job-redesign consultancy, capability building, and workforce tech.',
 'https://www.ourworkforce.gov.sg/programmes-directory/programme/workforce-development-grant-job-redesign-plus',
 'Workforce consultancy (up to $50,000), capability building (up to $60,000), workforce tech (up to $90,000, must pair with one of the above). Overall cap $150,000.',
 'Funding the job-redesign process itself.',
 '["Company is registered/operating in Singapore","Employs at least 3 local employees (Citizens or PRs)","Have NOT signed any contract or made any payment for job-redesign consultancy yet","Have picked a pre-approved consultant from the official panel","Know which component(s) are needed","Total funding ask fits within the $150,000 cap","Have a rough scope in mind for what''s being redesigned"]'::jsonb,
 2),
('mcpp', 'Mid-Career Pathways Programme',
 'Structured 4–6 month attachments (re-ternships), government co-funds 70% of the training allowance.',
 'https://www.ourworkforce.gov.sg/programmes-directory/programme/mid-career-pathways-programme',
 'Monthly allowance $1,800–$3,800; government covers 70%, host covers 30%.',
 'Hosting a mature/mid-career individual on a structured attachment toward a genuine role.',
 '["Organisation is registered or incorporated in Singapore","Able to commit to a 4–6 month attachment","Have a genuine, budgeted position the attachment is building toward","Able to pay the same salary or higher on conversion","Can prepare a documented training plan for approval","Understand the 70/30 co-funding split"]'::jsonb,
 3)
on conflict (grant_key) do nothing;

insert into public.menu_items (label, href, sort_order) values
('Is Your Job Ready?', 'index.html', 1),
('Task Map Tool', 'task-map.html', 2),
('Grants & Checklists', 'grants.html', 3),
('Find Talent', 'match.html', 4),
('Talent Directory', 'directory.html', 5),
('About', 'about.html', 6)
on conflict do nothing;

insert into public.content_blocks (block_key, page, label, content_value) values
('hero.index.title', 'index', 'Homepage hero title', 'Is this role ready for a redesign?'),
('hero.index.subtitle', 'index', 'Homepage hero subtitle', 'A free 2-minute check for Singapore hirers.')
on conflict (block_key) do nothing;

insert into public.feature_flags (flag_key, label, description, is_enabled) values
('directory_fuzzy_search', 'Fuzzy/semantic talent search', 'Upgrade the directory search from simple substring matching to pg_trgm + pgvector once the pool is large enough to justify it.', false),
('pmet_self_editing_after_approval', 'Let approved PMETs edit their own profile', 'Currently an approved profile is locked; enable this once you want approved PMETs to submit edits that re-enter the review queue.', false)
on conflict (flag_key) do nothing;
