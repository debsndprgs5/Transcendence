import { FastifyInstance } from 'fastify'
import bcrypt from 'bcrypt' // Blowfish encrypting
import jwt from 'jsonwebtoken' // Json web token -> one-time token
import speakeasy from 'speakeasy' // lib that supports 2fa using time based one-time pass (TOTP) and HOTP
import { getUserByName, setPassword } from '../db/db'



// SECRET KEY to sign JWT (.env)
const JWT_SECRET = 'jaimelespates123'

// Big function called by main.ts to mount auth routes
export async function authRoutes(fastify: FastifyInstance) {
  // 1) Route POST /api/auth/register ------------------------------------ REGISTER
  fastify.post('/api/auth/register', async (request, reply) => {
    // a) Read Json body as request.body
    const { username,email, password } = request.body as { username: string, email: string , password: string }

    // b) Micro verif if password & username are set
    if (!username || !password) {
      return reply.code(400).send({ error: 'Incomplete Username or Password' })
    }

    // a) Look for user in db
    if(getUserByName(username)){
		return reply.code(400).send({error : 'Name allready in use'})
	}

	//b) No user in bd with same name, we create a new user 
		addUser(username, email)

    // c) Password hashing using bcrypt
    const passwordHash = await bcrypt.hash(password, 12)

    // d) Create simple ID (with timestamp + random)
    const id = `${Date.now()}-${Math.floor(Math.random()*1000)}`

    // e) Stock in map -> soon to be replaced by sql inshallah
    setPassword(username, passwordHash)

    // f) Success feedback
    return reply.code(201).send({ message: 'Registered successfully', userId: id })
  })

	// 2) Route POST /api/auth/login ------------------------------------------ LOGIN
	fastify.post('/api/auth/login', async (request, reply) => {
	  const { username, password } = request.body as { username: string, password: string }
	  if (!username || !password) {
	    return reply.code(400).send({ error: 'Incomplete Username or Password' })
	  }

	  // a) Look for user in map (soon db)
	  const user = Array.from(users.values()).find(u => u.username === username)
	  if (!user) {
	    return reply.code(401).send({ error: 'Invalid Username or Password' })
	  }

	  // b) Compare pass and passhash with bcrypt
	  const valid = await bcrypt.compare(password, user.passwordHash)
	  if (!valid) {
	    return reply.code(401).send({ error: 'Invalid Username or Password' })
	  }

	  // c) Create pending 2fa token. User HAS to provide 2FA
	  const pendingToken = jwt.sign(
	    { sub: user.id, step: '2fa' },
	    JWT_SECRET,
	    { expiresIn: '5m' }
	  )

	  // d) Tell client if he needs to setup 2FA or just verify it
	  const has2FA = Boolean(user.totpSecret)
	  return reply.send({
	    token: pendingToken,
	    need2FASetup: !has2FA,   // true if never config
	    need2FAVerify: has2FA    // true if already config
	  })
	})


  // 3) Route POST /api/auth/2fa/setup ------------------------------------------- SETUP 2FA
  fastify.post('/api/auth/2fa/setup', async (request, reply) => {
    // a) We get the "pending" token via http Header Authorization: Bearer <token>
    const auth = (request.headers.authorization || '').split(' ')[1] // split to get the token
    if (!auth) return reply.code(401).send({ error: 'No token : 401 Unauthorized' })

    let payload: any
    try {
      payload = jwt.verify(auth, JWT_SECRET)
    } catch {
      return reply.code(401).send({ error: 'Invalid Token' })
    }
    if (payload.step !== '2fa') { 
      return reply.code(400).send({ error: 'Token says 2FA is not in setup mode : Did you already setup 2FA ?' })
    }

    // b) Get the user
    const user = users.get(payload.sub)
    if (!user) {
      return reply.code(404).send({ error: 'Invalid User' })
    }

    // c) Generate TOTP token
    const secret = speakeasy.generateSecret({
      name: `ft_transcendence(${user.username})`
    })
    user.totpSecret = secret.base32

    // d) Send the data to create QRcode
    return reply.send({
      otpauth_url: secret.otpauth_url,
      base32: secret.base32
    })
  })

  // 4) Route POST /api/auth/2fa/verify -------------------------------------------- Verify 2FA
  fastify.post('/api/auth/2fa/verify', async (request, reply) => {
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

    const user = users.get(payload.sub)
    if (!user || !user.totpSecret) {
      return reply.code(404).send({ error: 'Invalid User' })
    }

    // Verify code with the stocked secret using speakeasy lib
    const ok = speakeasy.totp.verify({
      secret: user.totpSecret,
      encoding: 'base32',
      token: code
    })
    if (!ok) {
      return reply.code(400).send({ error: 'Invalid 2fa code' })
    }

    // Final JWT generation
    const token = jwt.sign({ sub: user.id }, JWT_SECRET, { expiresIn: '1h' })
    return reply.send({ token })
  })
}
