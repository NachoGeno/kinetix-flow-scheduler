import { DashboardCards } from "@/components/dashboard/DashboardCards";
import { RecentActivity } from "@/components/dashboard/RecentActivity";
import { QuickActions } from "@/components/dashboard/QuickActions";
import PendingProgressNotes from "@/components/dashboard/PendingProgressNotes";

const Index = () => {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-foreground mb-2">
          Dashboard
        </h1>
        <p className="text-muted-foreground">
          Bienvenido al sistema de gestión médica
        </p>
      </div>

      {/* Stats Cards */}
      <DashboardCards />

      {/* Pending Progress Notes (for doctors) */}
      <PendingProgressNotes />

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <RecentActivity />
        </div>
        <div className="lg:col-span-1">
          <QuickActions />
        </div>
      </div>
    </div>
  );
};

export default Index;
