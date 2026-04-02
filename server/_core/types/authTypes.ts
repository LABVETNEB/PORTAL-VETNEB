export interface ExchangeTokenRequest {
  clientId: string;
  grantType: string;
  code: string;
  redirectUri: string;
}

export interface ExchangeTokenResponse {
  accessToken: string;
  expiresIn: number;
  refreshToken: string;
  tokenType: string;
}

export interface GetUserInfoResponse {
  openId: string;
  name: string;
  email: string;
  picture: string;
  platform?: string;
  loginMethod?: string;
  platforms?: string[];
}

export interface GetUserInfoWithJwtRequest {
  jwtToken: string;
  projectId: string;
}

export interface GetUserInfoWithJwtResponse extends GetUserInfoResponse {}
