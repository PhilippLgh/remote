import { EventEmitter } from 'events'
import ITransport from './ITransport'

export default class NullTransport extends EventEmitter implements ITransport {
  send(message: any): void {
    throw new Error("Transport not implemented.");
  }
}