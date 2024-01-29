export interface Profile {
    address: {
        address_line1: string;
        address_line2: string;
        city: string;
        country: {
            is_eea_country: boolean;
            name: string;
        };
        postal_code: string;
        state: string;
    };
    analytics_id: string;
    culture_code: string;
    diagnostics_opt_in: boolean;
    email: string;
    first_name: string;
    last_name: string;
    mailing_list_opt_in: boolean;
    phone_number: string;
    timezone: string;
    user_id: string;
}
