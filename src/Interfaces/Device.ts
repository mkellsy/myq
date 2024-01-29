export interface Device {
    account_id: string;
    created_date: string;
    device_family: string;
    device_model: string;
    device_platform: string;
    device_type: string;
    href: string;
    name: string;
    parent_device_id: string;
    serial_number: string;
    state: {
        attached_work_light_error_present: boolean;
        aux_relay_behavior: string;
        aux_relay_delay: string;
        close: string;
        command_channel_report_status: boolean;
        control_from_browser: boolean;
        door_ajar_interval: string;
        door_state: string;
        dps_low_battery_mode: boolean;
        firmware_version: string;
        gdo_lock_connected: boolean;
        homekit_capable: boolean;
        homekit_enabled: boolean;
        invalid_credential_window: string;
        invalid_shutout_period: string;
        is_unattended_close_allowed: boolean;
        is_unattended_open_allowed: boolean;
        lamp_state: string;
        lamp_subtype: string;
        last_event: string;
        last_status: string;
        last_update: string;
        learn: string;
        learn_mode: boolean;
        light_state: string;
        links: {
            events: string;
            stream: string;
        };
        max_invalid_attempts: number;
        online: boolean;
        online_change_time: string;
        open: string;
        passthrough_interval: string;
        pending_bootload_abandoned: boolean;
        physical_devices: [];
        report_ajar: boolean;
        report_forced: boolean;
        rex_fires_door: boolean;
        servers: string;
        updated_date: string;
        use_aux_relay: boolean;
    };
}

export const deviceMap: Record<string, { host: string; path: string }> = {
    default: { host: "gdo", path: "door_openers" },
    garagedoor: { host: "gdo", path: "door_openers" },
    lamp: { host: "lamp", path: "lamps" },
};
