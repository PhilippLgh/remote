import { PartialRpcRequestMessage, RpcResponseMessage, instanceOfRpcResponse, instanceOfRpcRequest, RpcRequestMessage } from './RpcMessage'
import { EventEmitter } from 'events'
import ITransport from './Transport/ITransport'

const log = (msg: string, ...args: any[]) => {} // console.log
/**
 * The RpcApi formats and enumerates messages from an ITransport protocol
 * it can associate requests and responses by their id
 * this module transforms send(getx) -> .on('getx') -> send(x) 
 * into x = await send('getx')
 */
export class RpcApi extends EventEmitter {
  private _messageId = 0
  private _responsePromises: any = {}
  constructor(private _transport: ITransport) {
    super()
    _transport.on('message', this._onMessage.bind(this))
  }
  public call(methodName: string, ...args: any[]) : Promise<any> {
    return this.send({
      method: methodName,
      params: args
    })
  }
  public respond(message: RpcRequestMessage, result: any) {
    const { id } = message
    return this.send({
      id,
      result
    })
  }
  private send(message: PartialRpcRequestMessage | RpcResponseMessage) {
    log('[RpcApi] send message', message)
    const id = this._messageId++
    const rpcMessage = {
      ...message,
      id
    }
    const prom = new Promise((resolve, reject) => {
      this._responsePromises[id] = { resolve, reject }
    })
    // avoid race condition in testing: add promise before send message
    this._transport.send(rpcMessage)
    return prom
  }
  private _onMessage(message: any) {
    if (instanceOfRpcResponse(message)) {
      log('[RpcApi] resolve promise for response', message)
      const { id, result, error } = message
      if (this._responsePromises[id]) {
        const { resolve, reject } = this._responsePromises[id]
        delete this._responsePromises[id]
        if (error) {
          return reject(error.message)
        }
        return resolve(result)
      } else {
        console.log('promise not found')
      }
    }
    else if (instanceOfRpcRequest(message)) {
      log('[RpcApi] forward message', message)
      this.emit('message', message)
    }
    else {
      // console.log('[RpcApi] WARNING: silence message', message)
    }
  }
}

const toRpc = (transport: ITransport) => new RpcApi(transport)

export default toRpc