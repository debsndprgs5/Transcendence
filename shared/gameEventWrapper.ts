import {
  SocketEvent,
  SocketMessage,
  SocketMessageMap,
  EventHandlerMap,
} from './gameTypes'; // path to your shared types
//import {WebSocket} from 'ws'

//MARCHE PAS AVEC 2 types sockets differents 
//   POURQUOI ON UTLISE PAS WS EN FRONT ?
// export function createTypedEventSocket<SocketType = WebSocket>(
//   socket: SocketType,
//   handlers: Partial<EventHandlerMap<SocketType>> = {}
// ) {
//   // Register handlers internally
//   const eventHandlers: Partial<EventHandlerMap<SocketType>> = { ...handlers };

//   // Parse incoming raw messages and dispatch typed events
//   const onRawMessage = (event: MessageEvent) => {
//     try {
//       const data = JSON.parse(event.data) as SocketMessage;
//       const handler = eventHandlers[data.type];
//       if (handler) handler(socket, data as any); // type cast OK here
//     } catch (err) {
//       console.warn('Invalid message received:', event.data);
//     }
//   };

//   socket.addEventListener('message', onRawMessage);

//   // Optional: expose a method to register handlers dynamically
//   function on<K extends SocketEvent>(
//     event: K,
//     handler: (socket: SocketType, data: SocketMessageMap[K]) => void
//   ) {
//     if (!eventHandlers[event]) {
//       eventHandlers[event] = handler;
//     } else {
//       // chain multiple handlers if needed
//       const prev = eventHandlers[event]!;
//       eventHandlers[event] = (sock, data) => {
//         prev(sock, data as any);
//         handler(sock, data as any);
//       };
//     }
//   }

//   // Send method accepts typed event + payload matching your SocketMessageMap
//   function send<K extends SocketEvent>(event: K, payload: Omit<SocketMessageMap[K], 'type'>) {
//     const msg = JSON.stringify({ type: event, ...payload });
//     socket.send(msg);
//   }


//   // Return a clean API
//   return { on, send, socket };
// }

export function createTypedEventSocket<
  SocketType extends { send: (data: string) => void } & (
    | { addEventListener: (type: string, listener: any) => void }
    | { on: (event: string, listener: any) => void }
  )
>(
  socket: SocketType,
  handlers: Partial<EventHandlerMap<SocketType>> = {}
) {
  const eventHandlers: Partial<EventHandlerMap<SocketType>> = { ...handlers };

  const onRawMessage = (event: MessageEvent | { data: string }) => {
    try {
      const dataStr = 'data' in event ? event.data : event;
      const data = JSON.parse(dataStr) as SocketMessage;
      const handler = eventHandlers[data.type];
      if (handler) handler(socket, data as any);
    } catch (err) {
      console.warn('Invalid message received:', 'data' in event ? event.data : event);
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
      eventHandlers[event] = ((sock: SocketType, data: any) => {
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

  return { on, send, socket };
}
