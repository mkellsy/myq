import { configuration } from "./Configuration";
import { request } from "./Request";

import { Account } from "./Interfaces/Account";
import { Authentication } from "./Authentication";
import { Device, deviceMap } from "./Interfaces/Device";

export class Connection {
    private auth?: Authentication;

    public async authenticate(email: string, password: string): Promise<void> {
        this.auth = new Authentication(email, password);

        await this.auth.login();
    }

    public get accounts(): string[] {
        if (this.auth == null) {
            return [];
        }

        return [...this.auth.account.keys()];
    }

    public account(id: string): Account | undefined {
        if (this.auth == null) {
            return undefined;
        }

        return this.auth.account.get(id);
    }

    public async read<T>(url: string): Promise<T> {
        await this.auth?.refresh();

        if (!this.auth?.token == null) {
            throw new Error("Not authenticated");
        }

        const response = await request(this.auth?.token, `https://devices.myq-cloud.com/api/v5.2${url}`);
        const body = response != null ? await response.json() : undefined;

        if (body == null) {
            throw new Error(`${url} no body`);
        }

        return body as T;
    }

    public async command(device: Device, command: string): Promise<void> {
        await this.auth?.refresh();

        const host = deviceMap[device.device_family] != null
            ? deviceMap[device.device_family].host
            : deviceMap.default.host;

        const path = deviceMap[device.device_family] != null
            ? deviceMap[device.device_family].path
            : deviceMap.default.path;

        const response = await request(
            this.auth?.token,
            `https://account-devices-${host}.myq-cloud.com/api/v5.2/Accounts/${device.account_id}/${path}/${device.serial_number}/${command}`,
            { headers: this.headers(), method: "PUT" }
        );

        if (!response) {
            throw new Error("Command failed");
        }
    }

    private headers(headers?: Record<string, string>): Record<string, string> {
        return Object.assign(
            {
                "Accept-Encoding": "gzip",
                "App-Version": configuration.app_version,
                Authorization: this.auth?.token,
                BrandId: "1",
                MyQApplicationId: configuration.app_id,
                "User-Agent": configuration.user_agent,
            },
            headers
        );
    }
}
