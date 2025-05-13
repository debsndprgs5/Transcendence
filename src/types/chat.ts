export interface rooms{
    roomID: number;
    ownerID: number;
}

export interface roomMembers{
    roomID: number;
    userID: number;
}

export interface meesages{
    roomID?: number;
    authorID: number;
    content: string;
    created_at: string;
}