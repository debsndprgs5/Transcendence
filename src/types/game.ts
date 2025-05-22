export interface gameRooms{
	gameID: number,
	tournamentID?:number,
	mode:string,
	rules:string,
	created_at: string
}

export interface gameMembers{
	gameID: number,
	tournamentID?: number,
	userID: number,
	alias: string
}

export interface tournaments{
	tournamentID: number,
	round: number,
	players_data: string
}

export interface userData{
	gameID:number,
	userID:number,
	mode:string,
	result:string,
	score:string,
	gameDuration:number,
	datas:string,
	created_at:string
}