import ITransport from './ITransport'
import { EventEmitter } from 'events'
import { ChildProcess } from 'child_process'

export default class IpcTransport extends EventEmitter implements ITransport {
  constructor(private _child?: ChildProcess) {
    super()
    if (_child) {
      _child.on('message', this._onMessage.bind(this))
      _child.on('disconnect', () => {
        // console.log('[IpcTransport] WARNING: IPC disconnected')
      })
    } else {
      process.on('message', this._onMessage.bind(this))
    }
  }
  async send(message: any) {
    if (process.send) {
      process.send(message)
    }
    else if (this._child) {
      this._child.send(message)
    }
  }
  private _onMessage(message: any) {
    this.emit('message', message)
  }
}