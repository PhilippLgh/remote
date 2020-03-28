import { RemoteServer, AsyncFunctionCallback } from './RemoteServer'
import ITransport from './Transport/ITransport'
import { RpcRequestMessage } from './RpcMessage'
import toRpc, { RpcApi } from './RpcApi'
import { MetaType } from './Serialization'

export default class RpcRemoteServer {
  private _rpc: RpcApi
  constructor(
    _transport: ITransport,
    private _server: RemoteServer = new RemoteServer(),
  ) {
    this._rpc = toRpc(_transport)
    this._rpc.on('message', (message: RpcRequestMessage) => {
      const { method, params } = message
      // FIXME hardcoded contextId
      const contextId = '1'
      const result = (this._server as any)[method](contextId, ...params)
      this._rpc.respond(message, result)
    })
    const callbackHandler : AsyncFunctionCallback = (contextId: string, metaId: string, args: MetaType) : Promise<boolean> => {
      return this._rpc.call('callback', metaId, args)
    }
    this._server.setCallback(callbackHandler)
  }
  expose(obj: any, name: string) {
    this._server.exposeObject(obj, name)
  }
}