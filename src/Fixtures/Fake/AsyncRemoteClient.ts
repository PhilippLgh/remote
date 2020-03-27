import { metaToValue, MetaType, valueToMeta } from '../../Serialization'
import { RemoteServer } from '../../RemoteServer'
import { IAsyncRemoteClient } from '../../IAsyncRemoteClient'
import { SyncRemoteClient } from './../Fake/SyncRemoteClient'
import { CallbacksRegistry } from '../../CallbacksRegistry'

const delayed = (res: any, delay: number) => new Promise((resolve, reject) => {
  setTimeout(() => {
    resolve(res)
  }, delay)
})

/**
 * Asynchronous RemoteClient implementation that does not use a transport layer
 * but instead calls the correct endpoint on the server directly
 */
export class AsyncRemoteClient implements IAsyncRemoteClient {
  syncRemoteClient: SyncRemoteClient
  private simulatedDelay = 500

  constructor(private _remoteServer: RemoteServer) {
    this.syncRemoteClient = new SyncRemoteClient(_remoteServer)
  }

  async metaToValue(meta: MetaType) {
    return metaToValue(meta, this)
  }

  async getRemote(name: string) {
    return this.metaToValue(this._remoteServer.getRemote(this.syncRemoteClient._contextId, name))
  }

  /* AsyncCom interface  */

  async getRemoteMember(metaId: string, memberName: string): Promise<any> {
    const result = this.syncRemoteClient.getRemoteMemberSync(metaId, memberName)
    return delayed(result, this.simulatedDelay)
  }
  async setRemoteMember(metaId: string, memberName: string, value: any): Promise<void> {
    const result = this.syncRemoteClient.setRemoteMemberSync(metaId, memberName, value)
    await delayed(result, this.simulatedDelay)
  }
  async callRemoteConstructor(metaId: string, args: any): Promise<any> {
    const result = this.syncRemoteClient.callRemoteConstructorSync(metaId, args)
    return delayed(result, this.simulatedDelay)
  }
  async callRemoteFunction(metaId: string, args: any): Promise<any> {
    const result = this.syncRemoteClient.callRemoteFunctionSync(metaId, args)
    return delayed(result, this.simulatedDelay)
  }
  async callRemoteMemberConstructor(metaId: string, memberName: string, args: any): Promise<any> {
    const result = this.syncRemoteClient.callRemoteMemberConstructorSync(metaId, memberName, args)
    return delayed(result, this.simulatedDelay)
  }
  async callRemoteMember(metaId: string, memberName: string, args: any): Promise<any> {
    const result = this.syncRemoteClient.callRemoteMemberSync(metaId, memberName, args)
    return delayed(result, this.simulatedDelay)
  }
  async callCallback(metaId: string, args: any[]): Promise<boolean> {
    throw new Error('not implemented')
    return true
  }
}