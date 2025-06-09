import {
  SocketEvent,
  SocketMessage,
  SocketMessageMap,
  EventHandlerMap,
} from './gameTypes'; // path to your shared types
import {WebSocket} from 'ws'

export function createTypedEventSocket<SocketType = WebSocket>(
  socket: SocketType,
  handlers: Partial<EventHandlerMap<SocketType>> = {}
) {
  // Register handlers internally
  const eventHandlers: Partial<EventHandlerMap<SocketType>> = { ...handlers };

  // Parse incoming raw messages and dispatch typed events
  const onRawMessage = (event: MessageEvent) => {
    try {
      const data = JSON.parse(event.data) as SocketMessage;
      const handler = eventHandlers[data.type];
      if (handler) handler(socket, data as any); // type cast OK here
    } catch (err) {
      console.warn('Invalid message received:', event.data);
    }
  };

  socket.addEventListener('message', onRawMessage);

  // Optional: expose a method to register handlers dynamically
  function on<K extends SocketEvent>(
    event: K,
    handler: (socket: SocketType, data: SocketMessageMap[K]) => void
  ) {
    if (!eventHandlers[event]) {
      eventHandlers[event] = handler;
    } else {
      // chain multiple handlers if needed
      const prev = eventHandlers[event]!;
      eventHandlers[event] = (sock, data) => {
        prev(sock, data as any);
        handler(sock, data as any);
      };
    }
  }

  // Send method accepts typed event + payload matching your SocketMessageMap
  function send<K extends SocketEvent>(event: K, payload: Omit<SocketMessageMap[K], 'type'>) {
    const msg = JSON.stringify({ type: event, ...payload });
    socket.send(msg);
  }

  // Return a clean API
  return { on, send, socket };
}
