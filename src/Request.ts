import { ALPNProtocol, FetchError, Headers, Request, RequestOptions, Response, context } from "@adobe/fetch";
import { configuration } from "./Configuration";

const regions = ["", "east", "west"];
const { fetch } = context({ alpnProtocols: [ALPNProtocol.ALPN_HTTP2], userAgent: "" });

let region: number = 0;
let status: number = 0;

function headers(authorization: string | undefined, existing?: Record<string, string>): Record<string, string> {
    return {
        "Accept-Encoding": "gzip",
        "App-Version": configuration.app_version,
        Authorization: authorization || "",
        BrandId: "1",
        MyQApplicationId: configuration.app_id,
        "User-Agent": configuration.user_agent,
        ...existing,
    };
}

async function request(authorization: string | undefined, url: string, options?: RequestOptions, decode?: boolean, retries?: number): Promise<Response | null> {
    const retrieveUrl = new URL(url);
    const hostname = retrieveUrl.hostname.split(".");
    const regionRegex = new RegExp("^.*-(" + regions.join("|") + ")$");

    if (!regionRegex.test(hostname[0])) {
        if (retries) {
            region = ++region % regions.length;
        }

        hostname[0] += region ? "-" + regions[region] : "";
    }

    retrieveUrl.hostname = hostname.join(".");

    const isRedirect = (code: number): boolean => [301, 302, 303, 307, 308].includes(code);
    const isCredentialsIssue = (code: number): boolean => [400, 401].includes(code);
    const isServerSideIssue = (code: number): boolean => [429, 500, 502, 503, 504, 521, 522].includes(code);

    const retry = async (): Promise<Response | null> => {
        if (retries || 0 < 3) {
            return request(authorization, url, options, decode, (retries || 0) + 1);
        }

        return null;
    };

    let response: Response;

    status = 0;

    try {
        response = await fetch(retrieveUrl.toString(), options != null ? options : { headers: headers(authorization!) });

        status = response.status;

        if (decode === false || response.ok || isRedirect(response.status)) {
            return response;
        }

        if (isCredentialsIssue(response.status)) {
            return retry();
        }

        if (response.status === 403) {
            return null;
        }

        if (isServerSideIssue(response.status)) {
            return retry();
        }

        return null;
    } catch (error) {
        return retry();
    }
}

export { headers, fetch, request, status, FetchError, Headers, Request, RequestOptions, Response };
