import { ISyncRemoteClient } from '../../ISyncRemoteClient'
import { MetaType, metaToValue, valueToMeta, metaToValueSync } from '../../Serialization'
import { RemoteServer } from '../../RemoteServer'
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
    _remoteServer.setCallback((contextId: string, metaId: string, args: MetaType) => {
      return this.onCallback(metaId, args)
    })
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

  metaToValue(meta: MetaType) {
    return metaToValueSync(meta, this)
  }

  getRemote(name: string) {
    return this.metaToValue(this._remoteServer.getRemote(this._contextId, name))
  }

  /* SyncCom interface  */

  getRemoteMemberSync(metaId: string, memberName: string) {
    // console.log('get remote member', metaId, memberName)
    return this._remoteServer.getMember(this._contextId, metaId, memberName)
  }
  setRemoteMemberSync(metaId: string, memberName: string, value: any): void {
    console.log('set remote member', metaId, memberName, this.wrapArgs(value))
  }
  callRemoteConstructorSync(metaId: string, args: any) {
    console.log('call remote constructor', metaId, this.wrapArgs(args))
  }
  callRemoteFunctionSync(metaId: string, args: any[]) {
    // console.log('call remote function', metaId, args)
    return this._remoteServer.functionCall(this._contextId, metaId, this.wrapArgs(args))
  }
  callRemoteMemberConstructorSync(metaId: string, memberName: string, args: any) {
    console.log('call remote member constructor', metaId, memberName, this.wrapArgs(args))
  }
  callRemoteMemberSync(metaId: string, memberName: string, args: any) {
    // console.log('call remote member', metaId, memberName, args)
    return this._remoteServer.callMember(this._contextId, metaId, memberName, this.wrapArgs(args))
  }
  onCallback(metaId: string, argsWrapped: MetaType) : Promise<boolean> {
    const args = this.metaToValue(argsWrapped)
    // console.log('unwrapped callback args', JSON.stringify(args))
    this._callbacksRegistry.apply(metaId, args);
    return Promise.resolve(true)
  }
  callCallbackSync(metaId: string, args: any[]) : boolean {
    throw new Error('not implemented')
    return true
  }
}