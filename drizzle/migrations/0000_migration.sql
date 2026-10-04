
CREATE TABLE public.departments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.staff_users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_code text NOT NULL UNIQUE,
  name text NOT NULL CHECK (char_length(name) BETWEEN 1 AND 100),
  department_id uuid NOT NULL REFERENCES public.departments(id) ON DELETE RESTRICT,
  role text NOT NULL CHECK (char_length(role) BETWEEN 1 AND 100),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.campaigns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL CHECK (char_length(name) BETWEEN 1 AND 150),
  description text NOT NULL DEFAULT '' CHECK (char_length(description) <= 1000),
  scenario text NOT NULL CHECK (char_length(scenario) BETWEEN 1 AND 150),
  target_department_id uuid REFERENCES public.departments(id) ON DELETE SET NULL,
  difficulty text NOT NULL CHECK (difficulty IN ('Beginner','Intermediate','Advanced')),
  start_date date NOT NULL,
  end_date date NOT NULL,
  status text NOT NULL CHECK (status IN ('Draft','Active','Completed')),
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (end_date >= start_date)
);
CREATE TABLE public.simulation_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id uuid NOT NULL REFERENCES public.campaigns(id) ON DELETE CASCADE,
  sender_name text NOT NULL CHECK (char_length(sender_name) <= 150),
  sender_address text NOT NULL CHECK (char_length(sender_address) <= 200),
  subject text NOT NULL CHECK (char_length(subject) BETWEEN 1 AND 200),
  body text NOT NULL CHECK (char_length(body) <= 5000),
  link_text text NOT NULL CHECK (char_length(link_text) <= 200),
  indicators text[] NOT NULL DEFAULT '{}',
  sent_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.user_interactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.staff_users(id) ON DELETE CASCADE,
  message_id uuid NOT NULL REFERENCES public.simulation_messages(id) ON DELETE CASCADE,
  action text NOT NULL CHECK (action IN ('delivered','opened','clicked','reported')),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, message_id, action)
);
CREATE TABLE public.training_modules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  title text NOT NULL,
  description text NOT NULL,
  sort_order int NOT NULL DEFAULT 0
);
CREATE TABLE public.training_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.staff_users(id) ON DELETE CASCADE,
  module_id uuid NOT NULL REFERENCES public.training_modules(id) ON DELETE CASCADE,
  score int NOT NULL CHECK (score BETWEEN 0 AND 100),
  completed boolean NOT NULL DEFAULT false,
  status text NOT NULL DEFAULT 'completed' CHECK (status IN ('assigned','completed')),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL CHECK (char_length(title) <= 200),
  summary jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor text NOT NULL CHECK (char_length(actor) <= 150),
  action text NOT NULL CHECK (char_length(action) <= 100),
  object text NOT NULL CHECK (char_length(object) <= 200),
  details text NOT NULL DEFAULT '' CHECK (char_length(details) <= 1000),
  created_at timestamptz NOT NULL DEFAULT now()
);

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['departments','staff_users','campaigns','simulation_messages','user_interactions','training_modules','training_attempts','reports','audit_logs'] LOOP
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON public.%I TO anon, authenticated', t);
    EXECUTE format('GRANT ALL ON public.%I TO service_role', t);
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('CREATE POLICY "demo read" ON public.%I FOR SELECT TO anon, authenticated USING (true)', t);
    EXECUTE format('CREATE POLICY "demo insert" ON public.%I FOR INSERT TO anon, authenticated WITH CHECK (true)', t);
    EXECUTE format('CREATE POLICY "demo update" ON public.%I FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true)', t);
    EXECUTE format('CREATE POLICY "demo delete" ON public.%I FOR DELETE TO anon, authenticated USING (true)', t);
  END LOOP;
END $$;
-- audit logs are append-only
DROP POLICY "demo update" ON public.audit_logs;
DROP POLICY "demo delete" ON public.audit_logs;
REVOKE UPDATE, DELETE ON public.audit_logs FROM anon, authenticated;

-- ===== SEED (fictional synthetic data) =====
INSERT INTO public.departments(name) VALUES ('Clinical'),('IT'),('Finance'),('HR'),('Administration'),('Pharmacy');

INSERT INTO public.staff_users(employee_code, name, department_id, role)
SELECT 'EMP-' || lpad(g::text,4,'0'),
  (ARRAY['Amelia','Oliver','Isla','Harry','Ava','Jack','Mia','George','Ella','Noah','Grace','Leo','Freya','Arthur','Ruby','Oscar','Poppy','Theo','Lily','Alfie'])[1 + (g*7) % 20] || ' ' ||
  (ARRAY['Hartwell','Pemberton','Ashcroft','Blackwood','Fairfax','Thornbury','Whitlock','Kingsley','Marlowe','Penrose','Rowntree','Sterling','Calloway','Davenport','Ellery'])[1 + (g*11) % 15],
  (SELECT id FROM public.departments ORDER BY name OFFSET (g % 6) LIMIT 1),
  (ARRAY['Staff Nurse','Analyst','Officer','Coordinator','Manager','Technician','Assistant','Specialist'])[1 + (g*3) % 8]
FROM generate_series(1,100) g;

INSERT INTO public.campaigns(name, description, scenario, target_department_id, difficulty, start_date, end_date, status) VALUES
('Password Expiration Simulation','Fictional notice claiming the user password expires today.','Password expiry',NULL,'Beginner', current_date - 150, current_date - 140,'Completed'),
('IT Support Notification','Fake helpdesk ticket requesting action.','IT helpdesk',NULL,'Beginner', current_date - 120, current_date - 110,'Completed'),
('Security Alert Simulation','Alarming login alert from an unknown location.','Security alert',NULL,'Intermediate', current_date - 90, current_date - 80,'Completed'),
('Document Sharing Notification','Shared document from an unfamiliar colleague.','Document share',NULL,'Intermediate', current_date - 60, current_date - 50,'Completed'),
('Account Verification Simulation','Request to verify account details urgently.','Account verification',NULL,'Advanced', current_date - 10, current_date + 10,'Active');

INSERT INTO public.simulation_messages(campaign_id, sender_name, sender_address, subject, body, link_text, indicators, sent_at)
SELECT c.id, v.sender_name, v.sender_address, v.subject, v.body, v.link_text, v.indicators, c.start_date::timestamptz + (v.n || ' hours')::interval
FROM public.campaigns c
JOIN (VALUES
 ('Password Expiration Simulation',1,'IT Service Desk','it-desk@trust-passw0rd.example','Your password expires TODAY','Dear user, your password will expire in 2 hours. Click below immediately to keep acess to your account or you will be locked out.','Keep my password',ARRAY['Suspicious sender','Urgent language','Grammar/spelling issues','Unusual link']),
 ('Password Expiration Simulation',2,'Account Admin','admin@nhs-accounts.example','Mandatory password reset','All staff must reset passwords before end of shift. Failure will result in account suspension.','Reset now',ARRAY['Threatening language','Urgent language','Unusual link']),
 ('Password Expiration Simulation',3,'Microsoft 365','no-reply@m365-security.example','Password policy update','A new policy requires you to confirm your current password.','Confirm password',ARRAY['Request for sensitive information','Suspicious sender']),
 ('Password Expiration Simulation',4,'Payroll','payroll-alerts@pay-roll.example','Re: password expiry & payslip access','Your payslip will be unavailable until you update your login.','Update login',ARRAY['Unexpected request','Unusual link']),
 ('IT Support Notification',1,'Helpdesk','helpdesk@itsupport-trust.example','Ticket #48213 requires your action','We have received a request to delete your mailbox. If this was not you, cancel it here.','Cancel request',ARRAY['Unexpected request','Urgent language']),
 ('IT Support Notification',2,'IT Support','support@it-helpdesk-team.example','Remote software update required','Please install the attached update to keep your workstation compliant.','Install update',ARRAY['Unexpected request','Unusual link']),
 ('IT Support Notification',3,'Service Desk','desk@servicedesk.example','Your mailbox is full','Your mailbox is 99% full. Upgrade storage now to keep recieving email.','Upgrade storage',ARRAY['Grammar/spelling issues','Urgent language']),
 ('IT Support Notification',4,'Network Team','net@trust-network.example','VPN certificate renewal','Your VPN certificate needs renewal. Sign in to renew.','Renew certificate',ARRAY['Suspicious sender','Unusual link']),
 ('Security Alert Simulation',1,'Security Team','alerts@secure-login.example','Unusual sign-in detected','We detected a sign-in from an unknown location. Secure your account now or it will be disabled.','Secure account',ARRAY['Threatening language','Urgent language','Unusual link']),
 ('Security Alert Simulation',2,'Cyber Unit','cyber@trust-cyber.example','Your device may be infected','Our scan found malware on your device. Run the cleaner immediately.','Run cleaner',ARRAY['Urgent language','Unexpected request']),
 ('Security Alert Simulation',3,'Information Governance','ig@ig-compliance.example','Data breach involving your account','Your details were found in a breach. Verify your identity to continue.','Verify identity',ARRAY['Request for sensitive information','Threatening language']),
 ('Security Alert Simulation',4,'MFA Service','mfa@auth-verify.example','MFA re-enrolment required','Your multi-factor authentication has been reset. Re-enrol within 1 hour.','Re-enrol',ARRAY['Urgent language','Suspicious sender']),
 ('Document Sharing Notification',1,'Dr. K. Mercer','k.mercer@share-docs.example','Shared: Rota_Changes_Q3.xlsx','A colleague shared a document with you. Open to view.','Open document',ARRAY['Suspicious sender','Unusual link']),
 ('Document Sharing Notification',2,'HR Team','hr@hr-portal.example','Confidential: salary review','Please review the attached salary review document before Friday.','View salary review',ARRAY['Unexpected request','Suspicious sender']),
 ('Document Sharing Notification',3,'Finance','invoices@finance-share.example','Invoice INV-2291 overdue','Overdue invoice attached. Pay today to avoid penalties.','View invoice',ARRAY['Threatening language','Urgent language']),
 ('Document Sharing Notification',4,'eFax','fax@efax-delivery.example','You have a new fax (3 pages)','A new fax awaits. Click to download.','Download fax',ARRAY['Unexpected request','Unusual link']),
 ('Account Verification Simulation',1,'Staff Accounts','verify@staff-accounts.example','Verify your account within 24 hours','We need you to verify your employee details to avoid deactivation.','Verify account',ARRAY['Urgent language','Threatening language','Request for sensitive information']),
 ('Account Verification Simulation',2,'Pension Scheme','pensions@pension-update.example','Update your bank details','Confirm your bank details to keep receiving pension contributions.','Update details',ARRAY['Request for sensitive information','Suspicious sender']),
 ('Account Verification Simulation',3,'Smartcard Office','smartcard@id-verify.example','Smartcard access suspended','Your smartcard access has been suspended. Verify to restore.','Restore access',ARRAY['Threatening language','Unusual link']),
 ('Account Verification Simulation',4,'Annual Leave','leave@leave-portal.example','Leave request requires confirmation','Your leave will be cancelled unless you confirm your login.','Confirm leave',ARRAY['Unexpected request','Request for sensitive information'])
) AS v(cname,n,sender_name,sender_address,subject,body,link_text,indicators) ON v.cname = c.name;

-- interactions: each user gets one message per campaign
WITH ranked AS (
  SELECT c.id cid, c.start_date, row_number() OVER (ORDER BY c.start_date) AS cnum FROM public.campaigns c
), assign AS (
  SELECT u.id uid, r.cnum, r.start_date,
    (SELECT m.id FROM public.simulation_messages m WHERE m.campaign_id = r.cid ORDER BY m.sent_at OFFSET (abs(hashtext(u.id::text || r.cid::text)) % 4) LIMIT 1) mid,
    (abs(hashtext(u.id::text || r.cid::text || 'x')) % 100) roll,
    (abs(hashtext(u.id::text || r.cid::text || 'y')) % 100) roll2
  FROM public.staff_users u CROSS JOIN ranked r
)
INSERT INTO public.user_interactions(user_id, message_id, action, created_at)
SELECT uid, mid, a.action, start_date::timestamptz + interval '1 day' + (a.ord || ' hours')::interval
FROM assign
CROSS JOIN LATERAL (VALUES ('delivered',0),('opened',2),('clicked',3),('reported',4)) a(action, ord)
WHERE a.action = 'delivered'
   OR (a.action = 'opened' AND roll < 80)
   OR (a.action = 'clicked' AND roll < (ARRAY[34,27,21,16,11])[cnum])
   OR (a.action = 'reported' AND roll < 80 AND roll2 < (ARRAY[30,38,46,54,62])[cnum]);

INSERT INTO public.training_modules(slug,title,description,sort_order) VALUES
('identify-phishing','How to identify phishing','Spot the common hallmarks of a phishing message.',1),
('suspicious-links','Suspicious links','Inspect links safely before you trust them.',2),
('sender-verification','Sender verification','Confirm who a message is really from.',3),
('urgency-social-engineering','Urgency and social engineering','Recognise pressure tactics designed to rush you.',4),
('reporting','Reporting suspicious messages','Know exactly how and when to report.',5),
('protecting-information','Protecting sensitive information','Keep patient and staff data safe.',6);

INSERT INTO public.training_attempts(user_id, module_id, score, completed, status, created_at)
SELECT u.id, m.id, 60 + abs(hashtext(u.id::text||m.id::text)) % 41, true, 'completed', now() - ((abs(hashtext(m.id::text||u.id::text)) % 120) || ' days')::interval
FROM public.staff_users u CROSS JOIN public.training_modules m
WHERE abs(hashtext(u.id::text || m.slug)) % 100 < 45;

INSERT INTO public.audit_logs(actor, action, object, details, created_at)
SELECT 'Security Admin', 'Campaign created', c.name, 'Difficulty: ' || c.difficulty, c.start_date::timestamptz - interval '3 days' FROM public.campaigns c
UNION ALL
SELECT 'Security Admin', 'Simulation launched', c.name, '4 simulated messages delivered in-app', c.start_date::timestamptz FROM public.campaigns c;
