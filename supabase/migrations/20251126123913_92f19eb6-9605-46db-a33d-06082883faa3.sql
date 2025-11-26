-- Create enum for user roles
CREATE TYPE public.app_role AS ENUM ('admin', 'moderator');

-- Create user_roles table for admin management
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  UNIQUE(user_id, role)
);

-- Enable RLS on user_roles
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Create security definer function to check roles
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

-- RLS policies for user_roles
CREATE POLICY "Admins can view all roles"
  ON public.user_roles FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can manage roles"
  ON public.user_roles FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Create checkins table to track validation history
CREATE TABLE public.checkins (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  id_compra UUID NOT NULL,
  id_evento UUID NOT NULL,
  id_ingresso UUID NOT NULL,
  buyer_email TEXT NOT NULL,
  validated_by UUID REFERENCES auth.users(id) NOT NULL,
  validated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('valid', 'invalid')),
  reason TEXT,
  qr_payload TEXT NOT NULL
);

-- Enable RLS on checkins
ALTER TABLE public.checkins ENABLE ROW LEVEL SECURITY;

-- RLS policies for checkins
CREATE POLICY "Authenticated users can view checkins"
  ON public.checkins FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert checkins"
  ON public.checkins FOR INSERT
  TO authenticated
  WITH CHECK (validated_by = auth.uid());

-- Create index for faster queries
CREATE INDEX idx_checkins_id_compra ON public.checkins(id_compra);
CREATE INDEX idx_checkins_id_evento ON public.checkins(id_evento);
CREATE INDEX idx_checkins_validated_at ON public.checkins(validated_at DESC);