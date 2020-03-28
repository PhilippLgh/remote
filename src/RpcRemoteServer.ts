import { RemoteServer, AsyncFunctionCallback } from './RemoteServer'
import ITransport from './Transport/ITransport'
import { RpcRequestMessage } from './RpcMessage'
import toRpc, { RpcApi } from './RpcApi'
import { MetaType } from './Serialization'
import { ChildProcess } from 'child_process'
import { IpcTransport, NullTransport } from './Transport'

const instanceOfChildProcess = (obj: any) : obj is ChildProcess => obj.constructor && obj.constructor.name === 'ChildProcess'

export default class RpcRemoteServer {
  private _rpc: RpcApi = new RpcApi(new NullTransport) // will throw when not set
  constructor(
    private _server: RemoteServer = new RemoteServer(),
  ) {

  }
  private _initTransport(transport : ITransport) {
    this._rpc = toRpc(transport)
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
  add(com: ChildProcess | ITransport) {
    // remote has different transport layer implementations: here we just wrap the ChildProcess IPC connection
    const transport = instanceOfChildProcess(com) ? new IpcTransport(com) : com
    this._initTransport(transport)
  }
  expose(obj: any, name: string) {
    this._server.exposeObject(obj, name)
  }
}