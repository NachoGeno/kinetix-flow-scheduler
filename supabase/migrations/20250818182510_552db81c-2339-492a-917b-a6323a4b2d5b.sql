-- Create enum for shift types
CREATE TYPE shift_type AS ENUM ('mañana', 'tarde', 'completo');

-- Create enum for news categories
CREATE TYPE news_category AS ENUM ('tecnica', 'administrativa', 'medica', 'urgente');

-- Create novedades table
CREATE TABLE public.novedades (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    contenido TEXT NOT NULL,
    fecha DATE NOT NULL DEFAULT CURRENT_DATE,
    turno shift_type NOT NULL DEFAULT 'completo',
    categoria news_category DEFAULT 'administrativa',
    autor_id UUID NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    urgente BOOLEAN DEFAULT false
);

-- Enable Row Level Security
ALTER TABLE public.novedades ENABLE ROW LEVEL SECURITY;

-- Create policies for novedades
CREATE POLICY "Authenticated users can view all novedades" 
ON public.novedades 
FOR SELECT 
USING (true);

CREATE POLICY "Authenticated users can create novedades" 
ON public.novedades 
FOR INSERT 
WITH CHECK (auth.uid() = autor_id);

CREATE POLICY "Users can update their own novedades" 
ON public.novedades 
FOR UPDATE 
USING (auth.uid() = autor_id);

CREATE POLICY "Admins can delete novedades" 
ON public.novedades 
FOR DELETE 
USING (is_admin(auth.uid()));

-- Create indexes for better performance
CREATE INDEX idx_novedades_fecha ON public.novedades(fecha DESC);
CREATE INDEX idx_novedades_created_at ON public.novedades(created_at DESC);
CREATE INDEX idx_novedades_turno ON public.novedades(turno);
CREATE INDEX idx_novedades_categoria ON public.novedades(categoria);
CREATE INDEX idx_novedades_autor ON public.novedades(autor_id);

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_novedades_updated_at
BEFORE UPDATE ON public.novedades
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();