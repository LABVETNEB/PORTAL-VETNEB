"use client";

import { FormEvent, useRef, useState } from "react";
import { Check, FileUp, Loader2, Search } from "lucide-react";

import { ModuleDialog } from "@/components/dashboard/ModuleDialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  getAdminClinics,
  getAdminParticularTokens,
  uploadAdminReport,
  type AdminParticularTokenSummary,
} from "@/lib/api";
import type { AdminClinicManagementSummary } from "@/types";

const CLINIC_RESULT_LIMIT = 9;
const TOKEN_PAGE_SIZE = 100;

const STUDY_TYPE_OPTIONS = [
  { value: "histopatologia", label: "Histopatología" },
  { value: "citologia", label: "Citología" },
  { value: "hemoparasitos", label: "Hemoparásitos" },
] as const;

type UploadStep = "assignment" | "document";

type AdminReportsUploadPanelProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUploaded: (message: string) => void | Promise<void>;
};

function tokenLabel(token: AdminParticularTokenSummary) {
  const reportState = token.hasLinkedReport ? "reemplaza informe" : "sin informe";
  return `****${token.tokenLast4} · ${token.petName} · ${token.tutorLastName} · ${reportState}`;
}

export function AdminReportsUploadPanel({
  open,
  onOpenChange,
  onUploaded,
}: AdminReportsUploadPanelProps) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const clinicRequestId = useRef(0);
  const tokenRequestId = useRef(0);
  const [step, setStep] = useState<UploadStep>("assignment");
  const [clinicQuery, setClinicQuery] = useState("");
  const [clinics, setClinics] = useState<AdminClinicManagementSummary[]>([]);
  const [selectedClinic, setSelectedClinic] =
    useState<AdminClinicManagementSummary | null>(null);
  const [isSearchingClinics, setIsSearchingClinics] = useState(false);
  const [particularTokens, setParticularTokens] = useState<
    AdminParticularTokenSummary[]
  >([]);
  const [particularTokenId, setParticularTokenId] = useState("");
  const [isLoadingTokens, setIsLoadingTokens] = useState(false);
  const [selectedFileName, setSelectedFileName] = useState("");
  const [patientName, setPatientName] = useState("");
  const [studyType, setStudyType] = useState<string>(STUDY_TYPE_OPTIONS[0].value);
  const [uploadDate, setUploadDate] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  function resetForm() {
    setStep("assignment");
    setClinicQuery("");
    setClinics([]);
    setSelectedClinic(null);
    setParticularTokens([]);
    setParticularTokenId("");
    setSelectedFileName("");
    setPatientName("");
    setStudyType(STUDY_TYPE_OPTIONS[0].value);
    setUploadDate("");
    setErrorMessage(null);
    setIsSearchingClinics(false);
    setIsLoadingTokens(false);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  function handleOpenChange(nextOpen: boolean) {
    if (!nextOpen && !isSubmitting) {
      clinicRequestId.current += 1;
      tokenRequestId.current += 1;
      resetForm();
    }
    onOpenChange(nextOpen);
  }

  async function handleClinicSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const query = clinicQuery.trim();

    if (!query) {
      setClinics([]);
      setErrorMessage("Ingrese nombre, email, usuario o ID de clínica.");
      return;
    }

    const requestId = clinicRequestId.current + 1;
    clinicRequestId.current = requestId;
    setIsSearchingClinics(true);
    setErrorMessage(null);
    setSelectedClinic(null);
    setParticularTokens([]);
    setParticularTokenId("");

    try {
      const snapshot = await getAdminClinics({
        search: query,
        limit: CLINIC_RESULT_LIMIT,
        offset: 0,
      });
      if (clinicRequestId.current !== requestId) return;
      setClinics(snapshot.clinics);
      if (!snapshot.clinics.length) {
        setErrorMessage("No se encontraron clínicas con ese criterio.");
      }
    } catch (error) {
      if (clinicRequestId.current !== requestId) return;
      setClinics([]);
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "No se pudieron buscar las clínicas.",
      );
    } finally {
      if (clinicRequestId.current === requestId) setIsSearchingClinics(false);
    }
  }

  function handleClinicQueryChange(value: string) {
    clinicRequestId.current += 1;
    tokenRequestId.current += 1;
    setClinicQuery(value);
    setClinics([]);
    setSelectedClinic(null);
    setParticularTokens([]);
    setParticularTokenId("");
    setIsSearchingClinics(false);
    setIsLoadingTokens(false);
    setErrorMessage(null);
  }

  async function selectClinic(clinic: AdminClinicManagementSummary) {
    const requestId = tokenRequestId.current + 1;
    tokenRequestId.current = requestId;
    setSelectedClinic(clinic);
    setClinicQuery(clinic.clinicName);
    setClinics([clinic]);
    setParticularTokens([]);
    setParticularTokenId("");
    setIsLoadingTokens(true);
    setErrorMessage(null);

    try {
      let offset = 0;
      let count = Number.POSITIVE_INFINITY;
      const tokens: AdminParticularTokenSummary[] = [];

      while (offset < count) {
        const snapshot = await getAdminParticularTokens({
          clinicId: clinic.clinicId,
          limit: TOKEN_PAGE_SIZE,
          offset,
        });
        count = snapshot.count;
        tokens.push(...snapshot.particularTokens);
        offset += snapshot.particularTokens.length;
        if (!snapshot.particularTokens.length) break;
      }

      if (tokenRequestId.current === requestId) {
        setParticularTokens(tokens);
      }
    } catch (error) {
      if (tokenRequestId.current === requestId) {
        setErrorMessage(
          error instanceof Error
            ? error.message
            : "No se pudieron cargar los tokens de la clínica.",
        );
      }
    } finally {
      if (tokenRequestId.current === requestId) setIsLoadingTokens(false);
    }
  }

  function continueToDocument() {
    if (!selectedClinic) {
      setErrorMessage("Seleccione una clínica registrada.");
      return;
    }
    setErrorMessage(null);
    setStep("document");
  }

  async function handleUpload(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedClinic || isSubmitting) return;

    const file = fileInputRef.current?.files?.[0];
    if (!file) {
      setErrorMessage("Seleccione un archivo PDF para subir.");
      return;
    }

    const formData = new FormData();
    formData.append("clinicId", String(selectedClinic.clinicId));
    formData.append("file", file);
    if (patientName.trim()) formData.append("patientName", patientName.trim());
    formData.append("studyType", studyType);
    if (uploadDate) formData.append("uploadDate", uploadDate);
    if (particularTokenId) {
      formData.append("particularTokenId", particularTokenId);
    }

    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      const response = await uploadAdminReport(formData);
      resetForm();
      onOpenChange(false);
      await onUploaded(response.message);
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "No se pudo subir el informe. Intente nuevamente.",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <ModuleDialog
      open={open}
      onOpenChange={handleOpenChange}
      busy={isSubmitting}
      title="Subir informe"
      description={
        step === "assignment"
          ? "Paso 1 de 2 · clínica y vínculo opcional."
          : "Paso 2 de 2 · documento y datos del estudio."
      }
    >
      {step === "assignment" ? (
        <div className="space-y-3">
          <form
            className="flex items-end gap-2"
            role="search"
            aria-label="Buscar clínica para el informe"
            onSubmit={(event) => void handleClinicSearch(event)}
          >
            <label className="min-w-0 flex-1 space-y-1">
              <span className="text-xs font-medium text-vetneb-ink">Clínica</span>
              <Input
                className="h-8 text-[0.8125rem]"
                value={clinicQuery}
                onChange={(event) => handleClinicQueryChange(event.target.value)}
                placeholder="Nombre, email, usuario o ID"
                disabled={isSearchingClinics || isSubmitting}
                aria-label="Buscar clínica registrada"
              />
            </label>
            <Button
              type="submit"
              variant="outline"
              size="sm"
              className="h-8 px-3 text-xs"
              disabled={isSearchingClinics || isSubmitting}
            >
              {isSearchingClinics ? (
                <Loader2 className="animate-spin" aria-hidden="true" />
              ) : (
                <Search aria-hidden="true" />
              )}
              Buscar
            </Button>
          </form>

          {clinics.length ? (
            <div className="divide-y divide-vetneb-line/60 rounded-md border border-vetneb-line/75">
              {clinics.map((clinic) => {
                const selected = selectedClinic?.clinicId === clinic.clinicId;
                return (
                  <button
                    key={clinic.clinicId}
                    type="button"
                    className="flex min-h-8 w-full items-center gap-2 px-2.5 py-1 text-left text-xs hover:bg-accent/55"
                    onClick={() => void selectClinic(clinic)}
                    aria-pressed={selected}
                  >
                    <span className="min-w-0 flex-1 truncate font-medium">
                      {clinic.clinicName}
                    </span>
                    <span className="shrink-0 font-mono text-[0.6875rem] text-muted-foreground">
                      #{clinic.clinicId}
                    </span>
                    {selected ? (
                      <Check className="h-3.5 w-3.5 text-emerald-700" aria-hidden="true" />
                    ) : null}
                  </button>
                );
              })}
            </div>
          ) : null}

          {selectedClinic ? (
            <label className="block space-y-1">
              <span className="text-xs font-medium text-vetneb-ink">
                Token particular <span className="font-normal text-muted-foreground">(opcional)</span>
              </span>
              <select
                className="field-select h-8 text-[0.8125rem]"
                value={particularTokenId}
                onChange={(event) => {
                  setParticularTokenId(event.target.value);
                  const token = particularTokens.find(
                    (item) => String(item.id) === event.target.value,
                  );
                  if (token && !patientName.trim()) {
                    setPatientName(`${token.petName} / ${token.tutorLastName}`);
                  }
                }}
                disabled={isLoadingTokens || isSubmitting}
              >
                <option value="">
                  {isLoadingTokens ? "Cargando tokens…" : "Sin token vinculado"}
                </option>
                {particularTokens.map((token) => (
                  <option key={token.id} value={token.id}>
                    {tokenLabel(token)}
                  </option>
                ))}
              </select>
            </label>
          ) : null}

          {errorMessage ? (
            <p className="clinical-alert-error px-3 py-1.5 text-xs" role="alert">
              {errorMessage}
            </p>
          ) : null}

          <div className="flex justify-end gap-2 border-t border-vetneb-line/65 pt-3">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-8 text-xs"
              onClick={() => handleOpenChange(false)}
            >
              Cancelar
            </Button>
            <Button
              type="button"
              size="sm"
              className="h-8 text-xs"
              onClick={continueToDocument}
              disabled={!selectedClinic || isLoadingTokens}
            >
              Continuar
            </Button>
          </div>
        </div>
      ) : (
        <form className="space-y-3" onSubmit={(event) => void handleUpload(event)}>
          <div className="rounded-md border border-vetneb-line/70 bg-vetneb-surface-raised/55 px-3 py-2 text-xs">
            <span className="font-semibold">{selectedClinic?.clinicName}</span>
            <span className="text-muted-foreground">
              {particularTokenId ? " · token vinculado" : " · sin token particular"}
            </span>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <span className="text-xs font-medium text-vetneb-ink">Archivo PDF</span>
              <Input
                ref={fileInputRef}
                id="admin-report-file"
                type="file"
                accept="application/pdf"
                required
                disabled={isSubmitting}
                className="sr-only"
                onChange={(event) => {
                  setSelectedFileName(event.target.files?.[0]?.name ?? "");
                  setErrorMessage(null);
                }}
              />
              <div className="mt-1 flex h-8 items-center gap-2 rounded-md border border-vetneb-line/80 px-2.5">
                <span className="min-w-0 flex-1 truncate text-xs text-muted-foreground">
                  {selectedFileName || "Sin archivo seleccionado"}
                </span>
                <label
                  htmlFor="admin-report-file"
                  className="inline-flex h-7 cursor-pointer items-center gap-1.5 rounded-md border border-vetneb-line/80 px-2 text-xs font-semibold hover:bg-accent/60"
                >
                  <FileUp className="h-3.5 w-3.5" aria-hidden="true" />
                  Seleccionar
                </label>
              </div>
            </div>

            <label className="space-y-1">
              <span className="text-xs font-medium text-vetneb-ink">Paciente</span>
              <Input
                className="h-8 text-[0.8125rem]"
                value={patientName}
                onChange={(event) => setPatientName(event.target.value)}
                disabled={isSubmitting}
              />
            </label>

            <label className="space-y-1">
              <span className="text-xs font-medium text-vetneb-ink">Tipo de estudio</span>
              <select
                className="field-select h-8 text-[0.8125rem]"
                value={studyType}
                onChange={(event) => setStudyType(event.target.value)}
                disabled={isSubmitting}
                required
              >
                {STUDY_TYPE_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>

            <label className="space-y-1 sm:col-span-2">
              <span className="text-xs font-medium text-vetneb-ink">Fecha de carga</span>
              <Input
                className="h-8 text-[0.8125rem]"
                type="date"
                value={uploadDate}
                onChange={(event) => setUploadDate(event.target.value)}
                disabled={isSubmitting}
              />
            </label>
          </div>

          {errorMessage ? (
            <p className="clinical-alert-error px-3 py-1.5 text-xs" role="alert">
              {errorMessage}
            </p>
          ) : null}

          <div className="flex justify-end gap-2 border-t border-vetneb-line/65 pt-3">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-8 text-xs"
              onClick={() => setStep("assignment")}
              disabled={isSubmitting}
            >
              Atrás
            </Button>
            <Button
              type="submit"
              size="sm"
              className="h-8 text-xs"
              disabled={isSubmitting}
              aria-busy={isSubmitting}
            >
              {isSubmitting ? (
                <Loader2 className="animate-spin" aria-hidden="true" />
              ) : (
                <FileUp aria-hidden="true" />
              )}
              {isSubmitting ? "Subiendo…" : "Subir informe"}
            </Button>
          </div>
        </form>
      )}
    </ModuleDialog>
  );
}
