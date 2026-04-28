export type NextFunction = (error?: unknown) => void;

export type Request = {
  method: string;
  originalUrl: string;
  url: string;
  ip: string;
  headers: Record<string, string | string[] | undefined>;
  cookies?: Record<string, string | undefined>;
  body?: any;
  query?: Record<string, unknown>;
  params?: Record<string, string | undefined>;
  requestId?: string;
  auth?: any;
  adminAuth?: any;
  particularAuth?: any;
  [key: string]: any;
};

export type Response = {
  statusCode: number;
  status: (code: number) => Response;
  json: (body: unknown) => Response;
  cookie: (name: string, value: string, options?: Record<string, unknown>) => Response;
  clearCookie: (name: string, options?: Record<string, unknown>) => Response;
  setHeader: (name: string, value: string | number | readonly string[]) => Response;
  on: (event: string, listener: () => void) => Response;
  end: (...args: unknown[]) => Response;
  [key: string]: any;
};

export type RequestHandler = (
  req: Request,
  res: Response,
  next: NextFunction,
) => unknown;
