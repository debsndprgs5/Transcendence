export interface chatRooms{
    roomID: number;
    ownerID: number;
}

export interface chatRoomMembers{
    roomID: number;
    userID: number;
}

export interface messages{
    roomID?: number;
    authorID: number;
    content: string;
    created_at: string;
}

export interface user_relationships{
    id:             number;
    user_id:         number;
    related_userID: number;
    type:           string;
    created_at:     string; 
}