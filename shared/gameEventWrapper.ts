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

// export function createTypedEventSocket<
//     SocketType extends { send: (data: string) => void } & (
//         | { addEventListener: (type: string, listener: any) => void }
//         | { on: (event: string, listener: any) => void }
//     )
// >(
//     socket: SocketType,
//     handlers: Partial<EventHandlerMap<SocketType>> = {}
// ) {
//     // Check if we already have a wrapper for this socket
//     if (wrappedSockets.has(socket)) {
//       //  console.log('Reusing existing socket wrapper');
//         return wrappedSockets.get(socket);
//     }

//     //console.log('Creating typed socket wrapper with initial handlers:', Object.keys(handlers));
    
//     const eventHandlers: Partial<EventHandlerMap<SocketType>> = { ...handlers };

//     function isEventEmitter(socket: any): socket is EventEmitter {
//         const isEmitter = socket && typeof socket.setMaxListeners === 'function';
//       //  console.log('Socket is EventEmitter:', isEmitter);
//         return isEmitter;
//     }

//     if (isEventEmitter(socket)) {
//       //  console.log('Setting max listeners to 40');
//         socket.setMaxListeners(40);
//     }

//     const onRawMessage = (event: MessageEvent | { data: string }) => {
//         try {
//             const dataStr = 'data' in event ? event.data : event;
//             const data = JSON.parse(dataStr) as SocketMessage;
//             //console.log('Received message of type:', data.type);
            
//             const handler = eventHandlers[data.type];
//             if (handler) {
//                //console.log('Found handler for type:', data.type);
//                 handler(socket, data as any);
//             } else {
//                 console.log('No handler found for type:', data.type);
//             }
//         } catch (err) {
//             console.warn('Invalid message received:', 'data' in event ? event.data : event);
//             console.error('Parse error:', err);
//         }
//     };

//     // Add the "message" event listener once
//    // console.log('Setting up main message listener');
//     if ('addEventListener' in socket) {
//  //       console.log('Using addEventListener for main message handler');
//         socket.addEventListener('message', onRawMessage as EventListener);
//     } else if ('on' in socket) {
//   //      console.log('Using .on for main message handler');
//         (socket as any).on('message', onRawMessage);
//     } else {
//   //      console.error('Socket does not support event listening');
//         throw new Error('Socket does not support event listening');
//     }

//       function on<K extends SocketEvent>(
//         event: K,
//         handler: (socket: SocketType, data: SocketMessageMap[K]) => void
//     ) {
//       //  console.log('on() called for event:', event);
//       //  console.log('Current handlers before adding:', Object.keys(eventHandlers));
        
//         if (!eventHandlers[event]) {
//       //      console.log('Adding first handler for event:', event);
//             eventHandlers[event] = handler as any;
//         } else {
//         //    console.log('Stacking handler for event:', event);
//             const prev = eventHandlers[event]!;
//             eventHandlers[event] = ((sock: SocketType, data: SocketMessageMap[K]) => {
//           //      console.log('Executing stacked handlers for:', event);
//                 (prev as any)(sock, data);
//                 handler(sock, data);
//             }) as any;
//         }
//      //   console.log('Current handlers after adding:', Object.keys(eventHandlers));
//     }

//     function send<K extends SocketEvent>(
//         event: K,
//         payload: Omit<SocketMessageMap[K], 'type'>
//     ) {
//         const msg = JSON.stringify({ type: event, ...payload });
//     //    console.log('Sending message:', { type: event, ...payload });
//         socket.send(msg);
//     }

//         function cleanup() {
//         if ('removeEventListener' in socket) {
//             (socket as { removeEventListener: (type: string, listener: any) => void })
//                 .removeEventListener('message', onRawMessage);
//         } else if ('off' in socket) {
//             (socket as any).off('message', onRawMessage);
//         }
//         wrappedSockets.delete(socket);
//     }


//     const wrapper = { on, send, socket, cleanup };
//   //  console.log('Created socket wrapper with handlers:', Object.keys(eventHandlers));
    
//     // Store the wrapper in WeakMap
//     wrappedSockets.set(socket, wrapper);
//     return wrapper;
// }

// // Add helper function to check if a socket is wrapped
// export function isSocketWrapped(socket: any): boolean {
//     return wrappedSockets.has(socket);
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
    console.log('[SOCKET WRAPPER] Clearing all registered event handlers.');
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
