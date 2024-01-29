import pkce from "pkce-challenge";

import { parse } from "node-html-parser";

import { configuration } from "./Configuration";
import { headers, request, Headers, Response } from "./Request";
import { Account } from "./Interfaces/Account";
import { Token } from "./Interfaces/Token";

export class Authentication {
    private readonly username: string;
    private readonly password: string;

    private tokens?: Token;
    private timeout?: NodeJS.Timeout;

    private accounts: Map<string, Account> = new Map();

    constructor (username: string, password: string) {
        this.username = username;
        this.password = password;
    }

    public get token(): string | undefined {
        return (this.tokens || {}).access_token;
    }

    public async login(): Promise<Token | undefined> {
        if (this.tokens) {
            this.tokens = undefined;
        }

        if (this.timeout) {
            clearTimeout(this.timeout);
            this.timeout = undefined;
        }

        const challenge = await pkce();
        const auth = await this.authorize(challenge.code_challenge);

        if (!auth) {
            return;
        }

        const login = await this.oauth(auth);

        if (!login) {
            return;
        }

        const redirect = await this.redirect(login);

        if (!redirect) {
            return;
        }

        const url = new URL(redirect.headers.get("location") ?? "");

        const requestBody = new URLSearchParams({
            client_id: configuration.client_id,
            code: url.searchParams.get("code") as string,
            code_verifier: challenge.code_verifier,
            grant_type: "authorization_code",
            redirect_uri: configuration.redirect_uri,
            scope: configuration.api_scope,
        });

        const response = await request(this.token, "https://partner-identity.myq-cloud.com/connect/tokens", {
            body: requestBody.toString(),
            headers: headers(this.token, { "Content-Type": "application/x-www-form-urlencoded" }),
            method: "POST",
        });

        if (!response) {
            return;
        }

        const tokens = (await response.json()) as Token;

        tokens.access_token = `${tokens.token_type} ${tokens.access_token}`;
        tokens.scope = url.searchParams.get("scope") ?? "";

        if (this.timeout) {
            clearTimeout(this.timeout);
            this.timeout = undefined;
        }

        this.timeout = setTimeout(() => void this.refresh(), (tokens.expires_in - 3 * 60) * 1000);

        const accounts = await this.getAccounts();

        for (const account of accounts) {
            this.accounts.set(account.id, account);
        }

        return tokens;
    }

    public logout(): void {
        this.tokens = undefined;
    }

    public get account(): Map<string, Account> {
        return this.accounts;
    }

    public async refresh(): Promise<boolean> {
        if (this.tokens != null) {
            const requestBody = new URLSearchParams({
                client_id: configuration.client_id,
                client_secret: Buffer.from(configuration.client_secret, "base64").toString(),
                grant_type: "refresh_token",
                redirect_uri: configuration.redirect_uri,
                refresh_token: this.tokens?.refresh_token || "",
                scope: this.tokens?.scope || "",
            });

            const response = await request(undefined, "https://partner-identity.myq-cloud.com/connect/tokens", {
                body: requestBody.toString(),
                headers: {
                    "Accept-Encoding": "gzip",
                    "App-Version": configuration.app_version,
                    Authorization: "Bearer old-tokens",
                    BrandId: "1",
                    MyQApplicationId: configuration.app_id,
                    "User-Agent": configuration.user_agent,
                    "Content-Type": "application/x-www-form-urlencoded",
                    isRefresh: "true",
                },
                method: "POST",
            });

            if (!response) {
                return false;
            }

            const tokens = (await response.json()) as Token;

            tokens.access_token = `${tokens.token_type} ${tokens.access_token}`;
            tokens.scope = (tokens.scope ?? this.tokens?.scope) || "";

            if (this.timeout) {
                clearTimeout(this.timeout);
                this.timeout = undefined;
            }

            this.timeout = setTimeout(() => void this.refresh(), (tokens.expires_in - 3 * 60) * 1000);
            this.tokens = tokens;

            return this.tokens != null;
        }

        this.tokens = await this.login();

        return this.tokens != null;
    }

    private async getAccounts(): Promise<Account[]> {
        const response = await request(this.token, "https://accounts.myq-cloud.com/api/v6.0/accounts");

        if (!response) {
            return [];
        }

        const data = ((await response.json()) || {}) as { accounts: Account[] };

        if (data.accounts == null) {
            return [];
        }

        return data.accounts;
    }

    private async oauth(authPage: Response): Promise<Response | null> {
        if (!this.username || !this.password) {
            return null;
        }

        const htmlText = await authPage.text();
        const loginPageHtml = parse(htmlText);

        const requestVerificationToken = loginPageHtml
            .querySelector("input[name=__RequestVerificationToken]")
            ?.getAttribute("value") as string;

        if (!requestVerificationToken) {
            return null;
        }

        const loginBody = new URLSearchParams({
            Email: this.username,
            Password: this.password,
            UnifiedFlowRequested: "True",
            __RequestVerificationToken: requestVerificationToken,
            brand: "myq",
        });

        const response = await request(this.token, authPage.url, {
            body: loginBody.toString(),
            headers: {
                "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.9",
                "Accept-Encoding": "gzip, deflate, br",
                "Accept-Language": "en-US,en;q=0.9",
                "User-Agent": configuration.auth_user_agent,
                "sec-fetch-dest": "document",
                "sec-fetch-mode": "navigate",
                "sec-fetch-site": "same-origin",
                "upgrade-insecure-requests": "1",
                "Content-Type": "application/x-www-form-urlencoded",
                Cookie: this.cookies(authPage.headers),
                "cache-control": "max-age=0",
                origin: "null",
                "sec-fetch-user": "?1",
            },
            method: "POST",
            redirect: "manual",
        });

        if (!response || !response.headers) {
            return null;
        }

        if (!response.headers.raw()["set-cookie"] || response.headers.raw()["set-cookie"].length < 2) {
            return null;
        }

        return response;
    }

    private cookies(headers: Headers): string {
        let cookies = headers.raw().cookie ?? [];
        let setCookies = headers.raw()["set-cookie"] ?? [];

        if (!Array.isArray(cookies)) {
            cookies = [cookies];
        }

        if (!Array.isArray(setCookies)) {
            setCookies = [setCookies];
        }

        return cookies
            .concat(setCookies)
            .map((x) => x.split(";")[0])
            .join("; ");
    }

    private async authorize(challenge: string): Promise<Response | null> {
        const authEndpoint = new URL("https://partner-identity.myq-cloud.com/connect/authorize");

        authEndpoint.searchParams.set("acr_values", encodeURIComponent("unified_flow:v1  brand:myq"));
        authEndpoint.searchParams.set("client_id", configuration.client_id);
        authEndpoint.searchParams.set("code_challenge", challenge);
        authEndpoint.searchParams.set("code_challenge_method", "S256");
        authEndpoint.searchParams.set("prompt", "login");
        authEndpoint.searchParams.set("ui_locales", "en-US");
        authEndpoint.searchParams.set("redirect_uri", configuration.redirect_uri);
        authEndpoint.searchParams.set("response_type", "code");
        authEndpoint.searchParams.set("scope", configuration.api_scope);

        const response = await request(this.token, authEndpoint.toString(), {
            headers: {
                Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.9",
                "Accept-Encoding": "gzip, deflate, br",
                "Accept-Language": "en-US,en;q=0.9",
                "User-Agent": configuration.auth_user_agent,
                "sec-fetch-dest": "document",
                "sec-fetch-mode": "navigate",
                "sec-fetch-site": "none",
                "upgrade-insecure-requests": "1",
            },
            redirect: "manual",
        });

        if (!response) {
            return null;
        }

        if (!response.headers.raw()["set-cookie"] || response.headers.raw()["set-cookie"].length < 3) {
            return null;
        }

        const redirectUrl = new URL(response.headers.get("location") as string, response.url);

        return request(this.token, redirectUrl.toString(), {
            headers: {
                Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.9",
                "Accept-Encoding": "gzip, deflate, br",
                "Accept-Language": "en-US,en;q=0.9",
                "User-Agent": configuration.auth_user_agent,
                "sec-fetch-dest": "document",
                "sec-fetch-mode": "navigate",
                "sec-fetch-site": "none",
                "upgrade-insecure-requests": "1",
                Cookie: this.cookies(response.headers),
            }
        });
    }

    private async redirect(loginResponse: Response): Promise<Response | null> {
        const redirectUrl = new URL(loginResponse.headers.get("location") as string, loginResponse.url);

        const response = await request(this.token, redirectUrl.toString(), {
            headers: {
                "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.9",
                "Accept-Encoding": "gzip, deflate, br",
                "Accept-Language": "en-US,en;q=0.9",
                "User-Agent": configuration.auth_user_agent,
                "sec-fetch-dest": "document",
                "sec-fetch-mode": "navigate",
                "sec-fetch-site": "same-origin",
                "upgrade-insecure-requests": "1",
                Cookie: this.cookies(loginResponse.headers),
                "cache-control": "max-age=0",
                origin: "null",
                "sec-fetch-user": "?1",
            },
            redirect: "manual",
        });

        if (!response) {
            return null;
        }

        return response;
    }
}
