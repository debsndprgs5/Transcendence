import {
  SocketEvent,
  SocketMessage,
  SocketMessageMap,
  EventHandlerMap,
} from './gameTypes';
import { EventEmitter } from 'events';


// Use WeakMap outside the function
const wrappedSockets = new WeakMap<any, any>();

// Redefine EventHandler to match your type in gameTypes
type EventHandler<T, K extends SocketEvent> = (
    socket: T,
    data: SocketMessageMap[K]
) => void;

export function createTypedEventSocket<
  SocketType extends { send: (data: string) => void } & (
    | { addEventListener: (type: string, listener: any) => void }
    | { on: (event: string, listener: any) => void }
  )
>(
  socket: SocketType,
  handlers: Partial<EventHandlerMap<SocketType>> = {}
) {
  if (wrappedSockets.has(socket)) {
    return wrappedSockets.get(socket);
  }

  const eventHandlers: Partial<EventHandlerMap<SocketType>> = { ...handlers };

  const onRawMessage = (event: MessageEvent | { data: string }) => {
    try {
      const dataStr = 'data' in event ? event.data : event;
      const data = JSON.parse(dataStr) as SocketMessage;

      const handler = eventHandlers[data.type];
      if (handler) {
        handler(socket, data as any);
      } else {
        console.log('No handler found for type:', data.type);
      }
    } catch (err) {
      console.warn('Invalid message received:', 'data' in event ? event.data : event);
      console.error('Parse error:', err);
    }
  };

  if ('addEventListener' in socket) {
    socket.addEventListener('message', onRawMessage as EventListener);
  } else if ('on' in socket) {
    (socket as any).on('message', onRawMessage);
  } else {
    throw new Error('Socket does not support event listening');
  }

  function on<K extends SocketEvent>(
    event: K,
    handler: (socket: SocketType, data: SocketMessageMap[K]) => void
  ) {
    if (!eventHandlers[event]) {
      eventHandlers[event] = handler as any;
    } else {
      const prev = eventHandlers[event]!;
      eventHandlers[event] = ((sock: SocketType, data: SocketMessageMap[K]) => {
        (prev as any)(sock, data);
        handler(sock, data);
      }) as any;
    }
  }

  function send<K extends SocketEvent>(
    event: K,
    payload: Omit<SocketMessageMap[K], 'type'>
  ) {
    const msg = JSON.stringify({ type: event, ...payload });
    socket.send(msg);
  }

  function cleanup() {
    if ('removeEventListener' in socket) {
      (socket as { removeEventListener: (type: string, listener: any) => void }).removeEventListener('message', onRawMessage);
    } else if ('off' in socket) {
      (socket as any).off('message', onRawMessage);
    }
    wrappedSockets.delete(socket);
  }

  function clearAllEvents() {
    //console.log('[SOCKET WRAPPER] Clearing all registered event handlers.');
    for (const key in eventHandlers) {
      delete eventHandlers[key as keyof typeof eventHandlers];
    }
    cleanup();
  }

  const wrapper = { on, send, socket, cleanup, clearAllEvents };

  wrappedSockets.set(socket, wrapper);
  return wrapper;
}

export function isSocketWrapped(socket: any): boolean {
  return wrappedSockets.has(socket);
}
