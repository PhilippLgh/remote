import { IAsyncCallbackHandler } from './ICallbackHandler'
import { MetaType } from './Serialization';

export interface IRemoteServer extends IAsyncCallbackHandler {
  getMember(contextId: string, objectId: string, name: string) : any;
  setMember(contextId: string, objectId: string, name: string, argWrapped: MetaType) : any;
  callMember(contextId: string, objectId: string, method: string, argsWrapped: MetaType[]) : any;
  memberConstructor(contextId: string, objectId: string, method: string, argsWrapped: MetaType[]) : any;
  functionCall(contextId: string, objectId: string, argsWrapped: MetaType[]) : any;
  constructorCall(contextId: string, objectId: string, argsWrapped: MetaType[]) : any;

  // registers a callback handler to listen for *all* function callbacks
  // callCallback from IAsyncCallbackHandler
}