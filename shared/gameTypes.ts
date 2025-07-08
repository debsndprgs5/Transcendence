import { createTypedEventSocket } from './gameEventWrapper';

// Single source of truth for TypedSocket type
export type TypedSocket = ReturnType<typeof createTypedEventSocket>;

export interface tournamentInterface{
	tourID:number,
	maxPlayers:number,
	currentRound:number,
	maxRound:number,
	//score:string{pos:1{username: , userID: , score: } pos:2{}....}
}


export type PreferencesRow = {
	userID: number;
	camera_mode: string;
	camera_angle: number;
	camera_focus: string;
	camera_pos_x: number;
	camera_pos_y: number;
	camera_pos_z: number;
	light_intensity: number;

	paddle_color: string;
	paddle_texture: string | null;
	paddle_material: string;

	op_paddle_color: string;
	op_paddle_texture: string | null;
	op_paddle_material: string;

	ball_color: string;
	ball_texture: string | null;
	ball_material: string;
	ball_trail_enabled: number;

	wall_color: string;
	wall_texture: string | null;
	wall_material: string;

	sound_wall_bounce: number;
	sound_paddle_bounce: number;
	sound_point_win: string;
	sound_point_lose: string;

	avatar_enabled: number;
	avatar_follow_paddle: number;
	avatar_offset: number;
	avatar_size: number;
	ui_font: string;
	ui_font_size: number;
	ui_font_color: string;
	ui_scale: number;
	ui_score_position: string;
	ui_name_position: string;
};



export interface playerInterface<SocketType= any>{
	userID:number,
	username?:string,
	socket:SocketType,
	typedSocket: TypedSocket,
	gameID?:number,
	tournamentID?:number,
	score?:number,
	hasDisconnected?:boolean,
	disconnectTimeOut?:NodeJS.Timeout,
	state:string, // 'init'|'waiting'| 'playing'| 'tournamentWait' | 'tournamentPlay'
	playerSide?:"left" | "right"| "top" | "bottom",
	playerPos?:number
}

export interface paddleInterface{
	userID:number,
	username:string,
	gameID:number,
	x:number,
	y:number,
	width:number,
	length:number,
	type: 'H' | 'V',
	speed: number,
	score?: number;
}

export interface ballInterface{
	gameID:number,
	posX:number,
	posY:number,
	radius:number,
	vector:{x:number, y:number}
}

export interface gameRoomInterface{
	gameID:number,
	winCondition:string, //'score' || 'time'
	limit:number ,//score limit or seconds limit
	mode:string,//2p 4p ...
	settings?:string,
	created_at?:string
}

export type SocketMessageMap = {
	init: {	type: 'init';
			success?: boolean;
			userID: number;
			state?: string
		};
	joinGame: { type: 'joinGame';
				success?: boolean;
				reason?: string;
				gameID?: number;
				gameName?:string;
				userID?:number
		};
	invite: {	type: 'invite'; 
				action: 'reply' | 'receive'; 
				response?: string; 
				userID?: number;
				targetID?: number;
				fromID?: number;
		};
	startGame:{	type:'startGame';
				userID:number;
				gameID:number;
				win_condition:string;
				limit:number; 
				usernames: Record<'left' | 'right' | 'top' | 'bottom', string>; 
		};
	statusUpdate:{	type:'statusUpdate';
					userID:number;
					newState:string
			};
	playerMove:{ type:'playerMove';
				 gameID:number;
				 userID:number;
				 direction:string
			};
	renderData: {	type: 'renderData';
					paddles: Record<number, { pos: number; side: 'left' | 'right' | 'top' | 'bottom'; score:number}>;
					balls: Record<number, { x: number; y: number }>;
					elapsed:number;
					isPaused:boolean;
			};
	endMatch:{	type:'endMatch';
				iswinner: boolean;
				playerScores: Record<string, number>;
			};
	reconnected:{	type:'reconnected';
					userID:number;
					username?:string;
					state?:string;
					gameID?:number;
					tournamentID?:number;
					message?:string
			};
	leaveGame:{	type:'leaveGame';
				userID:number;
				gameID:number;
				islegit:boolean
			};
	giveSide:{	type:'giveSide';
				userID:number;
				gameID:number;
				side:'right'|'left'| 'top'| 'bottom'
			};
	kicked:{	type:'kicked';
				userID:number;
				reason:string;
		};
	joinTournament:{	type:'joinTournament';
						userID:number;
						username?:string;
						tournamentID:number;
						tourName:string;
						success:boolean;
			};
	updateTourPlayerList:{	type:'updateTourPlayerList';
						tournamentID:number;
						members: { userID: number; username: string }[];
				};
	leaveTournament:{	type:'leaveTournament';
						userID:number;
						tournamentID:number;
						islegit:boolean
					};
	updateTourList:{	type:'updateTourList';
						list:{	tourID:number,
								name:string,
								createdBy:number,
								maxPlayers:number,
								status:string}[];

	};
};

export type SocketMessage = SocketMessageMap[keyof SocketMessageMap];

// All valid socket event names
export type SocketEvent = keyof SocketMessageMap;

// Handler function signature (frontend or backend)
export type EventHandler<SocketType = any> = (
	socket: SocketType,
	data: SocketMessageMap[keyof SocketMessageMap]
) => void;

// A map of event names to their specific handler functions
export type EventHandlerMap<SocketType = any> = {
	[K in SocketEvent]?: (socket: SocketType, data: SocketMessageMap[K]) => void;
};


export const paddleSize=4.20;
export const paddleWidth=1.5;

export const arenaLength2p=18;
export const arenaWidth2p=32;

export const arenaWidth4p=30;
export const arenaLength4p=30;

export const ballSize=0.8;