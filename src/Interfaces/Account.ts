export interface Account {
    created_by: string;
    id: string;
    max_users: {
        co_owner: number;
        guest: number;
    };
    name: string;
}
