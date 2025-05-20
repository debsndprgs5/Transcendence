export interface user {
    our_index: number;
    rand_id: string;
    username: string;
    password_hashed: string;
    totp_secret?: string;
    totp_pending?: string;
    avatar_url?: string;
    jwtToken: string;
    created_at: string;
  }
  