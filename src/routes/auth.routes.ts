import { FastifyInstance } from 'fastify'
import bcrypt from 'bcrypt' // Blowfish encrypting
import jwt from 'jsonwebtoken' // Json web token -> one-time token
import speakeasy from 'speakeasy' // lib that supports 2fa using time based one-time pass (TOTP) and HOTP
import * as UserManagement from '../db/userManagement';
import * as GameManagement from '../db/gameManagement'
import * as dotenv from 'dotenv';
import { getPlayerState } from '../websockets/game.socket';
import path from 'path';

dotenv.config({
	path: path.resolve(process.cwd(), '.env'),
});


// ---------- policy constants ----------
const USERNAME_MIN = 5;
const USERNAME_MAX = 24;
const PASSWORD_MIN = 8;
const PASSWORD_MAX = 72;

const COMMON_PASSWORDS = new Set([
  'password', 'motdepasse', '12345678', 'azertyui', 'qwertyui', 'letmein',
  'adminadmin', 'iloveyou', '00000000', '123456789', 'aaaaaaaa'
]);

// ---------- helpers ----------

function validateUsername(u: string): string | null {
  if (u.length < USERNAME_MIN || u.length > USERNAME_MAX)
    return `Username must be between ${USERNAME_MIN} and ${USERNAME_MAX} characters.`;

  // Start with letter OR digit; allowed chars remain letters/digits ._- 
  if (!/^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(u))
    return "Username must start with a letter or digit and contain only letters, digits, '.', '-', '_'.";

  // No consecutive separators like '..', '__', '--'
  if (/(?:\.\.|__|--)/.test(u))
    return "Username must not contain consecutive separators like '..', '__', '--'.";

  return null;
}

function validatePassword(pw: string, username: string): string | null {
  if (pw.length < PASSWORD_MIN || pw.length > PASSWORD_MAX)
    return `Password must be between ${PASSWORD_MIN} and ${PASSWORD_MAX} characters.`;

  if (/\s/.test(pw))
    return 'Password must not contain spaces.';

  const hasLower = /[a-z]/.test(pw);
  const hasUpper = /[A-Z]/.test(pw);
  const hasDigit = /\d/.test(pw);
  const hasSymbol = /[^A-Za-z0-9]/.test(pw);
  const categories = [hasLower, hasUpper, hasDigit, hasSymbol].filter(Boolean).length;

  if (categories < 3)
    return 'Password must include at least 3 of the following: lowercase, uppercase, digit, symbol.';

  if (pw.toLowerCase().includes(username.toLowerCase()))
    return "Password must not contain the username.";

  if (/(.)\1\1/.test(pw))
    return 'Password must not contain a character repeated 3 or more times in a row.';

  if (COMMON_PASSWORDS.has(pw.toLowerCase()))
    return 'Password is too common. Please choose another one.';

  return null;
}


// Big function called by main.ts to mount auth routes
export async function authRoutes(fastify: FastifyInstance) {
	// 1) Route POST /api/auth/register ------------------------------------ REGISTER
	fastify.post('/auth/register', {
	schema: {
	  body: {
	    type: 'object',
	    required: ['username', 'password'],
	    // additionalProperties: false,
	    // properties: {
	    //   username: { type: 'string', minLength: USERNAME_MIN, maxLength: USERNAME_MAX },
	    //   password: { type: 'string', minLength: PASSWORD_MIN, maxLength: PASSWORD_MAX }
	    // }
	  }
	}
	}, async (request, reply) => {
	const { username, password } = request.body as { username: string; password: string };

	if (!username || !password) {
	  return reply.code(400).send({ error: 'Incomplete username or password' });
	}

	//#noSecurity
	// const uErr = validateUsername(username);
	// if (uErr) return reply.code(400).send({ error: uErr });

	// const pErr = validatePassword(password, username);
	// if (pErr) return reply.code(400).send({ error: pErr });

	const existing = await UserManagement.getUserByName(username);
	if (existing != null) {
	  return reply.code(400).send({ error: 'Name already in use' });
	}

	const passwordHash = await bcrypt.hash(password, 12);
	const id = `${Date.now()}-${Math.floor(Math.random() * 1000)}`;

	const userID = await UserManagement.createUser(id, username, passwordHash);
	if (!userID) {
	  return reply.code(500).send({ error: 'Failed to create user' });
	}

	return reply.code(201).send({ message: 'Registered successfully', userId: id });
	});

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

					const uid = await UserManagement.getIndexByUname(username);
					const status = getPlayerState(uid!);
					if ( status !== 'offline' && status !==  undefined) {
							return reply.code(401).send({ error: 'User already connected !' });
					}
					const token = jwt.sign(
							{ 
									sub: user.rand_id,
									step: '2fa'  // Important: this flag indicates 2FA setup/verify is needed
							},
							fastify.vault.jwt,
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
			payload = jwt.verify(token, fastify.vault.jwt);
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
		const rand_user = await UserManagement.getUserByRand(payload.sub);
		if (!rand_user) {
			return reply.code(404).send({ error: 'User not found' });
		}
		// Generate TOTP secret
		const secret = speakeasy.generateSecret({
			name: encodeURIComponent(`ft_transcendence(${rand_user.username})`)
		});
		// Save temporary TOTP in db
		try {
			await UserManagement.setTotpPending(rand_user.our_index, secret.base32);
		} catch (error) {
			console.error('Failed to save TOTP pending secret:', error);
			return reply.code(500).send({ error: 'Failed to save 2FA configuration' });
		}
		// Send response
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

	fastify.post('/auth/2fa/verify', async (request, reply) => {
		const { code } = request.body as { code: string }
		const auth = (request.headers.authorization || '').split(' ')[1]
		if (!auth) return reply.code(401).send({ error: 'No token' })

		let payload: any
		try {
			payload = jwt.verify(auth, fastify.vault.jwt)
		} catch {
			return reply.code(401).send({ error: 'Invalid token' })
		}
		if (payload.step !== '2fa') {
			return reply.code(400).send({ error: 'Token says 2FA is not in setup mode : Did you already setup 2FA ?' })
		}

		const user = await UserManagement.getUserByRand(payload.sub)
		if (!user) {
			return reply.code(404).send({ error: 'Invalid User' })
		}

		// Pending secret
		let secret = user.totp_pending || user.totp_secret
		if (!secret) {
			return reply.code(404).send({ error: 'No 2FA setup in progress' })
		}

		// Verify
		const ok = speakeasy.totp.verify({
			secret: secret,
			encoding: 'base32',
			token: code
		})
		if (!ok) { // #nomore2fa
			//return reply.code(400).send({ error: 'Invalid 2fa code' })
		}

		// If it was initial setup, set final totp, reset pending one
		if (user.totp_pending) {
			await UserManagement.setTotp(user.our_index, user.totp_pending)
			await UserManagement.setTotpPending(user.our_index, null)
		}

		// Final JWT generation
		const token = jwt.sign({ sub: user.rand_id }, fastify.vault.jwt, { expiresIn: '100h' }) // #nomoreexpiration

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
				userId: user.our_index
			});
	})


	// Route to start 2FA reconfiguration
	fastify.post('/auth/2fa/reconfig', async (request, reply) => {
		try {
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
						payload = jwt.verify(token, fastify.vault.jwt);
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
						fastify.vault.jwt,
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
					payload = jwt.verify(token, fastify.vault.jwt);
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
			payload = jwt.verify(token, fastify.vault.jwt);
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

