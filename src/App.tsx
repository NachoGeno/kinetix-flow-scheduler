import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { SidebarProvider } from "@/components/ui/sidebar";
import { Routes, Route, Navigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { Layout } from "@/components/layout/Layout";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import SaasAdmin from "./pages/SaasAdmin";
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
import ReportsManager from "./pages/ReportsManager";
import NotFound from "./pages/NotFound";

// Ruta de inicio: si el usuario es super_admin, redirigir al panel de administración
function HomeRoute() {
  const { user, loading, profile } = useAuth();

  if (loading) {
    return <div className="flex items-center justify-center h-screen">Cargando...</div>;
  }

  if (!user) {
    return <Navigate to="/auth" replace />;
  }

  if (profile?.role === 'super_admin') {
    return <Navigate to="/saas-admin" replace />;
  }

  return (
    <Layout>
      <Index />
    </Layout>
  );
}

const App = () => (
  <TooltipProvider>
    <SidebarProvider>
      <Toaster />
      <Sonner />
      <Routes>
        <Route path="/auth" element={<Auth />} />
        <Route path="/saas-admin" element={
          <ProtectedRoute requiredModule="saas-admin">
            <SaasAdmin />
          </ProtectedRoute>
        } />
        <Route path="/" element={<HomeRoute />} />
        <Route path="/appointments" element={
          <ProtectedRoute requiredModule="appointments">
            <Layout><Appointments /></Layout>
          </ProtectedRoute>
        } />
        <Route path="/patients" element={
          <ProtectedRoute requiredModule="patients">
            <Layout><Patients /></Layout>
          </ProtectedRoute>
        } />
        <Route path="/doctors" element={
          <ProtectedRoute requiredModule="doctors">
            <Layout><Doctors /></Layout>
          </ProtectedRoute>
        } />
        <Route path="/orders" element={
          <ProtectedRoute requiredModule="orders">
            <Layout><Orders /></Layout>
          </ProtectedRoute>
        } />
        <Route path="/obras-sociales" element={
          <ProtectedRoute requiredModule="obras-sociales">
            <Layout><ObrasSociales /></Layout>
          </ProtectedRoute>
        } />
        <Route path="/presentaciones" element={
          <ProtectedRoute requiredModule="presentaciones">
            <Layout><Presentaciones /></Layout>
          </ProtectedRoute>
        } />
        <Route path="/billing" element={
          <ProtectedRoute requiredModule="billing" adminOnly={true}>
            <Layout><Billing /></Layout>
          </ProtectedRoute>
        } />
        <Route path="/plus-payments" element={
          <ProtectedRoute requiredModule="plus-payments">
            <Layout><PlusPayments /></Layout>
          </ProtectedRoute>
        } />
        <Route path="/cash-management" element={
          <ProtectedRoute requiredModule="cash-management">
            <Layout><CashManagement /></Layout>
          </ProtectedRoute>
        } />
        <Route path="/medical-records" element={
          <ProtectedRoute requiredModule="medical-records">
            <Layout><MedicalRecords /></Layout>
          </ProtectedRoute>
        } />
        <Route path="/novedades" element={
          <ProtectedRoute requiredModule="novedades">
            <Layout><Novedades /></Layout>
          </ProtectedRoute>
        } />
        <Route path="/configuracion" element={
          <ProtectedRoute requiredModule="configuracion" adminOnly={true}>
            <Layout><Configuration /></Layout>
          </ProtectedRoute>
        } />
        <Route path="/reports" element={
          <ProtectedRoute requiredModule="reports" adminOnly={true}>
            <Layout><Reports /></Layout>
          </ProtectedRoute>
        } />
        <Route path="/reports-manager" element={
          <ProtectedRoute requiredModule="reports-manager">
            <Layout><ReportsManager /></Layout>
          </ProtectedRoute>
        } />
        {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
        <Route path="*" element={<NotFound />} />
      </Routes>
    </SidebarProvider>
  </TooltipProvider>
);

export default App;
