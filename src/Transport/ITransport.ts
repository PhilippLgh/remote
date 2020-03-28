import { EventEmitter } from 'events'

/**
 * Implementers of this interface
 * emit only one event type: 'message' and expose
 * exactly one method to send new 'message' objects
 */
export default interface ITransport extends EventEmitter {
  send(message: any) : void;
}