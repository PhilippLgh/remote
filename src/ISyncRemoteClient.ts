export interface ISyncRemoteClient {
  getRemoteMemberSync: (metaId: string, memberName: string) => any
  setRemoteMemberSync: (metaId: string, memberName: string, value: any) => void
  callRemoteConstructorSync: (metaId: string, args: any[]) => any
  callRemoteFunctionSync: (metaId: string, args: any[]) => any
  callRemoteMemberConstructorSync: (metaId: string, memberName: string, args: any[]) => any
  callRemoteMemberSync: (metaId: string, memberName: string, args: any[]) => any

  callCallbackSync: (metaId: string, args: any[]) => boolean
}

export const instanceOfISyncRemoteClient = (obj: any) : obj is ISyncRemoteClient => 'getRemoteMemberSync' in obj

export class NoComSync implements ISyncRemoteClient {
  getRemoteMemberSync(metaId: string, memberName: string) {
    throw new Error('getRemoteMemberSync - No remote communication')
  }
  setRemoteMemberSync(metaId: string, memberName: string, value: any) {
    throw new Error('setRemoteMemberSync - No remote communication')
  }
  callRemoteConstructorSync(metaId: string, args: any[]) {
    throw new Error('callRemoteConstructorSync - No remote communication')
  }
  callRemoteFunctionSync(metaId: string, args: any[]) {
    throw new Error('callRemoteFunctionSync - No remote communication')
  }
  callRemoteMemberConstructorSync(metaId: string, memberName: string, args: any[]) {
    throw new Error('callRemoteMemberConstructorSync - No remote communication')
  }
  callRemoteMemberSync(metaId: string, memberName: string, args: any[]) {
    throw new Error('callRemoteMemberSync - No remote communication')
  }
  callCallbackSync(metaId: string, args: any[]) : boolean {
    throw new Error('callCallbackSync - No remote communication')
  }
}