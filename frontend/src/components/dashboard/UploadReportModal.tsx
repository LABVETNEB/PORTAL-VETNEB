"use client";

import { FormEvent, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { uploadAdminReport } from "@/lib/api";

const STUDY_TYPE_OPTIONS = [
  { value: "", label: "Tipo de estudio" },
  { value: "histopathology", label: "Histopatología" },
  { value: "cytology", label: "Citología" },
  { value: "immunohistochemistry", label: "Inmunohistoquímica" },
  { value: "special_stain", label: "Tinción especial" },
];

export function UploadReportModal() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [clinicId, setClinicId] = useState("");
  const [patientName, setPatientName] = useState("");
  const [studyType, setStudyType] = useState("");
  const [uploadDate, setUploadDate] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  function resetForm() {
    setClinicId("");
    setPatientName("");
    setStudyType("");
    setUploadDate("");

    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (isSubmitting) {
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

  return (
    <div>
      <Button type="button" onClick={() => setIsOpen(true)}>
        Subir informe
      </Button>

      {isOpen ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          role="presentation"
        >
          <div
            className="w-full max-w-lg rounded-lg bg-white p-6 shadow-xl"
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
                onClick={() => setIsOpen(false)}
                disabled={isSubmitting}
              >
                Cerrar
              </Button>
            </div>

            <form className="space-y-4" onSubmit={handleSubmit}>
              <div>
                <label
                  htmlFor="upload-clinic-id"
                  className="mb-1 block text-sm font-medium text-gray-700"
                >
                  ID de clínica
                </label>
                <Input
                  id="upload-clinic-id"
                  name="clinicId"
                  type="number"
                  min="1"
                  required
                  value={clinicId}
                  onChange={(event) => setClinicId(event.target.value)}
                  disabled={isSubmitting}
                />
              </div>

              <div>
                <label
                  htmlFor="upload-file"
                  className="mb-1 block text-sm font-medium text-gray-700"
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
                  className="mb-1 block text-sm font-medium text-gray-700"
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
                  className="mb-1 block text-sm font-medium text-gray-700"
                >
                  Tipo de estudio
                </label>
                <select
                  id="upload-study-type"
                  name="studyType"
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
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
                  className="mb-1 block text-sm font-medium text-gray-700"
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
      ) : null}
    </div>
  );
}
