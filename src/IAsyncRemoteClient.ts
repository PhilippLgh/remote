export interface IAsyncRemoteClient {
  getRemoteMember: (metaId: string, memberName: string) => Promise<any>
  setRemoteMember: (metaId: string, memberName: string, value: any) => Promise<void>
  callRemoteMember: (metaId: string, memberName: string, args: any[]) => Promise<any>
  callRemoteMemberConstructor: (metaId: string, memberName: string, args: any[]) => Promise<any>
  callRemoteFunction: (metaId: string, args: any[]) => Promise<any>
  callRemoteConstructor: (metaId: string, args: any[]) => Promise<any>
}

export class NoComAsync implements IAsyncRemoteClient {
  async getRemoteMember(metaId: string, memberName: string) {
    throw new Error(`getRemoteMember(${metaId},${memberName}) - No remote communication`)
  }
  async setRemoteMember(metaId: string, memberName: string, value: any) {
    throw new Error('setRemoteMember(${metaId},${memberName},${value}) - No remote communication')
  }
  async callRemoteConstructor(metaId: string, args: any[]) {
    throw new Error('callRemoteConstructor - No remote communication')
  }
  async callRemoteFunction(metaId: string, args: any[]) {
    throw new Error('callRemoteFunction - No remote communication')
  }
  async callRemoteMemberConstructor(metaId: string, memberName: string, args: any[]) {
    throw new Error('callRemoteMemberConstructor - No remote communication')
  }
  async callRemoteMember(metaId: string, memberName: string, args: any[]) {
    throw new Error('callRemoteMember - No remote communication')
  }
  async callCallback(metaId: string, args: any[]) : Promise<boolean> {
    throw new Error('callCallback - No remote communication')
  }
}
