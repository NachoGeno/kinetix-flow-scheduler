import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";

interface EmailSettings {
  id?: string;
  default_sender_name: string;
  default_sender_email: string;
  reply_to?: string | null;
}

interface ObraSocial { id: string; nombre: string; tipo: string }

type EmailType = "presentation" | "social_appointments";

export default function EmailSettingsForm() {
  const [settings, setSettings] = useState<EmailSettings>({
    default_sender_name: "Mediturnos",
    default_sender_email: "",
    reply_to: "",
  });
  const [loading, setLoading] = useState(false);
  const [obras, setObras] = useState<ObraSocial[]>([]);

  // Recipients state
  const [recipientEmail, setRecipientEmail] = useState("");
  const [recipientName, setRecipientName] = useState("");
  const [recipientObra, setRecipientObra] = useState<string | undefined>(undefined);
  const [recipientType, setRecipientType] = useState<EmailType>("presentation");
  const [recipients, setRecipients] = useState<any[]>([]);

  useEffect(() => {
    (async () => {
      // Load settings
      const { data: s } = await supabase.from("email_settings").select("*").limit(1).maybeSingle();
      if (s) setSettings(s as EmailSettings);

      // Load obras sociales
      const { data: os } = await supabase
        .from("obras_sociales_art")
        .select("id, nombre, tipo")
        .eq("is_active", true)
        .order("nombre");
      setObras(os || []);

      // Load recipients
      const { data: recs } = await supabase
        .from("email_recipients")
        .select("id, email, name, email_type, is_active, obra_social_art_id");
      setRecipients(recs || []);
    })();
  }, []);

  const saveSettings = async () => {
    try {
      setLoading(true);
      if (settings.id) {
        const { error } = await supabase
          .from("email_settings")
          .update({
            default_sender_name: settings.default_sender_name,
            default_sender_email: settings.default_sender_email,
            reply_to: settings.reply_to || null,
          })
          .eq("id", settings.id);
        if (error) throw error;
      } else {
        const { data, error } = await supabase
          .from("email_settings")
          .insert({
            default_sender_name: settings.default_sender_name,
            default_sender_email: settings.default_sender_email,
            reply_to: settings.reply_to || null,
          })
          .select()
          .single();
        if (error) throw error;
        setSettings(data as EmailSettings);
      }
      toast.success("Configuración guardada");
    } catch (e: any) {
      toast.error(e.message || "Error guardando configuración");
    } finally {
      setLoading(false);
    }
  };

  const addRecipient = async () => {
    try {
      setLoading(true);
      if (!recipientEmail) throw new Error("Ingrese un email destinatario");

      const { data, error } = await supabase
        .from("email_recipients")
        .insert({
          email: recipientEmail,
          name: recipientName || null,
          email_type: recipientType,
          obra_social_art_id: recipientObra || null,
        })
        .select()
        .single();
      if (error) throw error;
      setRecipients((prev) => [data, ...prev]);
      setRecipientEmail("");
      setRecipientName("");
      toast.success("Destinatario agregado");
    } catch (e: any) {
      toast.error(e.message || "Error agregando destinatario");
    } finally {
      setLoading(false);
    }
  };

  const toggleRecipient = async (id: string, isActive: boolean) => {
    const { error } = await supabase
      .from("email_recipients")
      .update({ is_active: !isActive })
      .eq("id", id);
    if (!error) {
      setRecipients((prev) => prev.map((r) => (r.id === id ? { ...r, is_active: !isActive } : r)));
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Configuración de Email</CardTitle>
        <CardDescription>
          Define remitente y destinatarios para presentaciones y turnos sociales.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="space-y-2">
            <Label>Nombre remitente</Label>
            <Input
              value={settings.default_sender_name}
              onChange={(e) => setSettings((s) => ({ ...s, default_sender_name: e.target.value }))}
              placeholder="Ej: Centro Médico"
            />
          </div>
          <div className="space-y-2">
            <Label>Email remitente</Label>
            <Input
              value={settings.default_sender_email}
              onChange={(e) => setSettings((s) => ({ ...s, default_sender_email: e.target.value }))}
              placeholder="remitente@tudominio.com"
            />
          </div>
          <div className="space-y-2">
            <Label>Reply-To (opcional)</Label>
            <Input
              value={settings.reply_to || ""}
              onChange={(e) => setSettings((s) => ({ ...s, reply_to: e.target.value }))}
              placeholder="respuestas@tudominio.com"
            />
          </div>
        </div>
        <div>
          <Button onClick={saveSettings} disabled={loading} className="w-full md:w-auto">Guardar</Button>
        </div>

        <div className="space-y-4">
          <h3 className="text-lg font-semibold">Destinatarios</h3>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
            <div className="space-y-2">
              <Label>Tipo</Label>
              <Select value={recipientType} onValueChange={(v) => setRecipientType(v as EmailType)}>
                <SelectTrigger>
                  <SelectValue placeholder="Tipo de correo" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="presentation">Presentaciones</SelectItem>
                  <SelectItem value="social_appointments">Turnos sociales</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Obra Social/ART (opcional)</Label>
              <Select value={recipientObra} onValueChange={setRecipientObra}>
                <SelectTrigger>
                  <SelectValue placeholder="Global (todas)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={"" as any}>Global (todas)</SelectItem>
                  {obras.map((o) => (
                    <SelectItem key={o.id} value={o.id}>{o.nombre} ({o.tipo})</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Nombre (opcional)</Label>
              <Input value={recipientName} onChange={(e) => setRecipientName(e.target.value)} placeholder="Nombre" />
            </div>
            <div className="space-y-2">
              <Label>Email</Label>
              <div className="flex gap-2">
                <Input value={recipientEmail} onChange={(e) => setRecipientEmail(e.target.value)} placeholder="destinatario@dominio.com" />
                <Button onClick={addRecipient} disabled={loading}>Agregar</Button>
              </div>
            </div>
          </div>

          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Tipo</TableHead>
                <TableHead>Obra/ART</TableHead>
                <TableHead>Nombre</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Activo</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {recipients.map((r) => {
                const obra = obras.find((o) => o.id === r.obra_social_art_id);
                return (
                  <TableRow key={r.id}>
                    <TableCell>{r.email_type === 'presentation' ? 'Presentaciones' : 'Turnos sociales'}</TableCell>
                    <TableCell>{obra ? `${obra.nombre} (${obra.tipo})` : 'Global'}</TableCell>
                    <TableCell>{r.name || '-'}</TableCell>
                    <TableCell>{r.email}</TableCell>
                    <TableCell>
                      <Switch checked={r.is_active} onCheckedChange={() => toggleRecipient(r.id, r.is_active)} />
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}
