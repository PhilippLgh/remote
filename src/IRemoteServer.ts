export interface IRemoteServer {
  getMember(contextId: string, id: number, name: string) : any;
  setMember(contextId: string, id: number, name: string, args: any[]) : any;
  callMember(contextId: string, id: number, method: string, args: any[]) : any;
  memberConstructor(contextId: string, id: number, method: string, args: any[]) : any;
  functionCall(contextId: string, id: number, args: any[]) : any;
  constructorCall(contextId: string, id: number, args: any[]) : any;
}