"use server";

import { cookies } from "next/headers";
import {
  getReportsPaginated,
  searchReportsPaginated,
  type PaginatedReports,
} from "@/lib/api";
import { redirectToLoginOnUnauthorized } from "@/lib/dashboard-server-auth";

export type InformesPageQuery = {
  query?: string;
  status?: string;
  studyType?: string;
  page: number;
  pageSize: number;
};

export type InformesPageResult = {
  reports: PaginatedReports["reports"];
  total: number;
  totalPages: number;
  loadError: boolean;
};

async function getInformesRequestOptions(): Promise<RequestInit> {
  const cookieHeader = (await cookies()).toString();

  return {
    cache: "no-store",
    headers: cookieHeader ? { Cookie: cookieHeader } : {},
  };
}

export async function getInformesPage(
  query: InformesPageQuery,
): Promise<InformesPageResult> {
  const requestOptions = await getInformesRequestOptions();

  try {
    const pagedResult = query.query
      ? await searchReportsPaginated(
          {
            query: query.query,
            status: query.status || undefined,
            studyType: query.studyType || undefined,
            page: query.page,
            pageSize: query.pageSize,
          },
          requestOptions,
          { throwOnError: true },
        )
      : await getReportsPaginated(
          requestOptions,
          {
            status: query.status || undefined,
            page: query.page,
            pageSize: query.pageSize,
          },
          { throwOnError: true },
        );

    return {
      reports: pagedResult.reports,
      total: pagedResult.total,
      totalPages: pagedResult.totalPages,
      loadError: false,
    };
  } catch (error) {
    redirectToLoginOnUnauthorized(error);
    return { reports: [], total: 0, totalPages: 0, loadError: true };
  }
}
