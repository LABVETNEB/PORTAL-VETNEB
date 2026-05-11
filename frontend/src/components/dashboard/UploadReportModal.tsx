"use client";

import { FormEvent, useRef, useState } from "react";
import { useEffect } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { uploadAdminReport } from "@/lib/api";
import { getAdminUsersRoles } from "@/lib/api";

type ClinicOption = {
  id: number;
  name: string;
  usernames: string[];
};

const STUDY_TYPE_OPTIONS = [
  { value: "", label: "Tipo de estudio" },
  { value: "histopathology", label: "Histopatología" },
  { value: "cytology", label: "Citología" },
  { value: "immunohistochemistry", label: "Inmunohistoquímica" },
  { value: "special_stain", label: "Hematología" },
];

function normalizeSearchText(value: string) {
  return value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .trim();
}

function buildClinicSearchText(option: ClinicOption) {
  return normalizeSearchText(
    [
      option.id,
      option.name,
      ...option.usernames,
    ].join(" "),
  );
}

function matchClinicOption(option: ClinicOption, query: string) {
  const normalizedQuery = normalizeSearchText(query);

  if (!normalizedQuery) {
    return true;
  }

  const searchable = buildClinicSearchText(option);
  const tokens = normalizedQuery.split(/\s+/).filter(Boolean);

  return tokens.every((token) => searchable.includes(token));
}

function sortClinicOptions(a: ClinicOption, b: ClinicOption) {
  return a.name.localeCompare(b.name, "es", { sensitivity: "base" });
}

function dedupeClinicOptions(options: ClinicOption[]) {
  const byId = new Map<number, ClinicOption>();

  for (const option of options) {
    const current = byId.get(option.id);

    if (!current) {
      byId.set(option.id, {
        ...option,
        usernames: [...option.usernames],
      });
      continue;
    }

    byId.set(option.id, {
      ...current,
      name: current.name || option.name,
      usernames: Array.from(
        new Set([...current.usernames, ...option.usernames]),
      ).sort((a, b) => a.localeCompare(b, "es", { sensitivity: "base" })),
    });
  }

  return Array.from(byId.values()).sort(sortClinicOptions);
}

export function UploadReportModal() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [isMounted, setIsMounted] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [clinicId, setClinicId] = useState("");
  const [clinicSearch, setClinicSearch] = useState("");
  const [clinicOptions, setClinicOptions] = useState<ClinicOption[]>([]);
  const [isLoadingClinics, setIsLoadingClinics] = useState(false);
  const [clinicLoadError, setClinicLoadError] = useState<string | null>(null);
  const [patientName, setPatientName] = useState("");
  const [studyType, setStudyType] = useState("");
  const [uploadDate, setUploadDate] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const selectedClinic = clinicOptions.find(
    (option) => String(option.id) === clinicId,
  );

  const filteredClinicOptions = clinicOptions
    .filter((option) => matchClinicOption(option, clinicSearch))
    .slice(0, 20);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  useEffect(() => {
    if (!isOpen || clinicOptions.length > 0 || isLoadingClinics) {
      return;
    }

    let cancelled = false;

    async function loadClinicOptions() {
      setIsLoadingClinics(true);
      setClinicLoadError(null);

      try {
        const limit = 100;
        let offset = 0;
        let total = Number.POSITIVE_INFINITY;
        const options: ClinicOption[] = [];

        while (offset < total) {
          const snapshot = await getAdminUsersRoles({
            userType: "clinic",
            limit,
            offset,
          });

          total = snapshot.total;

          for (const user of snapshot.users) {
            if (user.userType !== "clinic") {
              continue;
            }

            options.push({
              id: user.clinicId,
              name: user.clinicName ?? `Clínica #${user.clinicId}`,
              usernames: [user.username],
            });
          }

          offset += snapshot.users.length;

          if (snapshot.users.length === 0) {
            break;
          }
        }

        if (!cancelled) {
          setClinicOptions(dedupeClinicOptions(options));
        }
      } catch (error) {
        if (!cancelled) {
          setClinicLoadError(
            error instanceof Error
              ? error.message
              : "No se pudieron cargar las clínicas registradas.",
          );
        }
      } finally {
        if (!cancelled) {
          setIsLoadingClinics(false);
        }
      }
    }

    void loadClinicOptions();

    return () => {
      cancelled = true;
    };
  }, [clinicOptions.length, isLoadingClinics, isOpen]);

  function resetForm() {
    setClinicId("");
    setClinicSearch("");
    setPatientName("");
    setStudyType("");
    setUploadDate("");

    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }

  function closeModal() {
    if (isSubmitting) {
      return;
    }

    setIsOpen(false);
    setErrorMessage(null);
    setSuccessMessage(null);
  }

  function selectClinic(option: ClinicOption) {
    setClinicId(String(option.id));
    setClinicSearch(option.name);
    setErrorMessage(null);
  }

  function handleClinicSearchChange(value: string) {
    setClinicSearch(value);
    setClinicId("");
    setErrorMessage(null);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (isSubmitting) {
      return;
    }

    if (!clinicId || !selectedClinic) {
      setErrorMessage("Seleccione una clínica registrada del listado.");
      return;
    }

    const file = fileInputRef.current?.files?.[0];

    if (!file) {
      setErrorMessage("Seleccione un archivo PDF para subir.");
      return;
    }

    setErrorMessage(null);
    setSuccessMessage(null);
    setIsSubmitting(true);

    const formData = new FormData();
    formData.append("clinicId", clinicId);
    formData.append("file", file);

    if (patientName.trim()) {
      formData.append("patientName", patientName.trim());
    }

    if (studyType) {
      formData.append("studyType", studyType);
    }

    if (uploadDate) {
      formData.append("uploadDate", uploadDate);
    }

    try {
      const response = await uploadAdminReport(formData);
      setSuccessMessage(response.message);
      resetForm();
      router.refresh();
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

  const modal = isOpen ? (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm"
      role="presentation"
    >
      <div
        className="relative z-[10000] w-full max-w-lg rounded-2xl border border-white/80 bg-white p-6 text-slate-950 shadow-[0_32px_120px_rgba(2,6,23,0.42)]"
        role="dialog"
        aria-modal="true"
        aria-labelledby="upload-report-title"
      >
        <div className="mb-4 flex items-start justify-between gap-4">
          <div>
            <h2
              id="upload-report-title"
              className="text-lg font-semibold text-gray-900"
            >
              Subir informe
            </h2>
            <p className="text-sm text-gray-500">
              Cargue un PDF y asócielo a una clínica.
            </p>
          </div>
          <Button
            type="button"
            variant="outline"
            onClick={closeModal}
            disabled={isSubmitting}
          >
            Cerrar
          </Button>
        </div>

        <form className="space-y-4" onSubmit={handleSubmit}>
          <div>
            <label
              htmlFor="upload-clinic-search"
              className="field-label"
            >
              Clínica
            </label>
            <Input
              id="upload-clinic-search"
              name="clinicSearch"
              type="text"
              placeholder="Buscar clínica registrada por nombre, usuario o ID..."
              autoComplete="off"
              required
              value={clinicSearch}
              onChange={(event) => handleClinicSearchChange(event.target.value)}
              disabled={isSubmitting}
              aria-describedby="upload-clinic-help"
            />
            <input
              id="upload-clinic-id"
              name="clinicId"
              type="hidden"
              value={clinicId}
              readOnly
            />
            <p id="upload-clinic-help" className="mt-1 text-xs text-gray-500">
              Seleccione una clínica del listado desplegado. La búsqueda admite
              texto parcial, acentos, ID y usuarios asociados.
            </p>

            {clinicLoadError ? (
              <p
                className="mt-2 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700"
                role="alert"
              >
                {clinicLoadError}
              </p>
            ) : null}

            <div
              className="mt-2 max-h-44 overflow-y-auto rounded-xl border border-slate-200 bg-white shadow-sm"
              role="listbox"
              aria-label="Clínicas registradas"
            >
              {isLoadingClinics ? (
                <p className="px-3 py-2 text-sm text-gray-500">
                  Cargando clínicas registradas...
                </p>
              ) : null}

              {!isLoadingClinics && filteredClinicOptions.length === 0 ? (
                <p className="px-3 py-2 text-sm text-gray-500">
                  No hay clínicas registradas que coincidan con la búsqueda.
                </p>
              ) : null}

              {!isLoadingClinics
                ? filteredClinicOptions.map((option) => (
                    <button
                      key={option.id}
                      type="button"
                      className={`flex w-full items-center justify-between gap-3 px-3 py-2 text-left text-sm transition hover:bg-blue-50 ${
                        String(option.id) === clinicId
                          ? "bg-blue-50 text-blue-800"
                          : "text-gray-700"
                      }`}
                      onClick={() => selectClinic(option)}
                      disabled={isSubmitting}
                      role="option"
                      aria-selected={String(option.id) === clinicId}
                    >
                      <span className="min-w-0">
                        <span className="block truncate font-medium">
                          {option.name}
                        </span>
                        <span className="block truncate text-xs text-gray-500">
                          ID #{option.id}
                          {option.usernames.length
                            ? ` · ${option.usernames.join(", ")}`
                            : ""}
                        </span>
                      </span>
                      {String(option.id) === clinicId ? (
                        <span className="shrink-0 rounded-full bg-blue-100 px-2 py-0.5 text-xs font-semibold text-blue-700">
                          Seleccionada
                        </span>
                      ) : null}
                    </button>
                  ))
                : null}
            </div>
          </div>

          <div>
            <label
              htmlFor="upload-file"
              className="field-label"
            >
              Archivo PDF
            </label>
            <Input
              id="upload-file"
              name="file"
              type="file"
              accept="application/pdf"
              ref={fileInputRef}
              required
              disabled={isSubmitting}
            />
          </div>

          <div>
            <label
              htmlFor="upload-patient-name"
              className="field-label"
            >
              Paciente
            </label>
            <Input
              id="upload-patient-name"
              name="patientName"
              type="text"
              value={patientName}
              onChange={(event) => setPatientName(event.target.value)}
              disabled={isSubmitting}
            />
          </div>

          <div>
            <label
              htmlFor="upload-study-type"
              className="field-label"
            >
              Tipo de estudio
            </label>
            <select
              id="upload-study-type"
              name="studyType"
              className="field-select"
              value={studyType}
              onChange={(event) => setStudyType(event.target.value)}
              disabled={isSubmitting}
            >
              {STUDY_TYPE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label
              htmlFor="upload-date"
              className="field-label"
            >
              Fecha de carga
            </label>
            <Input
              id="upload-date"
              name="uploadDate"
              type="date"
              value={uploadDate}
              onChange={(event) => setUploadDate(event.target.value)}
              disabled={isSubmitting}
            />
          </div>

          {errorMessage ? (
            <p
              className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700"
              role="alert"
            >
              {errorMessage}
            </p>
          ) : null}

          {successMessage ? (
            <p className="rounded-md border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-700">
              {successMessage}
            </p>
          ) : null}

          <Button type="submit" className="w-full" disabled={isSubmitting}>
            {isSubmitting ? "Subiendo informe..." : "Subir informe"}
          </Button>
        </form>
      </div>
    </div>
  ) : null;

  return (
    <div>
      <Button type="button" onClick={() => setIsOpen(true)}>
        Subir informe
      </Button>

      {isMounted && modal ? createPortal(modal, document.body) : null}
    </div>
  );
}