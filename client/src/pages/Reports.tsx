import { useState, useMemo } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, Download, Search, LogOut, AlertCircle } from "lucide-react";
import { trpc } from "@/lib/trpc";

export default function Reports() {
  const [, setLocation] = useLocation();
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedStudyType, setSelectedStudyType] = useState<string>("");
  const [selectedReportId, setSelectedReportId] = useState<number | null>(null);

  // Obtener usuario actual
  const { data: user } = trpc.auth.me.useQuery();

  // Obtener lista de informes
  const { data: reportsData, isLoading: reportsLoading } =
    trpc.reports.list.useQuery({
      limit: 100,
    });

  // Obtener tipos de estudio
  const { data: studyTypes = [] } = trpc.reports.getStudyTypes.useQuery();

  // Buscar informes
  const { data: searchResults } = trpc.reports.search.useQuery(
    {
      query: searchQuery,
      studyType: selectedStudyType || undefined,
      limit: 100,
    },
    { enabled: searchQuery.length > 0 || selectedStudyType.length > 0 },
  );

  // Obtener URL de descarga
  const { data: downloadData } = trpc.reports.getDownloadUrl.useQuery(
    { reportId: selectedReportId || 0 },
    { enabled: selectedReportId !== null },
  );

  // Logout
  const logoutMutation = trpc.auth.logout.useMutation({
    onSuccess: () => {
      setLocation("/");
    },
  });

  // Determinar qué informes mostrar
  const displayReports = useMemo(() => {
    if (searchQuery || selectedStudyType) {
      return searchResults?.reports || [];
    }
    return reportsData?.reports || [];
  }, [searchQuery, selectedStudyType, searchResults, reportsData]);

  const selectedReport = displayReports.find((r) => r.id === selectedReportId);

  const handleLogout = () => {
    logoutMutation.mutate();
  };

  const handleDownload = () => {
    if (downloadData?.downloadUrl) {
      window.open(downloadData.downloadUrl, "_blank");
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-slate-50">
      {/* Header */}
      <div className="bg-white border-b border-slate-200 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Portal VETNEB</h1>
            {user && (
              <p className="text-sm text-slate-600">Clínica: {user.email}</p>
            )}
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={handleLogout}
            disabled={logoutMutation.isPending}
          >
            <LogOut className="mr-2 h-4 w-4" />
            Cerrar Sesión
          </Button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Sidebar - Report List */}
        <div className="w-full md:w-80 bg-white border-r border-slate-200 flex flex-col overflow-hidden">
          {/* Search and Filters */}
          <div className="p-4 border-b border-slate-200 space-y-3">
            {/* Search Input */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-slate-400" />
              <Input
                placeholder="Buscar paciente..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 h-9"
              />
            </div>

            {/* Study Type Filter */}
            <Select
              value={selectedStudyType}
              onValueChange={setSelectedStudyType}
            >
              <SelectTrigger className="h-9">
                <SelectValue placeholder="Filtrar por tipo de estudio" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">Todos los tipos</SelectItem>
                {studyTypes.map((type) => (
                  <SelectItem key={type} value={type}>
                    {type}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Reports List */}
          <div className="flex-1 overflow-y-auto">
            {reportsLoading ? (
              <div className="flex items-center justify-center h-32">
                <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
              </div>
            ) : displayReports.length === 0 ? (
              <div className="p-4 text-center text-slate-500">
                <p className="text-sm">No se encontraron informes</p>
              </div>
            ) : (
              <div className="divide-y divide-slate-200">
                {displayReports.map((report) => (
                  <button
                    key={report.id}
                    onClick={() => setSelectedReportId(report.id)}
                    className={`w-full text-left p-3 hover:bg-slate-50 transition-colors border-l-4 ${
                      selectedReportId === report.id
                        ? "border-l-blue-500 bg-blue-50"
                        : "border-l-transparent"
                    }`}
                  >
                    <p className="font-medium text-sm text-slate-900 truncate">
                      {report.patientName || "Sin nombre"}
                    </p>
                    <p className="text-xs text-slate-600 truncate">
                      {report.studyType || "Sin tipo"}
                    </p>
                    <p className="text-xs text-slate-500">
                      {report.uploadDate
                        ? new Date(report.uploadDate).toLocaleDateString(
                            "es-ES",
                          )
                        : "Sin fecha"}
                    </p>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right Content - PDF Viewer */}
        <div className="flex-1 flex flex-col bg-slate-100 overflow-hidden">
          {selectedReport ? (
            <>
              {/* Report Info */}
              <div className="bg-white border-b border-slate-200 p-4">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <h2 className="text-lg font-semibold text-slate-900">
                      {selectedReport.patientName || "Informe sin nombre"}
                    </h2>
                    <div className="mt-2 grid grid-cols-2 gap-4 text-sm text-slate-600">
                      <div>
                        <p className="font-medium text-slate-700">
                          Tipo de Estudio
                        </p>
                        <p>{selectedReport.studyType || "No especificado"}</p>
                      </div>
                      <div>
                        <p className="font-medium text-slate-700">Fecha</p>
                        <p>
                          {selectedReport.uploadDate
                            ? new Date(
                                selectedReport.uploadDate,
                              ).toLocaleDateString("es-ES")
                            : "No especificada"}
                        </p>
                      </div>
                      <div className="col-span-2">
                        <p className="font-medium text-slate-700">Archivo</p>
                        <p className="truncate">
                          {selectedReport.fileName || "Sin nombre"}
                        </p>
                      </div>
                    </div>
                  </div>
                  <Button
                    onClick={handleDownload}
                    disabled={!downloadData?.downloadUrl}
                    size="sm"
                    className="ml-4"
                  >
                    <Download className="mr-2 h-4 w-4" />
                    Descargar
                  </Button>
                </div>
              </div>

              {/* PDF Viewer */}
              <div className="flex-1 overflow-hidden bg-slate-200 flex items-center justify-center">
                {selectedReport.previewUrl ? (
                  <iframe
                    src={selectedReport.previewUrl}
                    className="w-full h-full border-none"
                    title="PDF Viewer"
                  />
                ) : (
                  <Alert className="m-4 max-w-md">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>
                      No se puede visualizar el PDF. Descárgalo para verlo.
                    </AlertDescription>
                  </Alert>
                )}
              </div>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center">
                <p className="text-slate-500 text-lg">
                  Selecciona un informe para visualizarlo
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
