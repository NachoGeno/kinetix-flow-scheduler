-- Hacer administrador al usuario igenovese@grupoorange.ar
UPDATE public.profiles 
SET role = 'admin' 
WHERE email = 'igenovese@grupoorange.ar';