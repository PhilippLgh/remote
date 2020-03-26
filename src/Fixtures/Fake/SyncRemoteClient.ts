import { ISyncRemoteClient } from '../../ISyncRemoteClient'
import { MetaType, metaToValue } from '../../Serialization'
import { RemoteServer } from '../../RemoteServer'
import { valueToMetaClient } from '../../Serialization/ValueToMeta'
import { CallbacksRegistry } from '../../CallbacksRegistry'

/**
 * Synchronous RemoteClient implementation that does not use a transport layer
 * but instead calls the correct endpoint on the server directly
 */
export class SyncRemoteClient implements ISyncRemoteClient {

  _contextId: string
  private _callbacksRegistry: CallbacksRegistry

  constructor(private _remoteServer: RemoteServer) {
    this._contextId = '123'
    this._callbacksRegistry = new CallbacksRegistry()
    _remoteServer.onCallback((contextId: string, metaId: string, ...args: any[]) => {
      // @ts-ignore
      return this.onCallback(metaId, args)
    })
  }

  // Convert the arguments object into an array of meta data.
  wrapArgs(args: any[], visited = new Set()): any {
    return args.map(arg => valueToMetaClient(arg, visited, this._callbacksRegistry));
  }

  metaToValue(meta: MetaType) {
    return metaToValue(meta, this)
  }

  getRemote(name: string) {
    return this.metaToValue(this._remoteServer.getRemote(this._contextId, name))
  }

  /* SyncCom interface  */

  getRemoteMember(metaId: string, memberName: string) {
    // console.log('get remote member', metaId, memberName)
    return this._remoteServer.getMember(this._contextId, metaId, memberName)
  }
  setRemoteMember(metaId: string, memberName: string, value: any): void {
    console.log('set remote member', metaId, memberName, value)
  }
  callRemoteConstructor(metaId: string, args: any) {
    console.log('call remote constructor', metaId, this.wrapArgs(args))
  }
  callRemoteFunction(metaId: string, args: any[]) {
    // console.log('call remote function', metaId, args)
    return this._remoteServer.functionCall(this._contextId, metaId, this.wrapArgs(args))
  }
  callRemoteMemberConstructor(metaId: string, memberName: string, args: any) {
    console.log('call remote member constructor', metaId, memberName, this.wrapArgs(args))
  }
  callRemoteMember(metaId: string, memberName: string, args: any) {
    // console.log('call remote member', metaId, memberName, args)
    return this._remoteServer.callMember(this._contextId, metaId, memberName, this.wrapArgs(args))
  }
  onCallback(metaId: string, args: MetaType) : boolean {
    console.log('meta to value on callback arg', JSON.stringify(args))
    this._callbacksRegistry.apply(metaId, this.metaToValue(args));
    return true
  }
}