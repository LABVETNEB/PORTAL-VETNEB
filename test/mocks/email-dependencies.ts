import type {
  EmailConfig,
  EmailDependencies,
} from "../../server/lib/email.ts";

// Double of the EmailDependencies seam (server/lib/email.ts, TEST-GLOBAL-10A).
// Owner: send*Email of server/lib/email.ts. The base config is hermetic
// (no ambient ENV); SMTP transport and fetch fail closed unless supplied.

export type EmailConfigOverrides = Partial<
  Omit<EmailConfig, "smtp" | "gmailApi">
> & {
  smtp?: Partial<EmailConfig["smtp"]>;
  gmailApi?: Partial<EmailConfig["gmailApi"]>;
};

export type EmailDependenciesFakeInput = {
  config?: EmailConfigOverrides;
  createSmtpTransport?: EmailDependencies["createSmtpTransport"];
  fetch?: EmailDependencies["fetch"];
};

export function createEmailConfig(
  overrides: EmailConfigOverrides = {},
): EmailConfig {
  return {
    isProduction: overrides.isProduction ?? false,
    contactTo: overrides.contactTo ?? [],
    publicSiteUrl: overrides.publicSiteUrl,
    corsOrigins: overrides.corsOrigins ?? [],
    smtp: {
      enabled: false,
      host: "",
      port: 587,
      secure: false,
      user: "",
      pass: "",
      from: "",
      ...overrides.smtp,
    },
    gmailApi: {
      enabled: false,
      clientId: "",
      clientSecret: "",
      refreshToken: "",
      from: "",
      ...overrides.gmailApi,
    },
  };
}

export function createEmailDependencies(
  input: EmailDependenciesFakeInput = {},
): EmailDependencies {
  return {
    config: createEmailConfig(input.config),
    createSmtpTransport:
      input.createSmtpTransport ??
      (() => {
        throw new Error("email fake: unexpected SMTP transport");
      }),
    fetch:
      input.fetch ??
      (async (url) => {
        throw new Error(`email fake: unexpected fetch ${url}`);
      }),
  };
}
