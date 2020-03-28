import { IAsyncRemoteClient } from './IAsyncRemoteClient'
import ITransport from './Transport/ITransport'
import toRpc, { RpcApi } from './RpcApi'
import { MetaType, metaToValue, valueToMeta } from './Serialization'
import { RpcRequestMessage } from './RpcMessage'
import { CallbacksRegistry } from './CallbacksRegistry'

const log = (message: string, ...args: any[]) => {} // (message: string, ...args: any[]) => console.log(`[RemoteClient] ${message}`, ...args)

export default class RpcRemoteClient implements IAsyncRemoteClient {
  private _rpc: RpcApi
  private _callbacksRegistry: CallbacksRegistry
  constructor(
    private _transport : ITransport
  ) {
    this._rpc = toRpc(_transport)
    this._callbacksRegistry = new CallbacksRegistry()
    this._rpc.on('message', async (message: RpcRequestMessage) => {
      const { method, params } = message
      const result = await (<any>this)[method](...params)
      this._rpc.respond(message, result)
    })
  }

  metaToValue(meta: MetaType) {
    return metaToValue(meta, this)
  }

  // Convert the arguments object into an array of meta data.
  wrapArgs(args: any[], visited = new Set()): any {
    return args.map(arg => valueToMeta(arg, {
      visited, 
      isArgument: true,
      addObject: (obj: any) => { 
        console.log('serializer in client wants to add object', obj)
        throw new Error('unreachable') 
      },
      addCallback: (callback: Function) => this._callbacksRegistry.add(callback)
    }));
  }
  async getRemote(name: string) : Promise<any> {
    const result = await this._rpc.call('getRemote', name) as MetaType
    log('create proxy for', name, result)
    return metaToValue(result, this)
  }
  async getRemoteMember(metaId: string, memberName: string) : Promise<any> {
    log('getRemoteMember', metaId, memberName)
    const result = await this._rpc.call('getMember', metaId, memberName)
    log('getRemoteMember:result', metaId, memberName, result)
    return result
  }
  async setRemoteMember (metaId: string, memberName: string, value: any) : Promise<void> {
    log('setRemoteMember', metaId, memberName, value)
    const result = await this._rpc.call('setMember', metaId, memberName, this.wrapArgs(value))
  }
  async callRemoteMember (metaId: string, memberName: string, args: any[]) : Promise<any> {
    log('callRemoteMember', metaId, memberName, args)
    const result = await this._rpc.call('callMember', metaId, memberName, this.wrapArgs(args))
    log('callRemoteMember:result', metaId, memberName, result)
    return result
  }
  async callRemoteMemberConstructor (metaId: string, memberName: string, args: any[]) : Promise<any> {
    const result = await this._rpc.call('memberConstructor', metaId, memberName, this.wrapArgs(args))
    return result
  }
  async callRemoteFunction (metaId: string, args: any[]) : Promise<any> {
    log('callRemoteFunction', metaId, args)
    const result = await this._rpc.call('functionCall', metaId, this.wrapArgs(args))
    log('callRemoteFunction:result', metaId, args, result)
    return result
  }
  async callRemoteConstructor (metaId: string, args: any[]) : Promise<any> {
    const result = await this._rpc.call('constructorCall', metaId, this.wrapArgs(args))
    return result
  }
  async callback(metaId: string, args: any[]) : Promise<boolean> {
    this._callbacksRegistry.apply(metaId, metaToValue(args));
    return true
  }
}