import { FastifyInstance } from 'fastify'
import bcrypt from 'bcrypt' // Blowfish encrypting
import jwt from 'jsonwebtoken' // Json web token -> one-time token
import speakeasy from 'speakeasy' // lib that supports 2fa using time based one-time pass (TOTP) and HOTP
import * as UserManagement from '../db/userManagement';
import * as dotenv from 'dotenv';
import path from 'path';

dotenv.config({
	path: path.resolve(process.cwd(), '.env'),
});

// SECRET KEY to sign JWT (.env)
const JWT_SECRET = process.env.JWT_SECRET!;
if (!JWT_SECRET) {
	throw new Error("JWT_SECRET environment variable is not defined");
}


// Big function called by main.ts to mount auth routes
export async function authRoutes(fastify: FastifyInstance) {
	// 1) Route POST /api/auth/register ------------------------------------ REGISTER
	fastify.post('/auth/register', async (request, reply) => {
		// a) Read Json body as request.body
		const { username, password } = request.body as { username: string, password: string }

		// b) Micro verif if password & username are set
		if (!username || !password) {
			return reply.code(400).send({ error: 'Incomplete Username or Password' })
		}

		// a) Look for user in db
		const newUser = await UserManagement.getUserByName(username);
		if(newUser != null){
		return reply.code(400).send({error : 'Name already in use'})
	}

	//b) No user in bd with same name, we create a new user 	
			// Password hashing using bcrypt
				const passwordHash = await bcrypt.hash(password, 12)

			//Create simple ID (with timestamp + random)
				const id = `${Date.now()}-${Math.floor(Math.random()*1000)}`
			//Create the user in the database
				await UserManagement.createUser(id, username, passwordHash)

			//Success feedback
		return reply.code(201).send({ message: 'Registered successfully', userId: id })
	})

	// 2) Route POST /api/auth/login ------------------------------------------ LOGIN
	fastify.post('/auth/login', async (request, reply) => {
			try {
					const { username, password } = request.body as { username: string, password: string };
					
					if (!username || !password) {
							return reply.code(400).send({ error: 'Username and password are required' });
					}

					const user = await UserManagement.getUserByName(username);
					if (!user) {
							return reply.code(401).send({ error: 'Invalid credentials' });
					}

					const valid = await bcrypt.compare(password, user.password_hashed);
					if (!valid) {
							return reply.code(401).send({ error: 'Invalid credentials' });
					}

					// Création du token avec le bon format
					const token = jwt.sign(
							{ 
									sub: user.rand_id,
									step: '2fa'  // Important: this flag indicates 2FA setup/verify is needed
							},
							JWT_SECRET,
							{ expiresIn: '5m' }
					);

					return reply.send({
							token,
							need2FASetup: !user.totp_secret,
							need2FAVerify: !!user.totp_secret
					});
			} catch (error) {
					console.error('Login error:', error);
					return reply.code(500).send({ error: 'Internal server error' });
			}
	});


// 3) Route POST /api/auth/2fa/setup
fastify.post('/auth/2fa/setup', async (request, reply) => {
		try {        
				// Vérification du token d'autorisation
				const auth = request.headers.authorization;
				
				if (!auth) {
						return reply.code(401).send({ error: 'No token provided' });
				}

				const token = auth.split(' ')[1];
				if (!token) {
						return reply.code(401).send({ error: 'Invalid authorization format' });
				}

				let payload: any;
				try {
						payload = jwt.verify(token, JWT_SECRET);
				} catch (error) {
						console.error('Token verification failed:', error);
						return reply.code(401).send({ error: 'Invalid token' });
				}

				if (payload.step !== '2fa') {
						return reply.code(400).send({ 
								error: 'Token not in 2FA setup mode',
								details: 'Current step: ' + payload.step 
						});
				}

				// Récupération de l'utilisateur
				const rand_user = await UserManagement.getUserByRand(payload.sub);
				if (!rand_user) {
						return reply.code(404).send({ error: 'User not found' });
				}

				// Génération du secret TOTP
				const secret = speakeasy.generateSecret({
						name: encodeURIComponent(`ft_transcendence(${rand_user.username})`)
				});

				// Sauvegarde du secret dans la base de données
				try {
						await UserManagement.setTotp(rand_user.our_index, secret.base32);
				} catch (error) {
						console.error('Failed to save TOTP secret:', error);
						return reply.code(500).send({ error: 'Failed to save 2FA configuration' });
				}

				// Envoi de la réponse
				return reply.send({
						otpauth_url: secret.otpauth_url,
						base32: secret.base32
				});
		} catch (error) {
				console.error('2FA setup error:', error);
				return reply.code(500).send({ 
						error: 'Internal server error during 2FA setup',
				});
		}
});

	// 4) Route POST /api/auth/2fa/verify -------------------------------------------- Verify 2FA
	fastify.post('/auth/2fa/verify', async (request, reply) => {
		const { code } = request.body as { code: string }
		const auth = (request.headers.authorization || '').split(' ')[1] // get the token only
		if (!auth) return reply.code(401).send({ error: 'No token' })

		let payload: any
		try {
			payload = jwt.verify(auth, JWT_SECRET)
		} catch {
			return reply.code(401).send({ error: 'Invalid token' })
		}
		if (payload.step !== '2fa') {
			return reply.code(400).send({ error: 'Token says 2FA is not in setup mode : Did you already setup 2FA ?' })
		}

		const user = await UserManagement.getUserByRand(payload.sub)
		if (!user || !user.totp_secret) {
			return reply.code(404).send({ error: 'Invalid User' })
		}

		// Verify code with the stocked secret using speakeasy lib
		const ok = speakeasy.totp.verify({
			secret: user.totp_secret,
			encoding: 'base32',
			token: code
		})
		if (!ok) {
			return reply.code(400).send({ error: 'Invalid 2fa code' })
		}

		// Final JWT generation
		const token = jwt.sign({ sub: user.rand_id }, JWT_SECRET, { expiresIn: '1h' })

		return reply
			.setCookie('token', token, {
				httpOnly: true,
				secure: process.env.NODE_ENV === 'production',
				path: '/',
				sameSite: 'lax',
				maxAge: 3600
			})
			.setCookie('userId', String(user.our_index), {
				httpOnly: true,
				secure: process.env.NODE_ENV === 'production',
				path: '/',
				sameSite: 'lax',
				maxAge: 3600,
				signed: true
			})
			.send({ 
				token,
				userId: user.our_index // Ajoutez l'userId dans la réponse
			});
	})


	// Route to start 2FA reconfiguration
	fastify.post('/auth/2fa/reconfigure', async (request, reply) => {
			try {
					console.log('token payload:', payload, 'user:', user);
					const auth = request.headers.authorization;
					if (!auth) {
							return reply.code(401).send({ error: 'No token provided' });
					}

					const token = auth.split(' ')[1];
					if (!token) {
							return reply.code(401).send({ error: 'Invalid authorization format' });
					}

					// Verify current session token
					let payload: any;
					try {
							payload = jwt.verify(token, JWT_SECRET);
					} catch (error) {
							return reply.code(401).send({ error: 'Invalid token' });
					}

					// Get user from database using payload.sub
					const user = await UserManagement.getUserByRand(String(payload.sub));
					if (!user) {
							return reply.code(404).send({ error: 'User not found' });
					}

					// First, verify that the user has 2FA enabled
					if (!user.totp_secret) {
							return reply.code(400).send({ 
									error: 'Cannot reconfigure 2FA because it is not enabled',
									need2FASetup: true
							});
					}

					// Create new temporary token specifically for 2FA setup
					const setupToken = jwt.sign(
							{ 
									sub: payload.sub,
									step: '2fa'
							},
							JWT_SECRET,
							{ expiresIn: '5m' }
					);

					// Generate new TOTP secret
					const secret = speakeasy.generateSecret({
							name: encodeURIComponent(`ft_transcendence(${user.username})`)
					});

					// Save the new secret temporarily (consider using a separate field or temporary storage)
					try {
							await UserManagement.setTotp(user.our_index, secret.base32);
					} catch (error) {
							console.error('Failed to save TOTP secret:', error);
							return reply.code(500).send({ error: 'Failed to save 2FA configuration' });
					}

					return reply.send({
							token: setupToken,
							otpauth_url: secret.otpauth_url,
							base32: secret.base32
					});
			} catch (error) {
					console.error('Error during 2FA reconfiguration:', error);
					return reply.code(500).send({
							error: 'Internal server error during 2FA reconfiguration'
					});
			}
	});
	
	// Helper API to get the userId (i couldnt unsign the userId token in front)
	fastify.get('/auth/me', async (request, reply) => {
			const raw = request.cookies?.userId;
			if (!raw) {
					return reply.code(401).send({ error: 'Missing userId cookie' });
			}
			
			const { valid, value } = request.unsignCookie(raw);
			if (!valid) {
					return reply.code(401).send({ error: 'Invalid userId cookie' });
			}
			
			const userId = Number(value);
			if (isNaN(userId)) {
					return reply.code(400).send({ error: 'Malformed userId cookie' });
			}
			
			return reply.send({ userId });
	});
	// Return the current user's profile
	fastify.get('/users/me', async (request, reply) => {
			const auth = request.headers.authorization;
			if (!auth) return reply.code(401).send({ error: 'No token' });

			const token = auth.split(' ')[1];
			if (!token) return reply.code(401).send({ error: 'Invalid authorization format' });

			let payload: any;
			try {
					payload = jwt.verify(token, JWT_SECRET);
			} catch (error) {
					return reply.code(401).send({ error: 'Invalid token' });
			}

			const user = await UserManagement.getUserByRand(String(payload.sub));
			if (!user) return reply.code(404).send({ error: 'User not found' });

			return reply.send({
					userId: user.our_index,
					username: user.username,
					avatarUrl: user.avatar_url || null,
					has2fa: !!user.totp_secret
			});
	});
	// Change password
	fastify.post('/users/me/password', async (request, reply) => {
		const auth = request.headers.authorization;
		if (!auth) return reply.code(401).send({ error: 'No token' });
		const token = auth.split(' ')[1];
		let payload;
		try {
			payload = jwt.verify(token, JWT_SECRET);
		} catch {
			return reply.code(401).send({ error: 'Invalid token' });
		}
		const user = await UserManagement.getUserByRand(String(payload.sub));
		if (!user) return reply.code(404).send({ error: 'User not found' });

		const { newPassword } = request.body as { newPassword: string };
		if (!newPassword || newPassword.length < 4)
			return reply.code(400).send({ error: 'Password too short' });

		const hashed = await bcrypt.hash(newPassword, 12);
		await UserManagement.setPasswordH(user.our_index, hashed);
		reply.send({ success: true });
	});
}

