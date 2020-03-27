export interface IAsyncCallbackHandler {
  callCallback: (metaId: string, args: any[]) => Promise<boolean>
}

export interface ISyncCallbackHandler {
  callCallbackSync: (metaId: string, args: any[]) => boolean
}

export const instanceOfISyncCallbackHandler = (obj: any) : obj is ISyncCallbackHandler => 'callCallbackSync' in obj
