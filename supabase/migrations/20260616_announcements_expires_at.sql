-- Add expires_at column to announcements table
ALTER TABLE public.announcements
ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ;

-- Add index for expiry queries
CREATE INDEX IF NOT EXISTS idx_announcements_expires_at
ON public.announcements(expires_at)
WHERE expires_at IS NOT NULL;
