CREATE TABLE IF NOT EXISTS public.trendou_order_attribution (
  identifier text PRIMARY KEY REFERENCES public.trendou_orders(identifier) ON DELETE CASCADE,
  visit_id uuid NOT NULL,
  source varchar(160) NOT NULL DEFAULT 'nao-informado',
  campaign varchar(160) NOT NULL DEFAULT 'nao-informado',
  creative varchar(160) NOT NULL DEFAULT 'nao-informado',
  medium varchar(160) NOT NULL DEFAULT 'nao-informado',
  term varchar(160) NOT NULL DEFAULT 'nao-informado',
  fbclid varchar(500) NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS trendou_order_attribution_visit_idx
  ON public.trendou_order_attribution (visit_id);
CREATE INDEX IF NOT EXISTS trendou_order_attribution_creative_idx
  ON public.trendou_order_attribution (creative);
