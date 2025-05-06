import Fastify from 'fastify';

async function bootstrap() {
  // Create Fastify instance
  const app = Fastify();

  // Define GET path on root
  app.get('/', async (request, reply) => {
    return { message: 'Hello from ft_transcendence!' };
  });

  // Start server listening on port 3000
  try {
    await app.listen({ port: 3000, host: '0.0.0.0' });
    console.log('Server listening on http://localhost:3000');
  } catch (err) {
    console.error('Error starting server:', err);
    process.exit(1);
  }
}

// bootstrap
bootstrap();
