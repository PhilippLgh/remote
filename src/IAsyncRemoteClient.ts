export interface IAsyncRemoteClient {
  getRemoteMember: (metaId: string, memberName: string) => Promise<any>
  setRemoteMember: (metaId: string, memberName: string, value: any) => Promise<void>
  callRemoteMember: (metaId: string, memberName: string, args: any[]) => Promise<any>
  callRemoteMemberConstructor: (metaId: string, memberName: string, args: any[]) => Promise<any>
  callRemoteFunction: (metaId: string, args: any[]) => Promise<any>
  callRemoteConstructor: (metaId: string, args: any[]) => Promise<any>
}