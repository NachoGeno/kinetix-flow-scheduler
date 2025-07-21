import { useState } from 'react';
import { Upload, Save, X, FileText, Image, ClipboardList } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface ProgressNoteFormProps {
  appointmentId: string;
  patientId: string;
  medicalOrderId?: string;
  existingNote?: {
    id: string;
    content: string;
    note_type: string;
    status: string;
    attachment_url?: string;
    attachment_name?: string;
  } | null;
  onSave: () => void;
  onCancel: () => void;
  isOpen: boolean;
}

export default function ProgressNoteForm({
  appointmentId,
  patientId,
  medicalOrderId,
  existingNote,
  onSave,
  onCancel,
  isOpen
}: ProgressNoteFormProps) {
  const [content, setContent] = useState(existingNote?.content || '');
  const [noteType, setNoteType] = useState(existingNote?.note_type || 'text');
  const [status, setStatus] = useState(existingNote?.status || 'draft');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      setNoteType('image');
    }
  };

  const uploadFile = async (file: File): Promise<{ url: string; name: string } | null> => {
    try {
      setUploading(true);
      const fileExt = file.name.split('.').pop();
      const fileName = `${Date.now()}.${fileExt}`;
      const filePath = `progress-notes/${appointmentId}/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('medical-orders')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const { data } = supabase.storage
        .from('medical-orders')
        .getPublicUrl(filePath);

      return { url: data.publicUrl, name: file.name };
    } catch (error) {
      console.error('Error uploading file:', error);
      toast({
        title: "Error",
        description: "No se pudo subir el archivo",
        variant: "destructive",
      });
      return null;
    } finally {
      setUploading(false);
    }
  };

  const handleSave = async () => {
    if (!content.trim() && !selectedFile) {
      toast({
        title: "Error",
        description: "Debes agregar contenido o un archivo",
        variant: "destructive",
      });
      return;
    }

    try {
      setSaving(true);
      let attachmentUrl = existingNote?.attachment_url;
      let attachmentName = existingNote?.attachment_name;

      // Upload file if selected
      if (selectedFile) {
        const uploadResult = await uploadFile(selectedFile);
        if (uploadResult) {
          attachmentUrl = uploadResult.url;
          attachmentName = uploadResult.name;
        }
      }

      const noteData = {
        patient_id: patientId,
        appointment_id: appointmentId,
        medical_order_id: medicalOrderId,
        content: content.trim(),
        note_type: noteType,
        status: status,
        attachment_url: attachmentUrl,
        attachment_name: attachmentName,
        created_by: (await supabase.auth.getSession()).data.session?.user.id
      };

      let error;
      if (existingNote) {
        // Update existing note
        const result = await supabase
          .from('progress_notes')
          .update(noteData)
          .eq('id', existingNote.id);
        error = result.error;
      } else {
        // Create new note
        const result = await supabase
          .from('progress_notes')
          .insert(noteData);
        error = result.error;
      }

      if (error) throw error;

      toast({
        title: "Éxito",
        description: existingNote ? "Evolutivo actualizado correctamente" : "Evolutivo guardado correctamente",
      });

      onSave();
    } catch (error) {
      console.error('Error saving progress note:', error);
      toast({
        title: "Error",
        description: "No se pudo guardar el evolutivo",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onCancel}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {existingNote ? 'Editar Evolutivo' : 'Cargar Evolutivo'}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Note Type */}
          <div className="space-y-2">
            <Label>Tipo de Evolutivo</Label>
            <Select value={noteType} onValueChange={setNoteType}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="text">
                  <div className="flex items-center gap-2">
                    <FileText className="h-4 w-4" />
                    Texto libre
                  </div>
                </SelectItem>
                <SelectItem value="structured">
                  <div className="flex items-center gap-2">
                    <ClipboardList className="h-4 w-4" />
                    Formulario estructurado
                  </div>
                </SelectItem>
                <SelectItem value="image">
                  <div className="flex items-center gap-2">
                    <Image className="h-4 w-4" />
                    Imagen/Archivo
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Content */}
          <div className="space-y-2">
            <Label>Contenido del Evolutivo</Label>
            <Textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder={
                noteType === 'structured' 
                  ? "Ingresa la información estructurada del evolutivo..."
                  : "Describe el progreso del paciente, observaciones clínicas, cambios en el tratamiento, etc."
              }
              rows={8}
              className="resize-none"
            />
          </div>

          {/* File Upload */}
          <div className="space-y-2">
            <Label>Archivo Adjunto (Opcional)</Label>
            <div className="flex items-center gap-2">
              <Input
                type="file"
                onChange={handleFileChange}
                accept="image/*,.pdf,.doc,.docx"
                className="flex-1"
              />
              {uploading && (
                <span className="text-sm text-muted-foreground">Subiendo...</span>
              )}
            </div>
            {existingNote?.attachment_url && !selectedFile && (
              <div className="text-sm text-muted-foreground">
                Archivo actual: {existingNote.attachment_name || 'Archivo adjunto'}
              </div>
            )}
          </div>

          {/* Status */}
          <div className="space-y-2">
            <Label>Estado</Label>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="draft">Borrador</SelectItem>
                <SelectItem value="final">Final</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-2 pt-4">
            <Button variant="outline" onClick={onCancel}>
              <X className="h-4 w-4 mr-2" />
              Cancelar
            </Button>
            <Button 
              onClick={handleSave}
              disabled={saving || uploading}
            >
              <Save className="h-4 w-4 mr-2" />
              {saving ? 'Guardando...' : (existingNote ? 'Actualizar' : 'Guardar')}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}