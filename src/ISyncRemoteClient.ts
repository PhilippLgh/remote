export interface ISyncRemoteClient {
  getRemoteMember: (metaId: string, memberName: string) => any
  setRemoteMember: (metaId: string, memberName: string, value: any) => void
  callRemoteConstructor: (metaId: string, args: any) => any
  callRemoteFunction: (metaId: string, args: any) => any
  callRemoteMemberConstructor: (metaId: string, memberName: string, args: any) => any
  callRemoteMember: (metaId: string, memberName: string, args: any) => any
}