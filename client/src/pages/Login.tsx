import { useState } from "react";
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
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, AlertCircle } from "lucide-react";
import { trpc } from "@/lib/trpc";

export default function Login() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [, setLocation] = useLocation();

  const loginMutation = trpc.auth.login.useMutation({
    onSuccess: (data) => {
      if (data.success) {
        // Redirigir a la página de reportes
        setLocation("/reports");
      }
    },
    onError: (error) => {
      setError(error.message || "Error al iniciar sesión");
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!username || !password) {
      setError("Por favor completa todos los campos");
      return;
    }

    loginMutation.mutate({ username, password });
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100 p-4">
      <div className="w-full max-w-md">
        {/* Logo/Header */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-slate-900 mb-2">
            SERVICIO PATOLOGICO VETNEB
          </h1>
          <p className="text-slate-600">Gestión de Informes Veterinarios</p>
        </div>

        {/* Login Card */}
        <Card className="border-0 shadow-lg">
          <CardHeader className="space-y-2">
            <CardTitle>Iniciar Sesión</CardTitle>
            <CardDescription>
              Ingresa tus credenciales de clínica para acceder a los informes
            </CardDescription>
          </CardHeader>

          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Error Alert */}
              {error && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}

              {/* Username Input */}
              <div className="space-y-2">
                <label
                  htmlFor="username"
                  className="text-sm font-medium text-slate-700"
                >
                  Usuario
                </label>
                <Input
                  id="username"
                  type="text"
                  placeholder="Ingresa tu usuario"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  disabled={loginMutation.isPending}
                  className="h-10"
                />
              </div>

              {/* Password Input */}
              <div className="space-y-2">
                <label
                  htmlFor="password"
                  className="text-sm font-medium text-slate-700"
                >
                  Contraseña
                </label>
                <Input
                  id="password"
                  type="password"
                  placeholder="Ingresa tu contraseña"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={loginMutation.isPending}
                  className="h-10"
                />
              </div>

              {/* Submit Button */}
              <Button
                type="submit"
                disabled={loginMutation.isPending}
                className="w-full h-10 mt-6"
              >
                {loginMutation.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Iniciando sesión...
                  </>
                ) : (
                  "Iniciar Sesión"
                )}
              </Button>
            </form>

            {/* Demo Info */}
            <div className="mt-6 p-4 bg-blue-50 rounded-lg border border-blue-200">
              <p className="text-sm text-blue-900">
                <strong>Demo:</strong> Usa credenciales de prueba para acceder.
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Footer */}
        <p className="text-center text-sm text-slate-600 mt-6">
          © 2026 Portal VETNEB. Todos los derechos reservados.
        </p>
      </div>
    </div>
  );
}
