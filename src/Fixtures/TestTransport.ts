import ITransport from '../Transport/ITransport'
import { EventEmitter } from 'events'

class EventTransport extends EventEmitter implements ITransport {
  constructor(
    private name: string
  ) {
    super()
  }
  send(message: any): void {
    // console.log(`[${this.name}] send message`, message)
    this.emit('send-message', message)
  }
}

export class TestTransport {
  constructor(
    public client = new EventTransport('client'),
    public server = new EventTransport('server')
  ) {
    this.client.on('send-message', data => this.server.emit('message', data))
    this.server.on('send-message', data => this.client.emit('message', data))
  }
}