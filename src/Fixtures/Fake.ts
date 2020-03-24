import { SyncCom, AsyncCom, asyncMetaToValue, metaToValue, MetaType } from '../Serialization'
import { RemoteServer } from '../RemoteServer'

const delayed = (res: any, delay: number) => new Promise((resolve, reject) => {
  setTimeout(() => {
    resolve(res)
  }, delay)
})

/**
 * Synchronous RemoteClient implementation that does not use a transport layer
 * but instead calls the correct endpoint on the server directly
 */
export class SyncRemoteClient implements SyncCom {

  _contextId: string

  constructor(private _remoteServer: RemoteServer) {
    this._contextId = '123'
  }

  metaToValue(meta: MetaType) {
    return metaToValue(meta, this)
  }

  getObject(name: string) {
    return this.metaToValue(this._remoteServer.getObject(name))
  }

  /* SyncCom interface  */

  getRemoteMember(metaId: string, memberName: string) {
    console.log('get remote member', metaId, memberName)
    const id = parseInt(metaId)
    return this._remoteServer.getMember(this._contextId, id, memberName)
  }
  setRemoteMember(metaId: string, memberName: string, value: any) : void {
    console.log('set remote member', metaId, memberName, value)
  }
  callRemoteConstructor(metaId: string, args: any) {
    console.log('call remote constructor', metaId, args)
  }
  callRemoteFunction(metaId: string, args: any[]) {
    console.log('call remote function', metaId, args)
    let id = parseInt(metaId)
    return this._remoteServer.functionCall(this._contextId, id, args)
  }
  callRemoteMemberConstructor(metaId: string, memberName: string, args: any) {
    console.log('call remote member constructor', metaId, memberName, args)
  }
  callRemoteMember(metaId: string, memberName: string, args: any) {
    console.log('call remote member', metaId, memberName, args)
    // server:
    let id = parseInt(metaId)
    return this._remoteServer.callMember(this._contextId, id, memberName, args)
  }
}


/**
 * Asynchronous RemoteClient implementation that does not use a transport layer
 * but instead calls the correct endpoint on the server directly
 */
export class AsyncRemoteClient implements AsyncCom {
  syncRemoteClient: SyncRemoteClient
  private simulatedDelay = 500
  constructor(private _remoteServer: RemoteServer) {
    this.syncRemoteClient = new SyncRemoteClient(_remoteServer)
  }

  async metaToValue(meta: MetaType) {
    return asyncMetaToValue(meta, this)
  }

  async getObject(name: string) {
    return this.metaToValue(this._remoteServer.getObject(name))
  }

  /* AsyncCom interface  */

  async getRemoteMember(metaId: string, memberName: string) : Promise<any> {
    const result = this.syncRemoteClient.getRemoteMember(metaId, memberName)
    return delayed(result, this.simulatedDelay)
  }
  async setRemoteMember(metaId: string, memberName: string, value: any) : Promise<void> {
    const result = this.syncRemoteClient.setRemoteMember(metaId, memberName, value)
    await delayed(result, this.simulatedDelay)
  }
  async callRemoteConstructor(metaId: string, args: any) : Promise<any> {
    const result = this.syncRemoteClient.callRemoteConstructor(metaId, args)
    return delayed(result, this.simulatedDelay)
  }
  async callRemoteFunction(metaId: string, args: any) : Promise<any> {
    const result = this.syncRemoteClient.callRemoteFunction(metaId, args)
    return delayed(result, this.simulatedDelay)
  }
  async callRemoteMemberConstructor(metaId: string, memberName: string, args: any) : Promise<any> {
    const result = this.syncRemoteClient.callRemoteMemberConstructor(metaId, memberName, args)
    return delayed(result, this.simulatedDelay)
  }
  async callRemoteMember(metaId: string, memberName: string, args: any) : Promise<any> {
    const result = this.syncRemoteClient.callRemoteMember(metaId, memberName, args)
    return delayed(result, this.simulatedDelay)
  }
}