import { AlertTriangle, Upload } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

interface PendingDocumentAlertProps {
  medicalOrderId?: string;
  patientName?: string;
  orderDescription?: string;
  showUploadButton?: boolean;
  onUploadClick?: () => void;
  className?: string;
}

export default function PendingDocumentAlert({ 
  medicalOrderId, 
  patientName, 
  orderDescription, 
  showUploadButton = false,
  onUploadClick,
  className = "" 
}: PendingDocumentAlertProps) {
  return (
    <Alert className={`border-warning bg-warning/10 ${className}`}>
      <AlertTriangle className="h-4 w-4 text-warning" />
      <AlertDescription className="flex items-center justify-between">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="font-medium text-warning">⚠️ Orden médica pendiente de entrega</span>
            <Badge variant="outline" className="border-warning text-warning">
              Sin documento
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground">
            {patientName && orderDescription 
              ? `${patientName} aún no ha presentado el documento para: ${orderDescription}`
              : "Esta orden aún no fue presentada por el paciente"
            }
          </p>
        </div>
        {showUploadButton && onUploadClick && (
          <Button
            size="sm"
            variant="outline"
            onClick={onUploadClick}
            className="border-warning text-warning hover:bg-warning hover:text-warning-foreground"
          >
            <Upload className="h-3 w-3 mr-2" />
            Cargar documento
          </Button>
        )}
      </AlertDescription>
    </Alert>
  );
}