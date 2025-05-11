export interface user {
    our_index: number;
    rand_id: string;
    username: string;
    email: string;
    password_hashed: string;
    totp_secret?: string;
    created_at: string;
  }
  