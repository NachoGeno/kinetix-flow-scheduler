import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "@/hooks/useAuth";
import { Layout } from "@/components/layout/Layout";
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import Appointments from "./pages/Appointments";
import Patients from "./pages/Patients";
import Doctors from "./pages/Doctors";
import Orders from "./pages/Orders";
import ObrasSociales from "./pages/ObrasSociales";
import Presentaciones from "./pages/Presentaciones";
import Billing from "./pages/Billing";
import PlusPayments from "./pages/PlusPayments";
import CashManagement from "./pages/CashManagement";
import MedicalRecords from "./pages/MedicalRecords";
import Novedades from "./pages/Novedades";
import Configuration from "./pages/Configuration";
import Reports from "./pages/Reports";
import NotFound from "./pages/NotFound";

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  
  if (loading) {
    return <div className="flex items-center justify-center h-screen">Cargando...</div>;
  }
  
  if (!user) {
    return <Navigate to="/auth" replace />;
  }
  
  return <Layout>{children}</Layout>;
}

const App = () => (
  <TooltipProvider>
    <Toaster />
    <Sonner />
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/auth" element={<Auth />} />
          <Route path="/" element={
            <ProtectedRoute>
              <Index />
            </ProtectedRoute>
          } />
          <Route path="/appointments" element={
            <ProtectedRoute>
              <Appointments />
            </ProtectedRoute>
          } />
          <Route path="/patients" element={
            <ProtectedRoute>
              <Patients />
            </ProtectedRoute>
          } />
          <Route path="/doctors" element={
            <ProtectedRoute>
              <Doctors />
            </ProtectedRoute>
          } />
          <Route path="/orders" element={
            <ProtectedRoute>
              <Orders />
            </ProtectedRoute>
          } />
          <Route path="/obras-sociales" element={
            <ProtectedRoute>
              <ObrasSociales />
            </ProtectedRoute>
          } />
          <Route path="/presentaciones" element={
            <ProtectedRoute>
              <Presentaciones />
            </ProtectedRoute>
          } />
          <Route path="/billing" element={
            <ProtectedRoute>
              <Billing />
            </ProtectedRoute>
          } />
          <Route path="/plus-payments" element={
            <ProtectedRoute>
              <PlusPayments />
            </ProtectedRoute>
          } />
          <Route path="/cash-management" element={
            <ProtectedRoute>
              <CashManagement />
            </ProtectedRoute>
          } />
          <Route path="/medical-records" element={
            <ProtectedRoute>
              <MedicalRecords />
            </ProtectedRoute>
          } />
          <Route path="/novedades" element={
            <ProtectedRoute>
              <Novedades />
            </ProtectedRoute>
          } />
          <Route path="/configuracion" element={
            <ProtectedRoute>
              <Configuration />
            </ProtectedRoute>
          } />
          <Route path="/reports" element={
            <ProtectedRoute>
              <Reports />
            </ProtectedRoute>
          } />
          {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  </TooltipProvider>
);

export default App;
