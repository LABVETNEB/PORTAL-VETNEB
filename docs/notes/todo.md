# Portal VETNEB - TODO

## Autenticación y Autorización

- [x] Sistema de login con credenciales de clínica (usuario/contraseña)
- [x] Validación de credenciales contra base de datos local
- [x] Generación de token de sesión y almacenamiento en SESIONES_ACTIVAS
- [x] Protección de rutas y procedimientos tRPC con autenticación
- [x] Logout y limpieza de sesión

## Integración con Google Sheets

- [x] Opción 1: Sincronización automática mediante Google Sheets API (sin credenciales)
- [x] Opción 2: Carga manual de datos desde archivos Excel/CSV
- [x] Sincronización de datos de CONTROL_CLINICAS (clínicas y usuarios)
- [x] Sincronización de datos de REGISTRO_INFORMES (informes médicos)
- [x] Endpoint para cargar datos manualmente
- [ ] Función de actualización periódica de datos
- [ ] Sincronización de SESIONES_ACTIVAS (tokens activos)

## Base de Datos

- [x] Crear tabla de clínicas (clinics)
- [x] Crear tabla de usuarios/credenciales (clinic_users)
- [x] Crear tabla de informes (reports)
- [x] Crear tabla de sesiones activas (active_sessions)
- [ ] Índices para búsqueda rápida

## API y Procedimientos tRPC

- [x] Procedimiento de login (validar credenciales)
- [x] Procedimiento de logout
- [x] Procedimiento para obtener informes por clínica
- [x] Procedimiento para buscar/filtrar informes
- [x] Procedimiento para obtener URL de descarga de archivo
- [x] Procedimiento para sincronizar datos de Google Sheets

## Interfaz de Usuario

- [x] Layout de una sola página con panel lateral y área principal
- [x] Componente de login/autenticación
- [x] Panel lateral con lista de informes
- [x] Área principal con visor de PDF
- [x] Barra de búsqueda y filtros
- [x] Indicadores de carga y estados
- [x] Diseño responsivo (mobile, tablet, desktop)

## Visor de PDF y Descargas

- [x] Integración de iframe para visualizar PDFs desde Google Drive
- [x] Función de descarga directa de archivos
- [x] Manejo de errores en carga de PDFs
- [ ] Indicador de progreso de carga

## Búsqueda y Filtrado

- [x] Búsqueda por nombre de paciente
- [x] Filtro por tipo de estudio
- [ ] Filtro por fecha de subida
- [x] Búsqueda en tiempo real
- [x] Ordenamiento de resultados

## Pruebas

- [x] Pruebas unitarias de procedimientos tRPC
- [x] Pruebas de autenticación
- [ ] Pruebas de filtrado y búsqueda
- [ ] Pruebas de integración con Google Sheets

## Despliegue y Entrega

- [ ] Verificar funcionamiento en navegador
- [ ] Documentación de uso
- [ ] Instrucciones de configuración

## Logística operativa

- [x] Definir contrato de dominio MVP de logística (`docs/logistics/MVP_DOMAIN.md`)
- [x] Definir contrato de seguridad logística (`docs/logistics/SECURITY_CONTRACT.md`)
- [x] Definir roadmap incremental de logística (`docs/logistics/ROLLING_ROADMAP.md`)
- [x] Implementar modelo base de visitas de campo (`field_visits`)
- [x] Implementar ubicaciones de visita (`visit_locations`)
- [x] Implementar ventanas horarias (`time_windows`)
- [x] Implementar planes de ruta y paradas (`route_plans`, `route_stops`)
- [x] Implementar modelo de eventos logísticos (`route_events`)
- [x] Implementar SLA básico (`sla_policies`, `sla_instances`)
- [x] Implementar métricas básicas de cumplimiento
- [ ] Implementar API de visitas de campo y ventanas horarias
- [ ] Implementar API de planes de ruta y ciclo de release
- [ ] Implementar API de eventos logísticos y polling incremental
- [ ] Evaluar heurística determinista simple
- [ ] Evaluar optimización avanzada solo con volumen/ROI justificado
